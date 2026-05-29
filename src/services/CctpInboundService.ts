import {
  rpc,
  Contract,
  nativeToScVal,
  TransactionBuilder,
  BASE_FEE,
  StrKey,
} from '@stellar/stellar-sdk';
import { stellarConfig } from '../config/stellar';
import { cctpConfig, getSourceChain, STELLAR_CCTP_DOMAIN } from '../config/cctp.config';
import { StellarUtil } from '../utils/stellar.util';
import { StellarEscrowModel, IStellarEscrow } from '../models/StellarEscrow';
import {
  PrepareInboundDto,
  PrepareInboundResponseDto,
  RegisterBurnDto,
  InboundStatusDto,
  EscrowStatus,
} from '../dtos/stellar.dto';

const ZERO_BYTES32 = '0x' + '00'.repeat(32); // destinationCaller = anyone can relay
const USDC_BASE_DECIMALS = 6; // CCTP burns USDC in 6-decimal base units on every source chain
const RELAY_POLL_INTERVAL_MS = 2000;
const RELAY_POLL_MAX_TRIES = 30; // ~60s for the Soroban tx to land

const strip0x = (h: string): string => (h.startsWith('0x') ? h.slice(2) : h);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 32-byte Stellar public key / contract id as a 0x-prefixed bytes32. */
const toBytes32Hex = (raw: Buffer): string => '0x' + raw.toString('hex');

/**
 * Decimal USDC string ("100", "100.5") → integer base-units string in `decimals`
 * precision, without floating point. e.g. ("100.5", 6) → "100500000".
 */
function toBaseUnits(decimalAmount: string, decimals: number): string {
  const [whole, frac = ''] = decimalAmount.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const combined = ((whole || '0') + fracPadded).replace(/^0+/, '');
  return combined === '' ? '0' : combined;
}

interface IrisAttestation {
  message: string; // 0x-prefixed
  attestation: string; // 0x-prefixed
}

/**
 * CCTP V2 inbound funding: relays a host's cross-chain USDC burn into the escrow's
 * Stellar account. Source-chain burn is signed by the host's own wallet (the
 * backend never touches source keys); the backend only relays the mint by calling
 * the permissionless `mint_and_forward(message, attestation)` on the Soroban
 * CctpForwarder once Circle's Iris service has attested the burn.
 *
 * Entire subsystem is gated behind `CCTP_ENABLED` — inert until enabled per env.
 */
export class CctpInboundService {
  private sorobanServer(): rpc.Server {
    return new rpc.Server(cctpConfig.sorobanRpcUrl, {
      allowHttp: cctpConfig.sorobanRpcUrl.startsWith('http://'),
    });
  }

  private assertEnabled(): void {
    if (!cctpConfig.enabled) throw new Error('CCTP inbound funding is disabled');
  }

  // ─── Step 1: prepare the source-chain burn parameters for the frontend ────────

  async prepareInbound(
    dto: PrepareInboundDto,
    callerWallet?: string
  ): Promise<PrepareInboundResponseDto> {
    this.assertEnabled();

    const escrow = await StellarEscrowModel.findByJobId(dto.jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${dto.jobId}`);
    if (callerWallet && callerWallet !== escrow.host_public_key) {
      throw new Error('Unauthorized: only the escrow host can prepare inbound funding');
    }
    if (escrow.status !== EscrowStatus.CREATED) {
      throw new Error(`Escrow is not awaiting funding (current: ${escrow.status})`);
    }

    const chain = getSourceChain(dto.sourceChain);
    const burnToken = chain.usdc[cctpConfig.network];
    if (!burnToken) {
      throw new Error(`USDC address for ${chain.label} on ${cctpConfig.network} is not configured`);
    }

    // mintRecipient = the forwarder contract (USDC mints to it, then it forwards
    // to the escrow G-account encoded in hookData). hookData = raw 32-byte
    // ed25519 account id of the escrow account.
    const mintRecipient = toBytes32Hex(
      Buffer.from(StrKey.decodeContract(cctpConfig.contracts.cctpForwarder))
    );
    const hookData = toBytes32Hex(
      Buffer.from(StrKey.decodeEd25519PublicKey(escrow.escrow_public_key))
    );

    // Persist the chosen funding method so status/relay know this is a CCTP escrow.
    await StellarEscrowModel.updateStatus(dto.jobId, EscrowStatus.CREATED, {
      funding_method: 'CCTP',
      inbound_source_chain: chain.slug,
      inbound_source_domain: chain.domain,
    });

    return {
      jobId: dto.jobId,
      sourceChain: chain.slug,
      sourceDomain: chain.domain,
      destinationDomain: STELLAR_CCTP_DOMAIN,
      burnToken,
      amount: toBaseUnits(escrow.amount, USDC_BASE_DECIMALS),
      mintRecipient,
      destinationCaller: ZERO_BYTES32,
      hookData,
      maxFee: '0', // Standard finality charges no fee
      minFinalityThreshold: cctpConfig.defaultFinalityThreshold,
      escrowPublicKey: escrow.escrow_public_key,
    };
  }

  // ─── Step 2: host burned on the source chain — record it, wait for the mint ──

  async registerBurn(dto: RegisterBurnDto, callerWallet?: string): Promise<InboundStatusDto> {
    this.assertEnabled();

    const escrow = await StellarEscrowModel.findByJobId(dto.jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${dto.jobId}`);
    if (callerWallet && callerWallet !== escrow.host_public_key) {
      throw new Error('Unauthorized: only the escrow host can register the burn');
    }
    if (escrow.status !== EscrowStatus.CREATED) {
      throw new Error(`Cannot register burn: escrow status is ${escrow.status}`);
    }
    if (!dto.sourceTxHash) throw new Error('sourceTxHash is required');

    const chain = getSourceChain(dto.sourceChain);

    await StellarEscrowModel.updateStatus(dto.jobId, EscrowStatus.PENDING_INBOUND_MINT, {
      funding_method: 'CCTP',
      inbound_source_chain: chain.slug,
      inbound_source_domain: chain.domain,
      inbound_source_tx_hash: dto.sourceTxHash,
      inbound_attestation_status: 'PENDING',
    });

    return {
      jobId: dto.jobId,
      status: EscrowStatus.PENDING_INBOUND_MINT,
      attestationStatus: 'PENDING',
      sourceChain: chain.slug,
      sourceTxHash: dto.sourceTxHash,
    };
  }

  // ─── Step 3: relay the mint (on-demand) ──────────────────────────────────────

  async relayMint(jobId: string): Promise<InboundStatusDto> {
    this.assertEnabled();

    const escrow = await StellarEscrowModel.findByJobId(jobId);
    if (!escrow) throw new Error(`Escrow not found for job ${jobId}`);
    if (escrow.status !== EscrowStatus.PENDING_INBOUND_MINT) {
      throw new Error(`Escrow is not pending an inbound mint (current: ${escrow.status})`);
    }

    const outcome = await this.relayOne(escrow);
    return {
      jobId,
      status: outcome.relayed ? EscrowStatus.FUNDED : EscrowStatus.PENDING_INBOUND_MINT,
      attestationStatus: outcome.relayed ? 'COMPLETE' : 'PENDING',
      ...(escrow.inbound_source_chain ? { sourceChain: escrow.inbound_source_chain } : {}),
      ...(escrow.inbound_source_tx_hash ? { sourceTxHash: escrow.inbound_source_tx_hash } : {}),
      ...(outcome.mintTxHash ? { mintTxHash: outcome.mintTxHash } : {}),
    };
  }

  // ─── Cron: relay every escrow waiting on an attestation ──────────────────────

  async runPendingInboundMints(): Promise<{
    processed: number;
    failed: number;
    results: Array<{ jobId: string; status: 'minted' | 'pending' | 'error'; txHash?: string; error?: string }>;
  }> {
    const results: Array<{ jobId: string; status: 'minted' | 'pending' | 'error'; txHash?: string; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    if (!cctpConfig.enabled) return { processed, failed, results };

    const pending = await StellarEscrowModel.findPendingInboundMints();
    for (const escrow of pending) {
      try {
        const outcome = await this.relayOne(escrow);
        if (outcome.relayed) {
          results.push({ jobId: escrow.job_id, status: 'minted', txHash: outcome.mintTxHash! });
          processed++;
        } else {
          // Attestation not ready yet — leave it for the next run.
          results.push({ jobId: escrow.job_id, status: 'pending' });
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.error(`[cctp-cron] Failed to relay mint for escrow ${escrow.job_id}: ${errMsg}`);
        results.push({ jobId: escrow.job_id, status: 'error', error: errMsg });
        failed++;
      }
    }

    return { processed, failed, results };
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  /**
   * Polls Iris for the burn's attestation; if ready, submits `mint_and_forward`
   * and flips the escrow to FUNDED. Returns relayed=false (no throw) when the
   * attestation isn't available yet, so the cron can simply retry later.
   */
  private async relayOne(
    escrow: IStellarEscrow
  ): Promise<{ relayed: boolean; mintTxHash?: string }> {
    if (escrow.inbound_source_domain === undefined || !escrow.inbound_source_tx_hash) {
      throw new Error('inbound burn details missing (source domain / tx hash)');
    }

    const att = await this.fetchAttestation(
      escrow.inbound_source_domain,
      escrow.inbound_source_tx_hash
    );
    if (!att) return { relayed: false };

    const mintTxHash = await this.submitMintAndForward(att.message, att.attestation);

    await StellarEscrowModel.updateStatus(escrow.job_id, EscrowStatus.FUNDED, {
      inbound_attestation_status: 'COMPLETE',
      inbound_mint_tx_hash: mintTxHash,
      fund_tx_hash: mintTxHash,
    });

    return { relayed: true, mintTxHash };
  }

  /**
   * Circle Iris V2: GET /v2/messages/{sourceDomain}?transactionHash={burnTx}.
   * Returns the message + attestation once status === 'complete', else null.
   */
  private async fetchAttestation(
    sourceDomain: number,
    burnTxHash: string
  ): Promise<IrisAttestation | null> {
    const url = `${cctpConfig.irisBaseUrl}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`;
    const headers: Record<string, string> = {};
    if (cctpConfig.irisApiKey) headers['Authorization'] = `Bearer ${cctpConfig.irisApiKey}`;

    const resp = await fetch(url, { headers });
    if (resp.status === 404) return null; // not indexed yet
    if (!resp.ok) throw new Error(`Iris error ${resp.status}: ${await resp.text()}`);

    const data: any = await resp.json();
    const msg = data?.messages?.[0];
    if (!msg || msg.status !== 'complete' || !msg.message || !msg.attestation) return null;

    return { message: msg.message, attestation: msg.attestation };
  }

  /**
   * Permissionless relay: invoke `mint_and_forward(message, attestation)` on the
   * Soroban CctpForwarder. Treasury is the source account and pays the fee; the
   * function takes no `caller`, so no extra auth/signing is required.
   */
  private async submitMintAndForward(message: string, attestation: string): Promise<string> {
    const server = this.sorobanServer();
    const treasury = StellarUtil.getTreasuryKeypair();
    const forwarder = new Contract(cctpConfig.contracts.cctpForwarder);

    const source = await server.getAccount(treasury.publicKey());

    const messageVal = nativeToScVal(Buffer.from(strip0x(message), 'hex'), { type: 'bytes' });
    const attestationVal = nativeToScVal(Buffer.from(strip0x(attestation), 'hex'), { type: 'bytes' });

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: stellarConfig.networkPassphrase,
    })
      .addOperation(forwarder.call('mint_and_forward', messageVal, attestationVal))
      .setTimeout(180)
      .build();

    // prepareTransaction simulates + assembles footprint and resource fees.
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(treasury);

    const sent = await server.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      throw new Error(`mint_and_forward submit failed: ${JSON.stringify(sent.errorResult)}`);
    }

    // Poll until the tx lands.
    for (let i = 0; i < RELAY_POLL_MAX_TRIES; i++) {
      const got = await server.getTransaction(sent.hash);
      if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
      if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`mint_and_forward failed on-chain: ${JSON.stringify(got)}`);
      }
      await sleep(RELAY_POLL_INTERVAL_MS);
    }
    throw new Error(`mint_and_forward not confirmed after ${RELAY_POLL_MAX_TRIES} tries (hash: ${sent.hash})`);
  }
}
