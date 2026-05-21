/**
 * E2E: Escrow Creation Flow
 *
 * Tests the HTTP layer end-to-end:
 *   POST /api/stellar/escrow/create
 *
 * Key architecture note:
 *   stellar.routes.ts does `new StellarController()` at module-load time, which
 *   calls `new StellarService()` in the constructor.  The jest.mock factory below
 *   creates the mock fns once and stores them on the exported `__mockFns` object.
 *   Because the controller holds a reference to that *same* jest.fn() instance,
 *   calling `.mockResolvedValueOnce(...)` on the shared ref controls the test-time
 *   behavior without needing to rebuild the app.
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

// ─── Import after mocks ───────────────────────────────────────────────────────

import stellarRoutes from '../../routes/stellar.routes';
import { EscrowStatus } from '../../dtos/stellar.dto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockFns } = require('../../services/StellarService') as {
  __mockFns: { createEscrow: jest.Mock; getEscrowStatus: jest.Mock };
};

// ─── Build a minimal Express app ─────────────────────────────────────────────

const app: Application = express();
app.use(express.json());
app.use('/api/stellar', stellarRoutes);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAuthToken(role = 'HOST'): string {
  const secret = process.env['JWT_SECRET'] || 'test-secret-key-for-tests-only';
  return jwt.sign(
    { userId: 'test-user-id', email: 'test@test.com', role },
    secret,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' }
  );
}

const AUTH_HEADER = `Bearer ${makeAuthToken()}`;

const hostKeypair = Keypair.random();
const talentKeypair = Keypair.random();
const escrowKeypair = Keypair.random();

function mockEscrowResponse() {
  return {
    escrowPublicKey: escrowKeypair.publicKey(),
    jobId: 'job-abc',
    status: EscrowStatus.FUNDED,
    stellarTxHash: 'abcdef1234',
    paymentTxHash: 'pay-hash',
    refundTxHash: 'ref-hash',
    deadline: Math.floor(Date.now() / 1000) + 15 * 86400,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: POST /api/stellar/escrow/create', () => {
  beforeEach(() => {
    __mockFns.createEscrow.mockReset();
    __mockFns.getEscrowStatus.mockReset();
    __mockFns.createEscrow.mockResolvedValue(mockEscrowResponse());
  });

  // ─── Happy path ─────────────────────────────────────────────────────────────

  it('should return 201 with escrow data on a valid request', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-abc',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
        deadlineDays: 15,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeTruthy();
  });

  // ─── Validation errors ──────────────────────────────────────────────────────

  it('should return 400 when jobId is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Missing required fields/i);
  });

  it('should return 400 when hostPublicKey is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-1',
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when talentPublicKey is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-1',
        hostPublicKey: hostKeypair.publicKey(),
        amount: '100',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when amount is missing', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-1',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // ─── Service errors ─────────────────────────────────────────────────────────

  it('should return 500 when service throws', async () => {
    __mockFns.createEscrow.mockRejectedValueOnce(new Error('Stellar network timeout'));

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-fail',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Stellar network timeout');
  });

  // ─── Content-Type ───────────────────────────────────────────────────────────

  it('should return JSON content-type', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-ct',
        hostPublicKey: hostKeypair.publicKey(),
        talentPublicKey: talentKeypair.publicKey(),
        amount: '100',
      });

    expect(res.headers['content-type']).toMatch(/json/);
  });
});
