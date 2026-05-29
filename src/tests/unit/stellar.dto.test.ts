import { Keypair } from '@stellar/stellar-sdk';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  EscrowStatus,
  PreAuthTxDto,
  CreateEscrowResponseDto,
  OpenDisputeDto,
} from '../../dtos/stellar.dto';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeKeypair() {
  return Keypair.random();
}

function validCreateEscrowDto(overrides: Partial<CreateEscrowDto> = {}): CreateEscrowDto {
  const host = makeKeypair();
  const talent = makeKeypair();
  return {
    jobId: 'job-abc-123',
    hostPublicKey: host.publicKey(),
    talentPublicKey: talent.publicKey(),
    amount: '100',
    deadlineDays: 15,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Stellar DTOs', () => {
  // ─── CreateEscrowDto ─────────────────────────────────────────────────────────

  describe('CreateEscrowDto', () => {
    it('should accept a fully valid payload', () => {
      const dto = validCreateEscrowDto();
      expect(dto.jobId).toBeTruthy();
      expect(dto.hostPublicKey).toMatch(/^G[A-Z2-7]{55}$/);
      expect(dto.talentPublicKey).toMatch(/^G[A-Z2-7]{55}$/);
      expect(parseFloat(dto.amount)).toBeGreaterThan(0);
    });

    it('deadlineDays should be optional (undefined is acceptable)', () => {
      const dto: CreateEscrowDto = {
        jobId: 'job-1',
        hostPublicKey: makeKeypair().publicKey(),
        talentPublicKey: makeKeypair().publicKey(),
        amount: '50',
      };
      expect(dto.deadlineDays).toBeUndefined();
    });

    it('amount should be a numeric string', () => {
      const dto = validCreateEscrowDto({ amount: '250.50' });
      expect(() => parseFloat(dto.amount)).not.toThrow();
      expect(parseFloat(dto.amount)).toBe(250.5);
    });

    it('jobId can be any non-empty string', () => {
      const dto = validCreateEscrowDto({ jobId: 'my-unique-job-id-999' });
      expect(dto.jobId).toBe('my-unique-job-id-999');
    });
  });

  // ─── ReleaseEscrowDto ────────────────────────────────────────────────────────

  describe('ReleaseEscrowDto', () => {
    it('should carry jobId and hostSignedXDR', () => {
      const dto: ReleaseEscrowDto = {
        jobId: 'job-release-001',
        hostSignedXDR: 'AAAA...base64-xdr',
      };
      expect(dto.jobId).toBe('job-release-001');
      expect(dto.hostSignedXDR).toBeTruthy();
    });
  });

  // ─── RefundEscrowDto ─────────────────────────────────────────────────────────

  describe('RefundEscrowDto', () => {
    it('should carry jobId and hostSignedXDR', () => {
      const dto: RefundEscrowDto = {
        jobId: 'job-refund-001',
        hostSignedXDR: 'BBBB...base64-xdr',
      };
      expect(dto.jobId).toBe('job-refund-001');
      expect(dto.hostSignedXDR).toBeTruthy();
    });
  });

  // ─── OpenDisputeDto ──────────────────────────────────────────────────────────

  describe('OpenDisputeDto', () => {
    it('should carry jobId, reason, and initiator', () => {
      const dto: OpenDisputeDto = {
        jobId: 'job-dispute-001',
        reason: 'Work not delivered',
        initiator: 'HOST',
      };
      expect(dto.jobId).toBeTruthy();
      expect(dto.reason).toBeTruthy();
      expect(['HOST', 'TALENT']).toContain(dto.initiator);
    });
  });

  // ─── EscrowStatus enum ───────────────────────────────────────────────────────

  describe('EscrowStatus enum', () => {
    it('should have a CREATED value', () => {
      expect(EscrowStatus.CREATED).toBe('CREATED');
    });

    it('should have a FUNDED value', () => {
      expect(EscrowStatus.FUNDED).toBe('FUNDED');
    });

    it('should have a COMPLETED value', () => {
      expect(EscrowStatus.COMPLETED).toBe('COMPLETED');
    });

    it('should have a REFUNDED value', () => {
      expect(EscrowStatus.REFUNDED).toBe('REFUNDED');
    });

    it('should have a DISPUTED value', () => {
      expect(EscrowStatus.DISPUTED).toBe('DISPUTED');
    });

    it('should have a PENDING_INBOUND_MINT value (CCTP inbound funding)', () => {
      expect(EscrowStatus.PENDING_INBOUND_MINT).toBe('PENDING_INBOUND_MINT');
    });

    it('should have exactly 6 status values', () => {
      const values = Object.values(EscrowStatus);
      expect(values).toHaveLength(6);
    });
  });

  // ─── PreAuthTxDto ────────────────────────────────────────────────────────────

  describe('PreAuthTxDto', () => {
    it('should accept valid pre-auth transaction data', () => {
      const dto: PreAuthTxDto = {
        paymentTxXDR: 'payment-xdr-base64',
        paymentTxHash: 'hash-payment-abc',
        refundTxXDR: 'refund-xdr-base64',
        refundTxHash: 'hash-refund-xyz',
        deadline: Math.floor(Date.now() / 1000) + 15 * 86400,
      };
      expect(dto.deadline).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(dto.paymentTxHash).toBeTruthy();
      expect(dto.refundTxHash).toBeTruthy();
    });

    it('payment deadline must be in the future', () => {
      const now = Math.floor(Date.now() / 1000);
      const dto: PreAuthTxDto = {
        paymentTxXDR: 'xdr',
        paymentTxHash: 'hash',
        refundTxXDR: 'xdr',
        refundTxHash: 'hash',
        deadline: now + 100,
      };
      expect(dto.deadline).toBeGreaterThan(now);
    });
  });

  // ─── CreateEscrowResponseDto ─────────────────────────────────────────────────

  describe('CreateEscrowResponseDto', () => {
    it('should have success flag, data, and message', () => {
      const escrow = makeKeypair();
      const response: CreateEscrowResponseDto = {
        success: true,
        data: {
          escrowPublicKey: escrow.publicKey(),
          jobId: 'job-123',
          status: EscrowStatus.CREATED,
          transactionHash: 'abc123',
          preAuthTxs: {
            paymentTxXDR: 'pay-xdr',
            paymentTxHash: 'pay-hash',
            refundTxXDR: 'ref-xdr',
            refundTxHash: 'ref-hash',
            deadline: Math.floor(Date.now() / 1000) + 86400,
          },
          fundingTxXDR: 'funding-xdr',
        },
        message: 'Escrow created successfully',
      };
      expect(response.success).toBe(true);
      expect(response.data.jobId).toBe('job-123');
      expect(response.data.status).toBe(EscrowStatus.CREATED);
      expect(response.message).toBeTruthy();
    });

    it('success flag should be false on error responses', () => {
      const errorResponse = { success: false, message: 'Something went wrong' };
      expect(errorResponse.success).toBe(false);
    });
  });
});
