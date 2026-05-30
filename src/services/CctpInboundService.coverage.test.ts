/**
 * Coverage: CctpInboundService — CCTP V2 inbound funding logic.
 *
 * Mocks config/stellar (so StellarUtil + cctp.config resolve to testnet) and
 * config/database. The Soroban relay (`submitMintAndForward`) and Iris HTTP
 * (`global.fetch`) are stubbed so no network is touched.
 *
 * Cobre:
 *  - assertEnabled gate (CCTP_ENABLED=false) em prepare/register/relay + cron
 *  - prepareInbound: happy path, encoding (mintRecipient/hookData/amount),
 *    erros (not found, status errado, caller não-autorizado, chain inválida,
 *    USDC não configurado p/ a rede)
 *  - registerBurn: happy path + erros
 *  - relayMint: status errado, attestation não pronta (404), mint completo
 *  - runPendingInboundMints: minted / pending / error
 */

process.env['JWT_SECRET'] = 'test-jwt-secret-32chars-for-jest!!';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test';
process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = 'deadbeef'.repeat(8);
process.env['STELLAR_NETWORK'] = 'testnet';
process.env['CCTP_ENABLED'] = 'true';

jest.mock('../config/stellar', () => {
  const { Keypair, Networks } = jest.requireActual('@stellar/stellar-sdk');
  const treasuryKp = Keypair.random();
  const arbiterKp = Keypair.random();
  return {
    stellarConfig: {
      network: 'testnet',
      networkPassphrase: Networks.TESTNET,
      horizonUrl: 'https://horizon-testnet.stellar.org',
      usdc: { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
      treasury: { publicKey: treasuryKp.publicKey(), secretKey: treasuryKp.secret() },
      arbiter: { publicKey: arbiterKp.publicKey(), secretKey: arbiterKp.secret() },
      defaults: { baseFee: '100', timeout: 180, deadlineDays: 15 },
    },
    stellarServer: { loadAccount: jest.fn(), submitTransaction: jest.fn() },
    __treasuryKp: treasuryKp,
    __arbiterKp: arbiterKp,
  };
});

jest.mock('../config/database', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
  getBountiesDB: jest.fn(),
}));

import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { CctpInboundService } from './CctpInboundService';
import { StellarEscrowModel } from '../models/StellarEscrow';
import { EscrowStatus } from '../dtos/stellar.dto';
import { cctpConfig, STELLAR_CCTP_DOMAIN } from '../config/cctp.config';

const HOST_KP = Keypair.random();
const ESCROW_KP = Keypair.random();
const OTHER_KP = Keypair.random();

function makeEscrow(overrides: Partial<any> = {}): any {
  return {
    job_id: 'job-cctp-1',
    escrow_public_key: ESCROW_KP.publicKey(),
    host_public_key: HOST_KP.publicKey(),
    talent_public_key: OTHER_KP.publicKey(),
    amount: '10',
    asset_code: 'USDC',
    status: EscrowStatus.CREATED,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const service = new CctpInboundService();

let spyFindByJobId: jest.SpyInstance;
let spyUpdateStatus: jest.SpyInstance;
let spyFindPending: jest.SpyInstance;

beforeEach(() => {
  cctpConfig.enabled = true;
  spyFindByJobId = jest.spyOn(StellarEscrowModel, 'findByJobId').mockResolvedValue(null);
  spyUpdateStatus = jest.spyOn(StellarEscrowModel, 'updateStatus').mockResolvedValue(true);
  spyFindPending = jest.spyOn(StellarEscrowModel, 'findPendingInboundMints').mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (global as any).fetch;
});

// ─── Feature gate ─────────────────────────────────────────────────────────────

describe('CCTP_ENABLED gate', () => {
  beforeEach(() => { cctpConfig.enabled = false; });

  it('prepareInbound throws when disabled', async () => {
    await expect(service.prepareInbound({ jobId: 'j', sourceChain: 'base' }))
      .rejects.toThrow(/disabled/);
  });

  it('registerBurn throws when disabled', async () => {
    await expect(service.registerBurn({ jobId: 'j', sourceChain: 'base', sourceTxHash: '0xabc' }))
      .rejects.toThrow(/disabled/);
  });

  it('relayMint throws when disabled', async () => {
    await expect(service.relayMint('j')).rejects.toThrow(/disabled/);
  });

  it('runPendingInboundMints is a no-op when disabled', async () => {
    const result = await service.runPendingInboundMints();
    expect(result).toEqual({ processed: 0, failed: 0, results: [] });
    expect(spyFindPending).not.toHaveBeenCalled();
  });
});

// ─── prepareInbound ───────────────────────────────────────────────────────────

describe('prepareInbound', () => {
  it('returns the burn parameters for a CREATED escrow', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());

    const res = await service.prepareInbound({ jobId: 'job-cctp-1', sourceChain: 'base' });

    expect(res.sourceChain).toBe('base');
    expect(res.sourceDomain).toBe(6);
    expect(res.destinationDomain).toBe(STELLAR_CCTP_DOMAIN);
    expect(res.maxFee).toBe('0');
    expect(res.escrowPublicKey).toBe(ESCROW_KP.publicKey());
    // mintRecipient = forwarder contract as bytes32; hookData = escrow account as bytes32
    expect(res.mintRecipient).toMatch(/^0x[0-9a-f]{64}$/);
    expect(res.hookData).toBe('0x' + Buffer.from(StrKey.decodeEd25519PublicKey(ESCROW_KP.publicKey())).toString('hex'));
    // funding method persisted as CCTP
    expect(spyUpdateStatus).toHaveBeenCalledWith('job-cctp-1', EscrowStatus.CREATED,
      expect.objectContaining({ funding_method: 'CCTP', inbound_source_domain: 6 }));
  });

  it('converts the escrow amount to 6-decimal base units', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ amount: '100.5' }));
    const res = await service.prepareInbound({ jobId: 'job-cctp-1', sourceChain: 'arbitrum' });
    expect(res.amount).toBe('100500000');
  });

  it('throws when the escrow is not found', async () => {
    spyFindByJobId.mockResolvedValue(null);
    await expect(service.prepareInbound({ jobId: 'nope', sourceChain: 'base' }))
      .rejects.toThrow(/not found/);
  });

  it('throws when the escrow is not awaiting funding', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ status: EscrowStatus.FUNDED }));
    await expect(service.prepareInbound({ jobId: 'job-cctp-1', sourceChain: 'base' }))
      .rejects.toThrow(/not awaiting funding/);
  });

  it('throws when the caller is not the host', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    await expect(service.prepareInbound({ jobId: 'job-cctp-1', sourceChain: 'base' }, OTHER_KP.publicKey()))
      .rejects.toThrow(/Unauthorized/);
  });

  it('throws on an unsupported source chain', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    await expect(service.prepareInbound({ jobId: 'job-cctp-1', sourceChain: 'dogechain' }))
      .rejects.toThrow(/Unsupported CCTP source chain/);
  });

  it('throws when USDC is not configured for the network (Sui testnet TODO)', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    await expect(service.prepareInbound({ jobId: 'job-cctp-1', sourceChain: 'sui' }))
      .rejects.toThrow(/not configured/);
  });
});

// ─── registerBurn ─────────────────────────────────────────────────────────────

describe('registerBurn', () => {
  it('moves a CREATED escrow to PENDING_INBOUND_MINT', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    const res = await service.registerBurn({ jobId: 'job-cctp-1', sourceChain: 'base', sourceTxHash: '0xburn' });
    expect(res.status).toBe(EscrowStatus.PENDING_INBOUND_MINT);
    expect(res.attestationStatus).toBe('PENDING');
    expect(spyUpdateStatus).toHaveBeenCalledWith('job-cctp-1', EscrowStatus.PENDING_INBOUND_MINT,
      expect.objectContaining({ inbound_source_tx_hash: '0xburn', inbound_attestation_status: 'PENDING' }));
  });

  it('rejects when the escrow status is not CREATED', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ status: EscrowStatus.PENDING_INBOUND_MINT }));
    await expect(service.registerBurn({ jobId: 'job-cctp-1', sourceChain: 'base', sourceTxHash: '0xburn' }))
      .rejects.toThrow(/Cannot register burn/);
  });

  it('rejects an unauthorized caller', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    await expect(service.registerBurn({ jobId: 'job-cctp-1', sourceChain: 'base', sourceTxHash: '0xburn' }, OTHER_KP.publicKey()))
      .rejects.toThrow(/Unauthorized/);
  });
});

// ─── relayMint ────────────────────────────────────────────────────────────────

describe('relayMint', () => {
  const pending = () => makeEscrow({
    status: EscrowStatus.PENDING_INBOUND_MINT,
    inbound_source_chain: 'base',
    inbound_source_domain: 6,
    inbound_source_tx_hash: '0xburn',
    inbound_attestation_status: 'PENDING',
  });

  it('rejects when the escrow is not pending an inbound mint', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ status: EscrowStatus.CREATED }));
    await expect(service.relayMint('job-cctp-1')).rejects.toThrow(/not pending an inbound mint/);
  });

  it('stays PENDING when the attestation is not ready (Iris 404)', async () => {
    spyFindByJobId.mockResolvedValue(pending());
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 404, ok: false });

    const res = await service.relayMint('job-cctp-1');

    expect(res.status).toBe(EscrowStatus.PENDING_INBOUND_MINT);
    expect(res.attestationStatus).toBe('PENDING');
    // no transition to FUNDED
    expect(spyUpdateStatus).not.toHaveBeenCalledWith('job-cctp-1', EscrowStatus.FUNDED, expect.anything());
  });

  it('relays the mint and moves to FUNDED when the attestation is complete', async () => {
    spyFindByJobId.mockResolvedValue(pending());
    (global as any).fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ messages: [{ status: 'complete', message: '0xmsg', attestation: '0xatt' }] }),
    });
    const spySubmit = jest
      .spyOn(service as any, 'submitMintAndForward')
      .mockResolvedValue('mint-tx-hash');

    const res = await service.relayMint('job-cctp-1');

    expect(spySubmit).toHaveBeenCalledWith('0xmsg', '0xatt');
    expect(res.status).toBe(EscrowStatus.FUNDED);
    expect(res.attestationStatus).toBe('COMPLETE');
    expect(res.mintTxHash).toBe('mint-tx-hash');
    expect(spyUpdateStatus).toHaveBeenCalledWith('job-cctp-1', EscrowStatus.FUNDED,
      expect.objectContaining({ inbound_mint_tx_hash: 'mint-tx-hash', inbound_attestation_status: 'COMPLETE' }));
  });
});

// ─── runPendingInboundMints (cron) ──────────────────────────────────────────────

describe('runPendingInboundMints', () => {
  const pending = (jobId: string) => makeEscrow({
    job_id: jobId,
    status: EscrowStatus.PENDING_INBOUND_MINT,
    inbound_source_domain: 6,
    inbound_source_tx_hash: '0xburn',
  });

  it('relays a ready mint (processed)', async () => {
    spyFindPending.mockResolvedValue([pending('job-a')]);
    (global as any).fetch = jest.fn().mockResolvedValue({
      status: 200, ok: true,
      json: async () => ({ messages: [{ status: 'complete', message: '0xm', attestation: '0xa' }] }),
    });
    jest.spyOn(service as any, 'submitMintAndForward').mockResolvedValue('hash-a');

    const result = await service.runPendingInboundMints();
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0]).toEqual({ jobId: 'job-a', status: 'minted', txHash: 'hash-a' });
  });

  it('leaves a not-ready mint pending', async () => {
    spyFindPending.mockResolvedValue([pending('job-b')]);
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 404, ok: false });

    const result = await service.runPendingInboundMints();
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results[0]).toEqual({ jobId: 'job-b', status: 'pending' });
  });

  it('records an error without aborting the batch', async () => {
    spyFindPending.mockResolvedValue([pending('job-c')]);
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ messages: [{ status: 'complete', message: '0xm', attestation: '0xa' }] }) });
    jest.spyOn(service as any, 'submitMintAndForward').mockRejectedValue(new Error('soroban boom'));

    const result = await service.runPendingInboundMints();
    expect(result.failed).toBe(1);
    expect(result.results[0]?.status).toBe('error');
    expect(result.results[0]?.error).toMatch(/soroban boom/);
  });
});
