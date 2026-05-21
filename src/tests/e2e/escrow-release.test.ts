/**
 * E2E: Release Flow
 *
 * Tests the HTTP layer end-to-end:
 *   POST /api/stellar/escrow/release
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
  __mockFns: { releasePayment: jest.Mock; refundEscrow: jest.Mock; getEscrowStatus: jest.Mock };
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

const host = Keypair.random();
const MOCK_TX_HASH = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: POST /api/stellar/escrow/release', () => {
  beforeEach(() => {
    __mockFns.releasePayment.mockReset();
    __mockFns.refundEscrow.mockReset();
    __mockFns.getEscrowStatus.mockReset();
    __mockFns.releasePayment.mockResolvedValue(MOCK_TX_HASH);
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should return 200 with transactionHash on success', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-release-001', hostSignedXDR: 'AAAA...xdr' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionHash).toBe(MOCK_TX_HASH);
    expect(res.body.message).toMatch(/released/i);
  });

  it('should call releasePayment with correct jobId and XDR', async () => {
    await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-abc', hostSignedXDR: 'xdr-value' });

    expect(__mockFns.releasePayment).toHaveBeenCalledWith('job-abc', 'xdr-value', undefined);
  });

  it('should return JSON content-type', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-ct', hostSignedXDR: 'xdr' });

    expect(res.headers['content-type']).toMatch(/json/);
  });

  // ─── Validation errors ──────────────────────────────────────────────────────

  it('should return 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ hostSignedXDR: 'xdr-value' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it('should return 400 when hostSignedXDR is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-no-xdr' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when both fields are missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── Service error scenarios ────────────────────────────────────────────────

  it('should return 500 when service throws on invalid XDR', async () => {
    __mockFns.releasePayment.mockRejectedValueOnce(new Error('Invalid XDR — hash mismatch'));

    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-bad-xdr', hostSignedXDR: 'tampered-xdr' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid XDR');
  });

  it('should return 500 when escrow not found', async () => {
    __mockFns.releasePayment.mockRejectedValueOnce(new Error('Escrow not found for job ghost'));

    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'ghost', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(500);
    expect(res.body.message).toContain('Escrow not found');
  });

  it('should return 500 when Stellar network times out', async () => {
    __mockFns.releasePayment.mockRejectedValueOnce(new Error('Stellar network timeout'));

    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-net', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(500);
    expect(res.body.message).toContain('Stellar network timeout');
  });

  it('should return 500 when escrow is already completed', async () => {
    __mockFns.releasePayment.mockRejectedValueOnce(
      new Error('Escrow already in COMPLETED status')
    );

    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-done', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('should return 500 when caller is not the host', async () => {
    __mockFns.releasePayment.mockRejectedValueOnce(
      new Error('Unauthorized: caller is not the host')
    );

    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', AUTH_HEADER)
      .send({ jobId: 'job-unauth', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  // ─── Auth guard ─────────────────────────────────────────────────────────────

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .send({ jobId: 'job-no-auth', hostSignedXDR: 'xdr' });

    expect(res.status).toBe(401);
  });
});
