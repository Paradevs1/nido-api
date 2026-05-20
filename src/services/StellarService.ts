import {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Transaction,
  Asset,
} from '@stellar/stellar-sdk';

const FEE_BUMP_FEE = '1000'; // 10x base fee, treasury pays

import { stellarConfig, stellarServer } from '../config/stellar';
import { StellarUtil } from '../utils/stellar.util';
import {
  CreateEscrowDto,
  PreAuthTxDto,
  EscrowStatusDto,
  EscrowStatus,
  SignerDto,
  OpenDisputeDto,
  ResolveDisputeDto,
  DisputeResolutionDto,
} from '../dtos/stellar.dto';
import { StellarEscrowModel, IStellarEscrow } from '../models/StellarEscrow';

export class StellarService {
  // ─── Sprint 1: Create Escrow ─────────────────────────────────────────────────

  async createEscrow(dto: CreateEscrowDto): Promise<IStellarEscrow> {
    if (!StellarUtil.isValidPublicKey(dto.hostPublicKey)) {
      throw new Error('Invalid host public key');
    }
    if (!StellarUtil.isValidPublicKey(dto.talentPublicKey)) {
      throw new Error('Invalid talent public key');
    }

    const escrowKeypair = StellarUtil.generateKeypair();
    const treasuryKeypair = StellarUtil.getTreasuryKeypair();
    const arbiterKeypair = StellarUtil.getArbiterKeypair();
    const usdcAsset = StellarUtil.getUSDCAsset();

    const treasuryAccount = await StellarUtil.loadAccount(treasuryKeypair.publicKey());

    const transaction = new TransactionBuilder(treasuryAccount, {
      fee: BASE_FEE,
      networkPassphrase: stellarConfig.networkPassphrase,
    })
      .addOperation(
        Operation.beginSponsoringFutureReserves({
          sponsoredId: escrowKeypair.publicKey(),
        })
      )
      .addOperation(
        Operation.createAccount({
          destination: escrowKeypair.publicKey(),
          startingBalance: '0',
        })
      )
      .addOperation(
        Operation.changeTrust({
          source: escrowKeypair.publicKey(),
          asset: usdcAsset,
          limit: dto.amount,
        })
      )
      .addOperation(
        Operation.setOptions({
          source: escrowKeypair.publicKey(),
          signer: { ed25519PublicKey: dto.hostPublicKey, weight: 1 },
        })
      )
      .addOperation(
        Operation.setOptions({
          source: escrowKeypair.publicKey(),
          signer: { ed25519PublicKey: dto.talentPublicKey, weight: 1 },
        })
      )
      .addOperation(
        Operation.setOptions({
          source: escrowKeypair.publicKey(),
          signer: { ed25519PublicKey: arbiterKeypair.publicKey(), weight: 1 },
        })
      )
      .addOperation(
        Operation.setOptions({
          source: escrowKeypair.publicKey(),
          masterWeight: 1,
          lowThreshold: 0,
          medThreshold: 2,
          highThreshold: 2,
        })
      )
      .addOperation(
        Operation.endSponsoringFutureReserves({
          source: escrowKeypair.publicKey(),
        })
      )
      .addOperation(
        Operation.payment({
          destination: escrowKeypair.publicKey(),
          asset: usdcAsset,
          amount: dto.amount,
        })
      )
      .setTimeout(stellarConfig.defaults.timeout)
      .build();

    transaction.sign(treasuryKeypair);
    transaction.sign(escrowKeypair);

    try {
      const result = await stellarServer.submitTransaction(transaction);

      const preAuthTxs = await this.buildPreAuthTransactions(
        escrowKeypair.publicKey(),
        dto.talentPublicKey,
        dto.hostPublicKey,
        dto.amount,
        dto.deadlineDays
      );

      const escrow = await StellarEscrowModel.create({
        job_id: dto.jobId,
        escrow_public_key: escrowKeypair.publicKey(),
        secret_key_encrypted: Buffer.from(escrowKeypair.secret()).toString('base64'),
        host_public_key: dto.hostPublicKey,
        talent_public_key: dto.talentPublicKey,
        arbiter_public_key: arbiterKeypair.publicKey(),
        amount: dto.amount,
        asset_code: usdcAsset.code,
        status: EscrowStatus.FUNDED,
        payment_tx_xdr: preAuthTxs.paymentTxXDR,
        payment_tx_hash: preAuthTxs.paymentTxHash,
        refund_tx_xdr: preAuthTxs.refundTxXDR,
        refund_tx_hash: preAuthTxs.refundTxHash,
        deadline: preAuthTxs.deadline,
        stellar_tx_hash: result.hash,
      });

      return escrow;
    } catch (error: any) {
      if (error.response?.data?.extras?.result_codes) {
        console.error('Stellar TX result codes:', error.response.data.extras.result_codes);
      }
      throw error;
    }
  }

  async buildPreAuthTransactions(
    escrowPublicKey: string,
    talentPublicKey: string,
    hostPublicKey: string,
    amount: string,
    deadlineDays: number = stellarConfig.defaults.deadlineDays
  ): Promise<PreAuthTxDto> {
    const escrowAccount = await StellarUtil.loadAccount(escrowPublicKey);
    const deadline = StellarUtil.calculateDeadline(deadlineDays);
    const usdcAsset = StellarUtil.getUSDCAsset();

    const paymentTx = new TransactionBuilder(escrowAccount, {
      fee: BASE_FEE,
      networkPassphrase: stellarConfig.networkPassphrase,
      timebounds: { minTime: 0, maxTime: deadline },
    })
      .addOperation(
        Operation.payment({ destination: talentPublicKey, asset: usdcAsset, amount })
      )
      .build();

    const refundTx = new TransactionBuilder(escrowAccount, {
      fee: BASE_FEE,
      networkPassphrase: stellarConfig.networkPassphrase,
      timebounds: { minTime: deadline + 1, maxTime: 0 },
    })
      .addOperation(
        Operation.payment({ destination: hostPublicKey, asset: usdcAsset, amount })
      )
      .build();

    return {
      paymentTxXDR: paymentTx.toXDR(),
      paymentTxHash: paymentTx.hash().toString('hex'),
      refundTxXDR: refundTx.toXDR(),
      refundTxHash: refundTx.hash().toString('hex'),
      deadline,
    };
  }

  // ─── Sprint 2: Release Payment ────────────────────────────────────────────────

  async getPaymentXDR(jobId: string): Promise<{ paymentTxXDR: string; escrowPublicKey: string }> {
    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);
    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new Error(`Escrow is not in FUNDED status (current: ${escrow.status})`);
    }
    if (!escrow.payment_tx_xdr) throw new Error('Payment XDR not available');
    return { paymentTxXDR: escrow.payment_tx_xdr, escrowPublicKey: escrow.escrow_public_key };
  }

  async releasePayment(jobId: string, hostSignedXDR: string): Promise<string> {
    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);
    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new Error(`Cannot release: escrow status is ${escrow.status}`);
    }

    const arbiterKeypair = StellarUtil.getArbiterKeypair();
    const treasuryKeypair = StellarUtil.getTreasuryKeypair();

    const innerTx = TransactionBuilder.fromXDR(
      hostSignedXDR,
      stellarConfig.networkPassphrase
    ) as Transaction;
    innerTx.sign(arbiterKeypair);

    // FeeBump: treasury pays the fee so escrow account needs zero XLM
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      treasuryKeypair,
      FEE_BUMP_FEE,
      innerTx,
      stellarConfig.networkPassphrase
    );
    feeBumpTx.sign(treasuryKeypair);

    const result = await stellarServer.submitTransaction(feeBumpTx);

    await StellarEscrowModel.updateStatus(jobId, EscrowStatus.COMPLETED, {
      release_tx_hash: result.hash,
    });

    return result.hash;
  }

  // ─── Sprint 2: Refund ─────────────────────────────────────────────────────────

  async getRefundXDR(jobId: string): Promise<{ refundTxXDR: string; escrowPublicKey: string; deadline: number }> {
    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);
    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new Error(`Escrow is not in FUNDED status (current: ${escrow.status})`);
    }
    if (!escrow.refund_tx_xdr) throw new Error('Refund XDR not available');
    return {
      refundTxXDR: escrow.refund_tx_xdr,
      escrowPublicKey: escrow.escrow_public_key,
      deadline: escrow.deadline || 0,
    };
  }

  async refundEscrow(jobId: string, hostSignedXDR: string): Promise<string> {
    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);
    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new Error(`Cannot refund: escrow status is ${escrow.status}`);
    }

    const now = Math.floor(Date.now() / 1000);
    if (escrow.deadline && now < escrow.deadline) {
      throw new Error(
        `Refund not available yet. Deadline: ${new Date(escrow.deadline * 1000).toISOString()}`
      );
    }

    const arbiterKeypair = StellarUtil.getArbiterKeypair();
    const treasuryKeypair = StellarUtil.getTreasuryKeypair();

    const innerTx = TransactionBuilder.fromXDR(
      hostSignedXDR,
      stellarConfig.networkPassphrase
    ) as Transaction;
    innerTx.sign(arbiterKeypair);

    // FeeBump: treasury pays the fee so escrow account needs zero XLM
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      treasuryKeypair,
      FEE_BUMP_FEE,
      innerTx,
      stellarConfig.networkPassphrase
    );
    feeBumpTx.sign(treasuryKeypair);

    const result = await stellarServer.submitTransaction(feeBumpTx);

    await StellarEscrowModel.updateStatus(jobId, EscrowStatus.REFUNDED, {
      refund_close_tx_hash: result.hash,
    });

    return result.hash;
  }

  // ─── Sprint 2: Status ─────────────────────────────────────────────────────────

  async getEscrowStatus(jobId: string): Promise<EscrowStatusDto> {
    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);

    let balance = '0';
    let signers: SignerDto[] = [];
    let thresholds = { low: 0, medium: 2, high: 2, masterWeight: 1 };

    try {
      const account = await StellarUtil.loadAccount(escrow.escrow_public_key);
      balance = account.balances.find((b: any) => b.asset_code === 'USDC')?.balance || '0';
      signers = account.signers.map((s: any) => ({
        publicKey: s.key,
        weight: s.weight,
        type: this.determineSignerType(s.key, escrow),
      }));
      thresholds = {
        low: account.thresholds.low_threshold,
        medium: account.thresholds.med_threshold,
        high: account.thresholds.high_threshold,
        masterWeight:
          account.signers.find((s: any) => s.key === escrow.escrow_public_key)?.weight || 0,
      };
    } catch {
      // Account may be merged/closed after release/refund — use DB data
    }

    const isFunded = escrow.status === EscrowStatus.FUNDED;
    const isDisputed = escrow.status === EscrowStatus.DISPUTED;

    const dto: EscrowStatusDto = {
      publicKey: escrow.escrow_public_key,
      hostPublicKey: escrow.host_public_key,
      talentPublicKey: escrow.talent_public_key,
      jobId: escrow.job_id,
      status: escrow.status,
      balance,
      lockedAmount: escrow.amount,
      signers,
      thresholds,
      createdAt: escrow.created_at,
    };

    if (escrow.deadline !== undefined) dto.deadline = escrow.deadline;
    if (isFunded && escrow.payment_tx_xdr) dto.paymentTxXDR = escrow.payment_tx_xdr;
    if (isFunded && escrow.refund_tx_xdr) dto.refundTxXDR = escrow.refund_tx_xdr;
    if (escrow.release_tx_hash) dto.releaseTxHash = escrow.release_tx_hash;
    if (escrow.refund_close_tx_hash) dto.refundCloseTxHash = escrow.refund_close_tx_hash;
    if (escrow.dispute_reason) dto.disputeReason = escrow.dispute_reason;
    if (escrow.dispute_initiator) dto.disputeInitiator = escrow.dispute_initiator;
    if (escrow.dispute_winner) dto.disputeWinner = escrow.dispute_winner;
    if (isDisputed && escrow.dispute_winner && escrow.dispute_resolution_xdr) {
      dto.disputeResolutionXDR = escrow.dispute_resolution_xdr;
    }
    if (escrow.dispute_closed_tx_hash) dto.disputeClosedTxHash = escrow.dispute_closed_tx_hash;

    return dto;
  }

  private determineSignerType(
    key: string,
    escrow: IStellarEscrow
  ): 'host' | 'talent' | 'arbiter' | 'preauth' {
    if (key === escrow.host_public_key) return 'host';
    if (key === escrow.talent_public_key) return 'talent';
    if (key === escrow.arbiter_public_key) return 'arbiter';
    return 'preauth';
  }

  // ─── Sprint 3: Cron — auto-refund expired escrows ────────────────────────────

  async runExpiredEscrows(): Promise<{ processed: number; failed: number; results: Array<{ jobId: string; status: 'refunded' | 'error'; txHash?: string; error?: string }> }> {
    const expired = await StellarEscrowModel.findExpiredEscrows();
    const results: Array<{ jobId: string; status: 'refunded' | 'error'; txHash?: string; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const escrow of expired) {
      try {
        if (!escrow.refund_tx_xdr) throw new Error('refund_tx_xdr missing');
        if (!escrow.secret_key_encrypted) throw new Error('escrow secret key missing');

        const arbiterKeypair = StellarUtil.getArbiterKeypair();
        const treasuryKeypair = StellarUtil.getTreasuryKeypair();
        const escrowSecret = Buffer.from(escrow.secret_key_encrypted, 'base64').toString('utf8');
        const escrowKeypair = Keypair.fromSecret(escrowSecret);

        const innerTx = TransactionBuilder.fromXDR(
          escrow.refund_tx_xdr,
          stellarConfig.networkPassphrase
        ) as Transaction;

        // arbiter (w=1) + escrow master (w=1) = medThreshold=2 met
        innerTx.sign(arbiterKeypair);
        innerTx.sign(escrowKeypair);

        const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
          treasuryKeypair,
          FEE_BUMP_FEE,
          innerTx,
          stellarConfig.networkPassphrase
        );
        feeBumpTx.sign(treasuryKeypair);

        const result = await stellarServer.submitTransaction(feeBumpTx);

        await StellarEscrowModel.updateStatus(escrow.job_id, EscrowStatus.REFUNDED, {
          refund_close_tx_hash: result.hash,
        });

        results.push({ jobId: escrow.job_id, status: 'refunded', txHash: result.hash });
        processed++;
      } catch (err: any) {
        const errMsg = err?.response?.data?.extras?.result_codes
          ? JSON.stringify(err.response.data.extras.result_codes)
          : err.message;
        console.error(`[cron] Failed to auto-refund escrow ${escrow.job_id}: ${errMsg}`);
        results.push({ jobId: escrow.job_id, status: 'error', error: errMsg });
        failed++;
      }
    }

    return { processed, failed, results };
  }

  // ─── Sprint 3: Dispute Flow ───────────────────────────────────────────────────

  async openDispute(dto: OpenDisputeDto): Promise<void> {
    const escrow = await StellarEscrowModel.findByJobId(dto.jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${dto.jobId}`);
    if (escrow.status !== EscrowStatus.FUNDED) {
      throw new Error(`Cannot open dispute: escrow status is ${escrow.status}`);
    }

    await StellarEscrowModel.updateStatus(dto.jobId, EscrowStatus.DISPUTED, {
      dispute_reason: dto.reason,
      dispute_initiator: dto.initiator,
      dispute_opened_at: new Date(),
    });
  }

  async listDisputes(): Promise<EscrowStatusDto[]> {
    const escrows = await StellarEscrowModel.findDisputed();
    return Promise.all(escrows.map((e) => this.getEscrowStatus(e.job_id)));
  }

  async resolveDispute(dto: ResolveDisputeDto): Promise<DisputeResolutionDto> {
    const escrow = await StellarEscrowModel.findByJobId(dto.jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${dto.jobId}`);
    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new Error(`Cannot resolve: escrow status is ${escrow.status}`);
    }

    const arbiterKeypair = StellarUtil.getArbiterKeypair();
    const usdcAsset = StellarUtil.getUSDCAsset();

    let innerTx: Transaction;
    let winnerPublicKey: string;

    if (dto.winner === 'TALENT') {
      // Use existing payment_xdr (escrow → talent), arbiter adds sig weight=1
      if (!escrow.payment_tx_xdr) throw new Error('Payment XDR not available');
      innerTx = TransactionBuilder.fromXDR(
        escrow.payment_tx_xdr,
        stellarConfig.networkPassphrase
      ) as Transaction;
      winnerPublicKey = escrow.talent_public_key;
    } else {
      // winner = HOST: build fresh payment TX to host (no TimeBound restriction)
      // This works before or after deadline, unlike the pre-auth refund_xdr
      const escrowAccount = await StellarUtil.loadAccount(escrow.escrow_public_key);
      innerTx = new TransactionBuilder(escrowAccount, {
        fee: BASE_FEE,
        networkPassphrase: stellarConfig.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: escrow.host_public_key,
            asset: usdcAsset,
            amount: escrow.amount,
          })
        )
        .setTimeout(stellarConfig.defaults.timeout)
        .build();
      winnerPublicKey = escrow.host_public_key;
    }

    // Arbiter signs — contributes weight=1 toward medThreshold=2
    innerTx.sign(arbiterKeypair);
    const disputeResolutionXDR = innerTx.toXDR();

    // Persist: winner + arbiter-signed XDR ready for winner to countersign
    await StellarEscrowModel.updateStatus(dto.jobId, EscrowStatus.DISPUTED, {
      dispute_winner: dto.winner,
      dispute_resolution_xdr: disputeResolutionXDR,
    });

    return { disputeResolutionXDR, winnerPublicKey, winner: dto.winner };
  }

  async claimDispute(jobId: string, winnerSignedXDR: string): Promise<string> {
    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);
    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new Error(`Cannot claim: escrow status is ${escrow.status}`);
    }
    if (!escrow.dispute_winner) {
      throw new Error('Dispute has not been resolved by arbiter yet');
    }

    const treasuryKeypair = StellarUtil.getTreasuryKeypair();

    // winnerSignedXDR already has arbiter sig from resolveDispute + winner sig added
    const innerTx = TransactionBuilder.fromXDR(
      winnerSignedXDR,
      stellarConfig.networkPassphrase
    ) as Transaction;

    // FeeBump: treasury pays fee (escrow has 0 XLM)
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      treasuryKeypair,
      FEE_BUMP_FEE,
      innerTx,
      stellarConfig.networkPassphrase
    );
    feeBumpTx.sign(treasuryKeypair);

    const result = await stellarServer.submitTransaction(feeBumpTx);

    const finalStatus =
      escrow.dispute_winner === 'TALENT' ? EscrowStatus.COMPLETED : EscrowStatus.REFUNDED;

    await StellarEscrowModel.updateStatus(jobId, finalStatus, {
      dispute_closed_tx_hash: result.hash,
    });

    return result.hash;
  }
}
