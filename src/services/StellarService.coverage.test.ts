/**
 * Coverage: StellarService — caminhos não cobertos pelo business-logic.test.ts
 *
 * Usa jest.spyOn nos métodos estáticos de StellarEscrowModel e StellarUtil
 * para controle preciso por teste — sem risco de mock leaking.
 *
 * Cobre:
 *  - createEscrow: public key inválido (linhas 35, 38)
 *  - getPaymentXDR: status != FUNDED e XDR ausente (linhas 212, 225)
 *  - getRefundXDR: status != FUNDED e XDR ausente
 *  - getEscrowStatus: happy path (DB + Horizon mock) e Horizon offline
 *  - getEscrowStatus: determineSignerType para todos os tipos
 *  - refundEscrow: deadline ainda no futuro (linha 271)
 *  - runExpiredEscrows: sem escrows expirados
 */

// ── Env vars antes de qualquer import ────────────────────────────────────────
process.env['JWT_SECRET'] = 'test-jwt-secret-32chars-for-jest!!';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test';
process.env['CRON_SECRET'] = 'test-cron-secret';
process.env['EVM_PRIVATE_KEY'] = '0x0000000000000000000000000000000000000000000000000000000000000001';
process.env['SOLANA_PRIVATE_KEY'] = 'test-solana-key';
process.env['SUI_PRIVATE_KEY'] = 'test-sui-key';
process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = 'deadbeef'.repeat(8);
process.env['PORT'] = '0';
process.env['STELLAR_NETWORK'] = 'testnet';

// ── jest.mock é hoisted — factory roda antes de qualquer code do arquivo ──────

jest.mock('../config/stellar', () => {
  const { Keypair, Networks } = jest.requireActual('@stellar/stellar-sdk');
  const treasuryKp = Keypair.random();
  const arbiterKp = Keypair.random();
  const mockLoadAccount = jest.fn();
  const mockSubmitTransaction = jest.fn();

  return {
    stellarConfig: {
      network: 'testnet',
      networkPassphrase: Networks.TESTNET,
      horizonUrl: 'https://horizon-testnet.stellar.org',
      usdc: {
        code: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      },
      treasury: { publicKey: treasuryKp.publicKey(), secretKey: treasuryKp.secret() },
      arbiter: { publicKey: arbiterKp.publicKey(), secretKey: arbiterKp.secret() },
      defaults: { baseFee: '100', timeout: 180, deadlineDays: 15 },
    },
    stellarServer: {
      loadAccount: mockLoadAccount,
      submitTransaction: mockSubmitTransaction,
    },
    __mockLoadAccount: mockLoadAccount,
    __mockSubmitTransaction: mockSubmitTransaction,
    __treasuryKp: treasuryKp,
    __arbiterKp: arbiterKp,
  };
});

jest.mock('../config/database', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
  getBountiesDB: jest.fn().mockResolvedValue({
    collection: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
      insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      countDocuments: jest.fn().mockResolvedValue(0),
      createIndex: jest.fn().mockResolvedValue('index'),
    }),
  }),
  ensureConnection: jest.fn().mockResolvedValue(undefined),
  ensureIndexes: jest.fn().mockResolvedValue(undefined),
}));

import { Keypair } from '@stellar/stellar-sdk';
import { StellarService } from '../services/StellarService';
import { StellarEscrowModel } from '../models/StellarEscrow';
import { StellarUtil } from '../utils/stellar.util';
import { EscrowStatus } from '../dtos/stellar.dto';
import { encryptSecret } from '../utils/stellar-crypto';

const configMock = require('../config/stellar');
const mockHorizonLoadAccount = configMock.__mockLoadAccount as jest.Mock;

// ── Test keypairs ─────────────────────────────────────────────────────────────
const HOST_KP = Keypair.random();
const TALENT_KP = Keypair.random();
const ESCROW_KP = Keypair.random();
const ARBITER_KP = configMock.__arbiterKp as Keypair;

process.env['STELLAR_TREASURY_PUBLIC_KEY'] = (configMock.__treasuryKp as Keypair).publicKey();
process.env['STELLAR_ARBITER_PUBLIC_KEY'] = ARBITER_KP.publicKey();

function makeEscrow(overrides: Partial<any> = {}): any {
  return {
    _id: 'oid',
    job_id: 'job-001',
    escrow_public_key: ESCROW_KP.publicKey(),
    host_public_key: HOST_KP.publicKey(),
    talent_public_key: TALENT_KP.publicKey(),
    arbiter_public_key: ARBITER_KP.publicKey(),
    amount: '10',
    asset_code: 'USDC',
    status: EscrowStatus.FUNDED,
    payment_tx_xdr: 'xdr-payment',
    payment_tx_hash: 'hash-payment-abc',
    refund_tx_xdr: 'xdr-refund',
    refund_tx_hash: 'hash-refund-abc',
    deadline: Math.floor(Date.now() / 1000) + 86400,
    stellar_tx_hash: 'setup-hash',
    secret_key_encrypted: encryptSecret(ESCROW_KP.secret()),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const service = new StellarService();

// Use jest.spyOn on the static model methods for per-test control
let spyFindByJobId: jest.SpyInstance;
let spyFindExpired: jest.SpyInstance;
let spyUpdateStatus: jest.SpyInstance;

beforeEach(() => {
  // Reset Horizon server mock
  mockHorizonLoadAccount.mockReset();

  // Spy on StellarEscrowModel static methods — restored after each test by afterEach
  spyFindByJobId = jest.spyOn(StellarEscrowModel, 'findByJobId').mockResolvedValue(null);
  spyFindExpired = jest.spyOn(StellarEscrowModel, 'findExpiredEscrows').mockResolvedValue([]);
  spyUpdateStatus = jest.spyOn(StellarEscrowModel, 'updateStatus').mockResolvedValue(undefined as any);
});

afterEach(() => {
  spyFindByJobId.mockRestore();
  spyFindExpired.mockRestore();
  spyUpdateStatus.mockRestore();
});

// ─── createEscrow — invalid public keys ──────────────────────────────────────

describe('createEscrow — public key validation (SEC-OPEN-003 input guards)', () => {
  it('throws "Invalid host public key" when hostPublicKey is not a valid G-key', async () => {
    spyFindByJobId.mockResolvedValue(null);

    await expect(
      service.createEscrow({
        jobId: 'job-badhost',
        hostPublicKey: 'not-a-valid-key',
        talentPublicKey: TALENT_KP.publicKey(),
        amount: '10',
        deadlineDays: 15,
      })
    ).rejects.toThrow('Invalid host public key');
  });

  it('throws "Invalid talent public key" when talentPublicKey is invalid', async () => {
    spyFindByJobId.mockResolvedValue(null);

    await expect(
      service.createEscrow({
        jobId: 'job-badtalent',
        hostPublicKey: HOST_KP.publicKey(),
        talentPublicKey: 'not-a-key-either',
        amount: '10',
        deadlineDays: 15,
      })
    ).rejects.toThrow('Invalid talent public key');
  });
});

// ─── getPaymentXDR — error paths ─────────────────────────────────────────────

describe('getPaymentXDR — error paths', () => {
  it('throws "Escrow not found" when no escrow exists for jobId', async () => {
    spyFindByJobId.mockResolvedValue(null);

    await expect(
      service.getPaymentXDR('job-nonexistent', HOST_KP.publicKey())
    ).rejects.toThrow(/Escrow not found/);
  });

  it('throws when escrow status is not FUNDED', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ status: EscrowStatus.COMPLETED }));

    await expect(
      service.getPaymentXDR('job-001', HOST_KP.publicKey())
    ).rejects.toThrow(/not in FUNDED status/);
  });

  it('throws "Payment XDR not available" when payment_tx_xdr is missing', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ payment_tx_xdr: undefined }));

    await expect(
      service.getPaymentXDR('job-001', HOST_KP.publicKey())
    ).rejects.toThrow('Payment XDR not available');
  });
});

// ─── getRefundXDR — error paths ──────────────────────────────────────────────

describe('getRefundXDR — error paths', () => {
  it('throws when escrow status is not FUNDED', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ status: EscrowStatus.REFUNDED }));

    await expect(
      service.getRefundXDR('job-001', HOST_KP.publicKey())
    ).rejects.toThrow(/not in FUNDED status/);
  });

  it('throws "Refund XDR not available" when refund_tx_xdr is missing', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow({ refund_tx_xdr: undefined }));

    await expect(
      service.getRefundXDR('job-001', HOST_KP.publicKey())
    ).rejects.toThrow('Refund XDR not available');
  });

  it('returns XDR, escrow public key, and deadline on success', async () => {
    const escrow = makeEscrow();
    spyFindByJobId.mockResolvedValue(escrow);

    const result = await service.getRefundXDR('job-001', HOST_KP.publicKey());

    expect(result.refundTxXDR).toBe('xdr-refund');
    expect(result.escrowPublicKey).toBe(ESCROW_KP.publicKey());
    expect(result.deadline).toBe(escrow.deadline);
  });
});

// ─── refundEscrow — deadline still in future ─────────────────────────────────

describe('refundEscrow — deadline not yet passed', () => {
  it('throws when deadline is still in the future', async () => {
    const futureDeadline = Math.floor(Date.now() / 1000) + 9999;
    spyFindByJobId.mockResolvedValue(makeEscrow({ deadline: futureDeadline }));

    await expect(
      service.refundEscrow('job-001', 'any-xdr', HOST_KP.publicKey())
    ).rejects.toThrow(/Refund not available yet/);
  });

  it('passes the deadline check when deadline has already passed', async () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 100;
    spyFindByJobId.mockResolvedValue(makeEscrow({ deadline: pastDeadline }));

    // After deadline passes, it proceeds to XDR parsing — fails on invalid XDR, not deadline
    try {
      await service.refundEscrow('job-001', 'invalid-xdr', HOST_KP.publicKey());
    } catch (err: any) {
      expect(err.message).not.toMatch(/Refund not available yet/);
    }
  });
});

// ─── getEscrowStatus — happy path ────────────────────────────────────────────

describe('getEscrowStatus — happy path with Horizon data', () => {
  function makeMockAccount(extraSigners?: any[]) {
    return {
      balances: [
        { asset_code: 'USDC', balance: '100.00' },
        { asset_type: 'native', balance: '0.00' },
      ],
      signers: [
        { key: HOST_KP.publicKey(), weight: 1 },
        { key: TALENT_KP.publicKey(), weight: 1 },
        { key: ARBITER_KP.publicKey(), weight: 1 },
        { key: ESCROW_KP.publicKey(), weight: 0 },
        ...(extraSigners || []),
      ],
      thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 2 },
    };
  }

  it('returns correct balance and signers from Horizon', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    mockHorizonLoadAccount.mockResolvedValue(makeMockAccount());

    const dto = await service.getEscrowStatus('job-001');

    expect(dto.balance).toBe('100.00');
    expect(dto.signers).toHaveLength(4);
    expect(dto.signers.find((s) => s.publicKey === HOST_KP.publicKey())?.type).toBe('host');
    expect(dto.signers.find((s) => s.publicKey === TALENT_KP.publicKey())?.type).toBe('talent');
    expect(dto.signers.find((s) => s.publicKey === ARBITER_KP.publicKey())?.type).toBe('arbiter');
    expect(dto.signers.find((s) => s.publicKey === ESCROW_KP.publicKey())?.type).toBe('preauth');
  });

  it('returns FUNDED status with payment/refund XDRs in the DTO', async () => {
    const escrow = makeEscrow();
    spyFindByJobId.mockResolvedValue(escrow);
    mockHorizonLoadAccount.mockResolvedValue(makeMockAccount());

    const dto = await service.getEscrowStatus('job-001');

    expect(dto.status).toBe(EscrowStatus.FUNDED);
    expect(dto.paymentTxXDR).toBe('xdr-payment');
    expect(dto.refundTxXDR).toBe('xdr-refund');
    expect(dto.deadline).toBe(escrow.deadline);
  });

  it('thresholds: medium=2, high=2, masterWeight=0 (escrow signer weight)', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    mockHorizonLoadAccount.mockResolvedValue(makeMockAccount());

    const dto = await service.getEscrowStatus('job-001');

    expect(dto.thresholds.medium).toBe(2);
    expect(dto.thresholds.high).toBe(2);
    expect(dto.thresholds.masterWeight).toBe(0);
  });

  it('identifies "preauth" type for unknown signers (preauth hash keys)', async () => {
    const unknownKp = Keypair.random();
    spyFindByJobId.mockResolvedValue(makeEscrow());
    mockHorizonLoadAccount.mockResolvedValue(
      makeMockAccount([{ key: unknownKp.publicKey(), weight: 1 }])
    );

    const dto = await service.getEscrowStatus('job-001');
    expect(dto.signers.find((s) => s.publicKey === unknownKp.publicKey())?.type).toBe('preauth');
  });

  it('sets dispute fields when escrow is DISPUTED', async () => {
    const escrow = makeEscrow({
      status: EscrowStatus.DISPUTED,
      dispute_reason: 'No delivery',
      dispute_initiator: 'HOST',
      dispute_winner: 'TALENT',
      dispute_resolution_xdr: 'resolve-xdr',
    });
    spyFindByJobId.mockResolvedValue(escrow);
    mockHorizonLoadAccount.mockResolvedValue(makeMockAccount());

    const dto = await service.getEscrowStatus('job-001');

    expect(dto.disputeReason).toBe('No delivery');
    expect(dto.disputeInitiator).toBe('HOST');
    expect(dto.disputeWinner).toBe('TALENT');
    expect(dto.disputeResolutionXDR).toBe('resolve-xdr');
  });

  it('does not include paymentTxXDR/refundTxXDR for non-FUNDED escrows', async () => {
    const escrow = makeEscrow({
      status: EscrowStatus.COMPLETED,
      release_tx_hash: 'tx-release',
    });
    spyFindByJobId.mockResolvedValue(escrow);
    mockHorizonLoadAccount.mockRejectedValue(new Error('Account merged'));

    const dto = await service.getEscrowStatus('job-001');

    expect(dto.paymentTxXDR).toBeUndefined();
    expect(dto.refundTxXDR).toBeUndefined();
    expect(dto.releaseTxHash).toBe('tx-release');
  });
});

// ─── getEscrowStatus — Horizon offline ───────────────────────────────────────

describe('getEscrowStatus — Horizon offline (graceful fallback)', () => {
  it('returns balance="0" and empty signers when Horizon loadAccount fails', async () => {
    spyFindByJobId.mockResolvedValue(makeEscrow());
    mockHorizonLoadAccount.mockRejectedValue(new Error('Horizon unavailable'));

    const dto = await service.getEscrowStatus('job-001');

    expect(dto.balance).toBe('0');
    expect(dto.signers).toHaveLength(0);
    expect(dto.status).toBe(EscrowStatus.FUNDED);
  });

  it('throws when escrow is not found in DB', async () => {
    spyFindByJobId.mockResolvedValue(null);

    await expect(service.getEscrowStatus('job-not-found')).rejects.toThrow(
      /Escrow not found for job job-not-found/
    );
  });
});

// ─── runExpiredEscrows ───────────────────────────────────────────────────────

describe('runExpiredEscrows', () => {
  it('returns processed=0 and failed=0 when no escrows have expired', async () => {
    spyFindExpired.mockResolvedValue([]);

    const result = await service.runExpiredEscrows();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('counts as failed when refund_tx_xdr is missing', async () => {
    const escrow = makeEscrow({ refund_tx_xdr: undefined });
    spyFindExpired.mockResolvedValue([escrow]);

    const result = await service.runExpiredEscrows();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0]).toMatchObject({
      jobId: 'job-001',
      status: 'error',
      error: 'refund_tx_xdr missing',
    });
  });

  it('counts as failed when secret_key_encrypted is missing', async () => {
    const escrow = makeEscrow({ secret_key_encrypted: undefined });
    spyFindExpired.mockResolvedValue([escrow]);

    const result = await service.runExpiredEscrows();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0]).toMatchObject({
      jobId: 'job-001',
      status: 'error',
      error: 'escrow secret key missing',
    });
  });

  it('processes multiple escrows and tracks per-escrow results', async () => {
    const escrow1 = makeEscrow({ job_id: 'job-A', refund_tx_xdr: undefined });
    const escrow2 = makeEscrow({ job_id: 'job-B', secret_key_encrypted: undefined });
    spyFindExpired.mockResolvedValue([escrow1, escrow2]);

    const result = await service.runExpiredEscrows();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]?.jobId).toBe('job-A');
    expect(result.results[1]?.jobId).toBe('job-B');
  });

  it('catches XDR parse errors and records them as failed', async () => {
    // Provide a malformed XDR — TransactionBuilder.fromXDR will throw
    const escrow = makeEscrow({ refund_tx_xdr: 'not-valid-base64-xdr!!' });
    spyFindExpired.mockResolvedValue([escrow]);

    const result = await service.runExpiredEscrows();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0]?.status).toBe('error');
    expect(result.results[0]?.error).toBeDefined();
  });
});
