/**
 * E2E: Escrow Status Validation
 *
 * Tests the HTTP layer end-to-end:
 *   GET /api/stellar/escrow/:jobId/status
 */

import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';
import { EscrowStatus } from '../../dtos/stellar.dto';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../config/jwt', () => {
  const jwt = require('jsonwebtoken');
  const SECRET = 'test-secret-key-for-tests-only';
  return {
    JWT_CONFIG: { secret: SECRET, issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' },
    verifyToken: (token: string) =>
      jwt.verify(token, SECRET, { issuer: 'bounties-api', audience: 'bounties-users' }),
    extractTokenFromHeader: (header: string | undefined): string | null =>
      header?.startsWith('Bearer ') ? header.slice(7) : null,
    generateToken: jest.fn(),
    generateRefreshToken: jest.fn(),
  };
});

jest.mock('../../services/StellarService', () => {
  const mockFns = {
    createEscrow: jest.fn(),
    getEscrowStatus: jest.fn(),
  };
  return {
    StellarService: jest.fn().mockImplementation(() => mockFns),
    __mockFns: mockFns,
  };
});

jest.mock('../../config/database', () => ({
  default: jest.fn().mockResolvedValue(undefined),
  getBountiesDB: jest.fn(),
}));

import stellarRoutes from '../../routes/stellar.routes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockFns } = require('../../services/StellarService') as {
  __mockFns: { createEscrow: jest.Mock; getEscrowStatus: jest.Mock };
};

// ─── App ──────────────────────────────────────────────────────────────────────

const app: Application = express();
app.use(express.json());
app.use('/api/stellar', stellarRoutes);

function makeAuthToken(role = 'HOST'): string {
  const secret = process.env['JWT_SECRET'] || 'test-secret-key-for-tests-only';
  return jwt.sign(
    { userId: 'test-user-id', email: 'test@test.com', role },
    secret,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' }
  );
}
const AUTH_HEADER = `Bearer ${makeAuthToken()}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const escrowKeypair = Keypair.random();
const hostKeypair = Keypair.random();
const talentKeypair = Keypair.random();
const arbiterKeypair = Keypair.random();

function mockStatusResponse() {
  return {
    publicKey: escrowKeypair.publicKey(),
    jobId: 'job-status-123',
    status: EscrowStatus.FUNDED,
    balance: '100',
    signers: [
      { publicKey: hostKeypair.publicKey(), weight: 1, type: 'host' },
      { publicKey: talentKeypair.publicKey(), weight: 1, type: 'talent' },
      { publicKey: arbiterKeypair.publicKey(), weight: 1, type: 'arbiter' },
      { publicKey: escrowKeypair.publicKey(), weight: 1, type: 'preauth' },
    ],
    thresholds: { low: 0, medium: 2, high: 2, masterWeight: 1 },
    deadline: Math.floor(Date.now() / 1000) + 15 * 86400,
    createdAt: new Date(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: GET /api/stellar/escrow/:jobId/status', () => {
  beforeEach(() => {
    __mockFns.createEscrow.mockReset();
    __mockFns.getEscrowStatus.mockReset();
    __mockFns.getEscrowStatus.mockResolvedValue(mockStatusResponse());
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should return 200 with status data for a known jobId', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('response data should include jobId', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.jobId).toBe('job-status-123');
  });

  it('response data should include escrow status', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.status).toBe(EscrowStatus.FUNDED);
  });

  it('response data should include signers array', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(Array.isArray(res.body.data.signers)).toBe(true);
    expect(res.body.data.signers.length).toBeGreaterThanOrEqual(3);
  });

  it('response data should include thresholds', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.thresholds).toBeDefined();
    expect(res.body.data.thresholds.medium).toBe(2);
  });

  it('response data should include balance', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.balance).toBe('100');
  });

  // ─── Error cases ────────────────────────────────────────────────────────────

  it('should return 404 when service throws "not found" error', async () => {
    __mockFns.getEscrowStatus.mockRejectedValueOnce(
      new Error('Escrow not found for job ghost-job')
    );

    const res = await request(app)
      .get('/api/stellar/escrow/ghost-job/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Escrow not found');
  });

  it('service should be called with the correct jobId from route params', async () => {
    await request(app)
      .get('/api/stellar/escrow/my-specific-job/status')
      .set('Authorization', AUTH_HEADER);

    expect(__mockFns.getEscrowStatus).toHaveBeenCalledWith('my-specific-job');
  });

  // ─── Status variants ─────────────────────────────────────────────────────────

  it('should return CREATED status', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), status: EscrowStatus.CREATED });

    const res = await request(app)
      .get('/api/stellar/escrow/job-created/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(EscrowStatus.CREATED);
  });

  it('should return COMPLETED status', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), status: EscrowStatus.COMPLETED });

    const res = await request(app)
      .get('/api/stellar/escrow/job-completed/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.status).toBe(EscrowStatus.COMPLETED);
  });

  it('should return REFUNDED status', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), status: EscrowStatus.REFUNDED });

    const res = await request(app)
      .get('/api/stellar/escrow/job-refunded/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.status).toBe(EscrowStatus.REFUNDED);
  });

  it('should return DISPUTED status', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), status: EscrowStatus.DISPUTED });

    const res = await request(app)
      .get('/api/stellar/escrow/job-disputed/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.status).toBe(EscrowStatus.DISPUTED);
  });

  // ─── Signers detailed validation ─────────────────────────────────────────────

  it('should have exactly 4 signers (host, talent, arbiter, preauth)', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.signers).toHaveLength(4);
  });

  it('each signer should have publicKey, weight, and type', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    res.body.data.signers.forEach((signer: { publicKey: string; weight: number; type: string }) => {
      expect(signer).toHaveProperty('publicKey');
      expect(signer).toHaveProperty('weight');
      expect(signer).toHaveProperty('type');
      expect(signer.publicKey).toMatch(/^G[A-Z2-7]{55}$/);
      expect(typeof signer.weight).toBe('number');
    });
  });

  it('should have exactly one signer of each role', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    const signers: Array<{ type: string }> = res.body.data.signers;
    expect(signers.filter(s => s.type === 'host')).toHaveLength(1);
    expect(signers.filter(s => s.type === 'talent')).toHaveLength(1);
    expect(signers.filter(s => s.type === 'arbiter')).toHaveLength(1);
    expect(signers.filter(s => s.type === 'preauth')).toHaveLength(1);
  });

  it('all signers should have weight 1', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    res.body.data.signers.forEach((signer: { weight: number }) => {
      expect(signer.weight).toBe(1);
    });
  });

  // ─── Thresholds detailed validation ──────────────────────────────────────────

  it('low threshold should be 0', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.thresholds.low).toBe(0);
  });

  it('high threshold should be 2', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.thresholds.high).toBe(2);
  });

  it('masterWeight should be 0 or 1', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect([0, 1]).toContain(res.body.data.thresholds.masterWeight);
  });

  // ─── Balance formats ──────────────────────────────────────────────────────────

  it('balance should be a string', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(typeof res.body.data.balance).toBe('string');
  });

  it('should handle zero balance', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), balance: '0' });

    const res = await request(app)
      .get('/api/stellar/escrow/job-zero/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.balance).toBe('0');
  });

  it('should handle decimal balance', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), balance: '123.4567890' });

    const res = await request(app)
      .get('/api/stellar/escrow/job-decimal/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.balance).toBe('123.4567890');
  });

  it('should handle very large balance', async () => {
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), balance: '9999999.9999999' });

    const res = await request(app)
      .get('/api/stellar/escrow/job-large/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.balance).toBe('9999999.9999999');
  });

  // ─── Deadline validation ──────────────────────────────────────────────────────

  it('deadline should be a number (unix seconds)', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(typeof res.body.data.deadline).toBe('number');
  });

  it('deadline in the mock should be in the future', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.deadline).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should correctly pass through an expired (past) deadline', async () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 86400;
    __mockFns.getEscrowStatus.mockResolvedValueOnce({ ...mockStatusResponse(), deadline: pastDeadline });

    const res = await request(app)
      .get('/api/stellar/escrow/job-expired/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.body.data.deadline).toBeLessThan(Math.floor(Date.now() / 1000));
  });

  // ─── Additional error scenarios ───────────────────────────────────────────────

  it('should return 404 and surface Stellar network timeout message', async () => {
    __mockFns.getEscrowStatus.mockRejectedValueOnce(new Error('Stellar network timeout'));

    const res = await request(app)
      .get('/api/stellar/escrow/job-net-err/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Stellar network timeout');
  });

  it('should return 404 and surface MongoDB error message', async () => {
    __mockFns.getEscrowStatus.mockRejectedValueOnce(new Error('MongoDB connection failed'));

    const res = await request(app)
      .get('/api/stellar/escrow/job-db-err/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
    expect(res.body.message).toContain('MongoDB');
  });

  it('GET /escrow/status (missing jobId segment) should return 404', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  // ─── HTTP metadata ────────────────────────────────────────────────────────────

  it('should return JSON content-type', async () => {
    const res = await request(app)
      .get('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('POST to the status route should return 404', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(404);
  });

  it('DELETE to the status route should return 404', async () => {
    const res = await request(app)
      .delete('/api/stellar/escrow/job-status-123/status')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
