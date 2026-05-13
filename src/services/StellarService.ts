import {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Transaction,
} from '@stellar/stellar-sdk';

import { stellarConfig, stellarServer } from '../config/stellar';
import { StellarUtil } from '../utils/stellar.util';
import {
  CreateEscrowDto,
  PreAuthTxDto,
  EscrowStatusDto,
  EscrowStatus,
  SignerDto,
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

    // Deserialize the host-signed transaction and add arbiter signature
    const tx = TransactionBuilder.fromXDR(
      hostSignedXDR,
      stellarConfig.networkPassphrase
    ) as Transaction;
    tx.sign(arbiterKeypair);

    const result = await stellarServer.submitTransaction(tx);

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

    const tx = TransactionBuilder.fromXDR(
      hostSignedXDR,
      stellarConfig.networkPassphrase
    ) as Transaction;
    tx.sign(arbiterKeypair);

    const result = await stellarServer.submitTransaction(tx);

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

    return {
      publicKey: escrow.escrow_public_key,
      jobId: escrow.job_id,
      status: escrow.status,
      balance,
      signers,
      thresholds,
      deadline: escrow.deadline,
      paymentTxXDR: escrow.status === EscrowStatus.FUNDED ? escrow.payment_tx_xdr : undefined,
      refundTxXDR: escrow.status === EscrowStatus.FUNDED ? escrow.refund_tx_xdr : undefined,
      releaseTxHash: escrow.release_tx_hash,
      refundCloseTxHash: escrow.refund_close_tx_hash,
      createdAt: escrow.created_at,
    };
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
}
