import { Keypair } from '@stellar/stellar-sdk';
import { StellarService } from '../../services/StellarService';
import { StellarUtil } from '../../utils/stellar.util';
import { StellarEscrowModel } from '../../models/StellarEscrow';
import { EscrowStatus } from '../../dtos/stellar.dto';
import { CreateEscrowDto } from '../../dtos/stellar.dto';

// ─── Mock heavy dependencies ──────────────────────────────────────────────────
// Keys are generated inside the factory so they always have valid checksums.

jest.mock('../../utils/stellar-crypto', () => ({
  encryptSecret: jest.fn((secret: string) => `encrypted:${secret}`),
  decryptSecret: jest.fn((stored: string) => stored.replace('encrypted:', '')),
}));

jest.mock('../../config/stellar', () => {
  const { Keypair } = require('@stellar/stellar-sdk');
  const treasury = Keypair.random();
  const arbiter  = Keypair.random();
  return {
    stellarConfig: {
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      treasury: {
        publicKey: treasury.publicKey(),
        secretKey: treasury.secret(),
      },
      arbiter: {
        publicKey: arbiter.publicKey(),
        secretKey: arbiter.secret(),
      },
      usdc: {
        code: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      },
      defaults: {
        baseFee: '100',
        timeout: 180,
        deadlineDays: 15,
      },
    },
    stellarServer: {
      loadAccount: jest.fn(),
      submitTransaction: jest.fn(),
    },
  };
});

jest.mock('../../models/StellarEscrow', () => ({
  StellarEscrowModel: {
    create: jest.fn(),
    findByJobId: jest.fn(),
    findByPublicKey: jest.fn(),
    findByHostPublicKey: jest.fn(),
    findByTalentPublicKey: jest.fn(),
    updateStatus: jest.fn(),
    getStats: jest.fn(),
    findExpiredEscrows: jest.fn(),
  },
  EscrowStatus: {
    CREATED: 'CREATED',
    FUNDED: 'FUNDED',
    COMPLETED: 'COMPLETED',
    REFUNDED: 'REFUNDED',
    DISPUTED: 'DISPUTED',
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const treasuryKeypair = Keypair.random();
const hostKeypair = Keypair.random();
const talentKeypair = Keypair.random();
const escrowKeypair = Keypair.random();


function buildMockEscrowRecord(overrides = {}) {
  const arbiterPubKey = require('../../config/stellar').stellarConfig.arbiter.publicKey;
  return {
    _id: 'mock-id-001',
    job_id: 'job-123',
    escrow_public_key: escrowKeypair.publicKey(),
    host_public_key: hostKeypair.publicKey(),
    talent_public_key: talentKeypair.publicKey(),
    arbiter_public_key: arbiterPubKey,
    amount: '100',
    asset_code: 'USDC',
    status: 'FUNDED',
    payment_tx_xdr: 'mock-payment-xdr',
    payment_tx_hash: 'mock-payment-hash',
    refund_tx_xdr: 'mock-refund-xdr',
    refund_tx_hash: 'mock-refund-hash',
    deadline: Math.floor(Date.now() / 1000) + 15 * 86400,
    stellar_tx_hash: 'stellar-tx-hash-abc',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StellarService (integration – mocked network)', () => {
  let service: StellarService;
  let stellarServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StellarService();
    stellarServer = require('../../config/stellar').stellarServer;

    const arbiterPubKey = require('../../config/stellar').stellarConfig.arbiter.publicKey;
    const treasuryPubKey = require('../../config/stellar').stellarConfig.treasury.publicKey;

    const treasuryAccount = {
      id: treasuryPubKey,
      sequence: '100000000000',
      sequenceNumber() { return this.sequence; },
      incrementSequenceNumber() { this.sequence = String(BigInt(this.sequence) + 1n); },
      balances: [{ asset_code: 'USDC', balance: '500' }],
      signers: [{ key: treasuryPubKey, weight: 1 }],
      thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 2 },
    };

    const escrowAccount = {
      id: escrowKeypair.publicKey(),
      sequence: '200000000000',
      sequenceNumber() { return this.sequence; },
      incrementSequenceNumber() { this.sequence = String(BigInt(this.sequence) + 1n); },
      balances: [{ asset_code: 'USDC', balance: '100' }],
      signers: [
        { key: escrowKeypair.publicKey(), weight: 1 },
        { key: hostKeypair.publicKey(), weight: 1 },
        { key: talentKeypair.publicKey(), weight: 1 },
        { key: arbiterPubKey, weight: 1 },
      ],
      thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 2 },
    };

    stellarServer.loadAccount.mockImplementation(async (publicKey: string) => {
      if (publicKey === treasuryPubKey) {
        return {
          ...treasuryAccount,
          accountId() { return this.id; },
          sequenceNumber() { return this.sequence; },
          incrementSequenceNumber() { this.sequence = String(BigInt(this.sequence) + 1n); },
        };
      }
      return {
        ...escrowAccount,
        accountId() { return this.id; },
        sequenceNumber() { return this.sequence; },
        incrementSequenceNumber() { this.sequence = String(BigInt(this.sequence) + 1n); },
      };
    });

    stellarServer.submitTransaction.mockResolvedValue({
      hash: 'stellar-tx-hash-abc',
      successful: true,
    });

    (StellarEscrowModel.create as jest.Mock).mockResolvedValue(buildMockEscrowRecord());
  });

  // ─── createEscrow ──────────────────────────────────────────────────────────

  describe('createEscrow', () => {
    it('should reject an invalid host public key', async () => {
      const dto: CreateEscrowDto = {
        jobId: 'job-1',
        hostPublicKey: 'INVALID_KEY',
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
      };
      await expect(service.createEscrow(dto)).rejects.toThrow('Invalid host public key');
    });

    it('should reject an invalid talent public key', async () => {
      const dto: CreateEscrowDto = {
        jobId: 'job-1',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: 'BAD_KEY',
        amount: '100',
      };
      await expect(service.createEscrow(dto)).rejects.toThrow('Invalid talent public key');
    });

    it('should call stellarServer.submitTransaction once (setup tx only)', async () => {
      const dto: CreateEscrowDto = {
        jobId: 'job-123',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
        deadlineDays: 15,
      };
      await service.createEscrow(dto);
      expect(stellarServer.submitTransaction).toHaveBeenCalledTimes(1);
    });

    it('should persist escrow to MongoDB via StellarEscrowModel.create', async () => {
      const dto: CreateEscrowDto = {
        jobId: 'job-456',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '50',
        deadlineDays: 30,
      };
      await service.createEscrow(dto);
      expect(StellarEscrowModel.create).toHaveBeenCalledTimes(1);
      const callArg = (StellarEscrowModel.create as jest.Mock).mock.calls[0][0];
      expect(callArg.job_id).toBe('job-456');
      expect(callArg.amount).toBe('50');
    });

    it('should propagate errors thrown by submitTransaction', async () => {
      stellarServer.submitTransaction.mockRejectedValueOnce(
        new Error('tx_bad_seq')
      );
      const dto: CreateEscrowDto = {
        jobId: 'job-fail',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
      };
      await expect(service.createEscrow(dto)).rejects.toThrow('tx_bad_seq');
    });
  });

  // ─── getEscrowStatus ────────────────────────────────────────────────────────

  describe('getEscrowStatus', () => {
    it('should throw when no escrow found for jobId', async () => {
      (StellarEscrowModel.findByJobId as jest.Mock).mockResolvedValueOnce(null);
      await expect(service.getEscrowStatus('nonexistent')).rejects.toThrow(
        /Escrow not found/
      );
    });

    it('should return EscrowStatusDto with correct fields', async () => {
      const record = buildMockEscrowRecord();
      (StellarEscrowModel.findByJobId as jest.Mock).mockResolvedValueOnce(record);

      const status = await service.getEscrowStatus('job-123');

      expect(status.jobId).toBe('job-123');
      expect(status.publicKey).toBe(escrowKeypair.publicKey());
      expect(status.status).toBe('FUNDED');
      expect(typeof status.balance).toBe('string');
    });

    it('should include signers with type labels', async () => {
      const record = buildMockEscrowRecord();
      (StellarEscrowModel.findByJobId as jest.Mock).mockResolvedValueOnce(record);

      const status = await service.getEscrowStatus('job-123');

      const types = status.signers.map(s => s.type);
      expect(types).toContain('host');
      expect(types).toContain('talent');
      expect(types).toContain('arbiter');
    });

    it('thresholds should be returned', async () => {
      const record = buildMockEscrowRecord();
      (StellarEscrowModel.findByJobId as jest.Mock).mockResolvedValueOnce(record);

      const status = await service.getEscrowStatus('job-123');

      expect(status.thresholds.medium).toBe(2);
      expect(status.thresholds.high).toBe(2);
    });
  });

  // ─── buildPreAuthTransactions ─────────────────────────────────────────────

  const makeEscrowAccountMock = () => ({
    id: escrowKeypair.publicKey(),
    sequence: '300000000000',
    accountId() { return this.id; },
    sequenceNumber() { return this.sequence; },
    incrementSequenceNumber() { this.sequence = String(BigInt(this.sequence) + 1n); },
    balances: [{ asset_code: 'USDC', balance: '100' }],
    signers: [{ key: escrowKeypair.publicKey(), weight: 1 }],
    thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 2 },
  });

  describe('buildPreAuthTransactions', () => {
    it('should return paymentTxXDR, paymentTxHash, refundTxXDR, refundTxHash, deadline', async () => {
      stellarServer.loadAccount.mockResolvedValueOnce(makeEscrowAccountMock());

      const result = await service.buildPreAuthTransactions(
        escrowKeypair.publicKey(),
        talentKeypair.publicKey(),
        hostKeypair.publicKey(),
        '100',
        15
      );

      expect(result.paymentTxXDR).toBeTruthy();
      expect(result.paymentTxHash).toBeTruthy();
      expect(result.refundTxXDR).toBeTruthy();
      expect(result.refundTxHash).toBeTruthy();
      expect(result.deadline).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('paymentTxHash and refundTxHash should be different', async () => {
      stellarServer.loadAccount.mockResolvedValueOnce(makeEscrowAccountMock());

      const result = await service.buildPreAuthTransactions(
        escrowKeypair.publicKey(),
        talentKeypair.publicKey(),
        hostKeypair.publicKey(),
        '100',
        15
      );

      expect(result.paymentTxHash).not.toBe(result.refundTxHash);
    });

    it('XDRs should be valid base64-encoded strings', async () => {
      stellarServer.loadAccount.mockResolvedValueOnce(makeEscrowAccountMock());

      const result = await service.buildPreAuthTransactions(
        escrowKeypair.publicKey(),
        talentKeypair.publicKey(),
        hostKeypair.publicKey(),
        '100',
        15
      );

      expect(() => Buffer.from(result.paymentTxXDR, 'base64')).not.toThrow();
    });
  });
});
