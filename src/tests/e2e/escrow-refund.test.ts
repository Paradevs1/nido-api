/**
 * E2E: Refund Flow
 *
 * Tests the HTTP layer end-to-end:
 *   POST /api/stellar/escrow/refund
 */

import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

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
    releasePayment: jest.fn(),
    refundEscrow: jest.fn(),
    getEscrowStatus: jest.fn(),
    createEscrow: jest.fn(),
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
  __mockFns: { refundEscrow: jest.Mock };
};

const app: Application = express();
app.use(express.json());
app.use('/api/stellar', stellarRoutes);

function makeAuthToken(role = 'HOST'): string {
  const secret = 'test-secret-key-for-tests-only';
  return jwt.sign(
    { userId: 'test-user-id', email: 'test@test.com', role },
    secret,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' }
  );
}
const AUTH_HEADER = `Bearer ${makeAuthToken()}`;
const TX_HASH = 'cafebabecafebabe000000000000000000000000000000000000000000000000';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: POST /api/stellar/escrow/refund', () => {
  beforeEach(() => {
    __mockFns.refundEscrow.mockReset();
    __mockFns.refundEscrow.mockResolvedValue(TX_HASH);
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should return 200 with transactionHash when deadline has passed', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-expired', hostSignedXDR: 'refund-xdr' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionHash).toBe(TX_HASH);
    expect(res.body.message).toMatch(/refunded/i);
  });

  it('should call refundEscrow with correct jobId and XDR', async () => {
    await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-xyz', hostSignedXDR: 'signed-refund-xdr' });

    expect(__mockFns.refundEscrow).toHaveBeenCalledWith('job-xyz', 'signed-refund-xdr', undefined);
  });

  it('should return JSON content-type', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-ct', hostSignedXDR: 'xdr' });

    expect(res.headers['content-type']).toMatch(/json/);
  });

  // ─── Validation errors ──────────────────────────────────────────────────────

  it('should return 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ hostSignedXDR: 'xdr' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it('should return 400 when hostSignedXDR is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── TimeBound violation ────────────────────────────────────────────────────

  it('should return 400 when deadline has not passed (TimeBound violation)', async () => {
    __mockFns.refundEscrow.mockRejectedValueOnce(
      new Error('Refund not available yet — deadline has not passed')
    );

    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-active', hostSignedXDR: 'refund-xdr' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not available yet');
  });

  // ─── Service errors ─────────────────────────────────────────────────────────

  it('should return 500 when Stellar transaction fails', async () => {
    __mockFns.refundEscrow.mockRejectedValueOnce(new Error('tx_bad_auth'));

    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-fail', hostSignedXDR: 'bad-xdr' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('tx_bad_auth');
  });

  it('should return 500 when escrow not found', async () => {
    __mockFns.refundEscrow.mockRejectedValueOnce(new Error('Escrow not found'));

    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'ghost', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(500);
    expect(res.body.message).toContain('Escrow not found');
  });

  it('should return 500 when escrow is already refunded', async () => {
    __mockFns.refundEscrow.mockRejectedValueOnce(
      new Error('Escrow already in REFUNDED status')
    );

    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-refunded', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  // ─── Auth guard ─────────────────────────────────────────────────────────────

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .send({ jobId: 'job-no-auth', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(401);
  });
});
