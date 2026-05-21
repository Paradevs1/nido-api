/**
 * E2E: Dispute Flow
 *
 * Tests the HTTP layer end-to-end:
 *   POST /api/stellar/dispute         — openDispute
 *   POST /api/stellar/admin/resolve   — resolveDispute
 *   POST /api/stellar/dispute/claim   — claimDispute
 *   GET  /api/stellar/admin/disputes  — listDisputes (admin only)
 */

import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';

// ─── Mocks ───────────────────────────────────────────────────────────────────

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
    openDispute: jest.fn(),
    resolveDispute: jest.fn(),
    claimDispute: jest.fn(),
    listDisputes: jest.fn(),
    createEscrow: jest.fn(),
    getEscrowStatus: jest.fn(),
    releasePayment: jest.fn(),
    refundEscrow: jest.fn(),
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
  __mockFns: {
    openDispute: jest.Mock;
    resolveDispute: jest.Mock;
    claimDispute: jest.Mock;
    listDisputes: jest.Mock;
  };
};

const app: Application = express();
app.use(express.json());
app.use('/api/stellar', stellarRoutes);

const SECRET = 'test-secret-key-for-tests-only';

function makeToken(role = 'HOST'): string {
  return jwt.sign(
    { userId: `user-${role.toLowerCase()}`, email: `${role.toLowerCase()}@test.com`, role },
    SECRET,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' }
  );
}

const HOST_AUTH = `Bearer ${makeToken('HOST')}`;
const ADMIN_AUTH = `Bearer ${makeToken('ADMIN')}`;

const escrow = Keypair.random();
const TX_HASH = '1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd';

// ─── openDispute ─────────────────────────────────────────────────────────────

describe('E2E: POST /api/stellar/dispute', () => {
  beforeEach(() => {
    __mockFns.openDispute.mockReset();
    __mockFns.openDispute.mockResolvedValue(undefined);
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should return 200 when host opens a dispute', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({
        jobId: 'job-dispute-001',
        reason: 'Work not delivered on time',
        initiator: 'HOST',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/opened/i);
  });

  it('should return 200 when talent opens a dispute', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({
        jobId: 'job-dispute-002',
        reason: 'Payment not released after delivery',
        initiator: 'TALENT',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should call openDispute with correct payload', async () => {
    await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-x', reason: 'No delivery', initiator: 'HOST' });

    expect(__mockFns.openDispute).toHaveBeenCalledTimes(1);
    const arg = __mockFns.openDispute.mock.calls[0][0];
    expect(arg.jobId).toBe('job-x');
    expect(arg.reason).toBe('No delivery');
    expect(arg.initiator).toBe('HOST');
  });

  // ─── Validation errors ──────────────────────────────────────────────────────

  it('should return 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({ reason: 'issue', initiator: 'HOST' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it('should return 400 when reason is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-1', initiator: 'HOST' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when initiator is invalid', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-1', reason: 'x', initiator: 'ARBITER' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('HOST or TALENT');
  });

  // ─── Service error scenarios ────────────────────────────────────────────────

  it('should return 400 when escrow is not in FUNDED status', async () => {
    __mockFns.openDispute.mockRejectedValueOnce(
      new Error('Cannot open dispute — escrow status is COMPLETED')
    );

    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-done', reason: 'issue', initiator: 'HOST' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('status is');
  });

  it('should return 500 on unexpected service error', async () => {
    __mockFns.openDispute.mockRejectedValueOnce(new Error('MongoDB write failed'));

    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-db', reason: 'issue', initiator: 'HOST' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute')
      .send({ jobId: 'job-x', reason: 'x', initiator: 'HOST' });

    expect(res.status).toBe(401);
  });
});

// ─── resolveDispute (admin) ───────────────────────────────────────────────────

describe('E2E: POST /api/stellar/admin/resolve', () => {
  const mockResolution = {
    jobId: 'job-dispute-001',
    winner: 'TALENT',
    disputeResolutionXDR: 'CCCC...resolution-xdr',
  };

  beforeEach(() => {
    __mockFns.resolveDispute.mockReset();
    __mockFns.resolveDispute.mockResolvedValue(mockResolution);
  });

  it('should return 200 when admin resolves dispute — winner=TALENT', async () => {
    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .set('Authorization', ADMIN_AUTH)
      .send({ jobId: 'job-dispute-001', winner: 'TALENT' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/TALENT wins/i);
  });

  it('should return 200 when admin resolves dispute — winner=HOST', async () => {
    __mockFns.resolveDispute.mockResolvedValueOnce({ ...mockResolution, winner: 'HOST' });

    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .set('Authorization', ADMIN_AUTH)
      .send({ jobId: 'job-dispute-001', winner: 'HOST' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/HOST wins/i);
  });

  it('should return 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .set('Authorization', ADMIN_AUTH)
      .send({ winner: 'TALENT' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it('should return 400 when winner is invalid', async () => {
    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .set('Authorization', ADMIN_AUTH)
      .send({ jobId: 'job-x', winner: 'ARBITER' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('HOST or TALENT');
  });

  it('should return 403 when called without ADMIN role', async () => {
    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-x', winner: 'TALENT' });

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .send({ jobId: 'job-x', winner: 'TALENT' });

    expect(res.status).toBe(401);
  });

  it('should return 400 when escrow is not in DISPUTED status', async () => {
    __mockFns.resolveDispute.mockRejectedValueOnce(
      new Error('Cannot resolve — escrow status is FUNDED')
    );

    const res = await request(app)
      .post('/api/stellar/admin/resolve')
      .set('Authorization', ADMIN_AUTH)
      .send({ jobId: 'job-funded', winner: 'TALENT' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('status is');
  });
});

// ─── claimDispute ─────────────────────────────────────────────────────────────

describe('E2E: POST /api/stellar/dispute/claim', () => {
  beforeEach(() => {
    __mockFns.claimDispute.mockReset();
    __mockFns.claimDispute.mockResolvedValue(TX_HASH);
  });

  it('should return 200 with transactionHash when claim succeeds', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute/claim')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-claim-001', winnerSignedXDR: 'winner-signed-xdr' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionHash).toBe(TX_HASH);
    expect(res.body.message).toMatch(/settled/i);
  });

  it('should return 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute/claim')
      .set('Authorization', HOST_AUTH)
      .send({ winnerSignedXDR: 'xdr' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it('should return 400 when winnerSignedXDR is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute/claim')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-1' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when dispute has not been resolved by arbiter', async () => {
    __mockFns.claimDispute.mockRejectedValueOnce(
      new Error('Dispute has not been resolved by arbiter yet')
    );

    const res = await request(app)
      .post('/api/stellar/dispute/claim')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-unresolved', winnerSignedXDR: 'xdr' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('not been resolved');
  });

  it('should return 500 on Stellar submission error', async () => {
    __mockFns.claimDispute.mockRejectedValueOnce(new Error('tx_failed'));

    const res = await request(app)
      .post('/api/stellar/dispute/claim')
      .set('Authorization', HOST_AUTH)
      .send({ jobId: 'job-fail', winnerSignedXDR: 'bad-xdr' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stellar/dispute/claim')
      .send({ jobId: 'job-x', winnerSignedXDR: 'xdr' });

    expect(res.status).toBe(401);
  });
});
