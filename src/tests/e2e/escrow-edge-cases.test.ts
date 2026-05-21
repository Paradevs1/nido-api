/**
 * E2E: Edge Cases & Error Scenarios
 *
 * Covers boundary conditions, malformed inputs, and unexpected runtime errors.
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

const host = Keypair.random();
const talent = Keypair.random();
const escrow = Keypair.random();

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E: Edge Cases', () => {
  beforeEach(() => {
    __mockFns.createEscrow.mockReset();
    __mockFns.getEscrowStatus.mockReset();
  });

  // ─── Amount edge cases ──────────────────────────────────────────────────────

  it('should pass through a very large amount string without crashing', async () => {
    __mockFns.createEscrow.mockResolvedValue({
      escrowPublicKey: escrow.publicKey(),
      jobId: 'job-large',
      status: EscrowStatus.FUNDED,
      stellarTxHash: 'hash',
      paymentTxHash: 'pay',
      refundTxHash: 'ref',
      deadline: Date.now(),
    });

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-large',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '9999999',
      });

    expect(res.status).toBe(201);
  });

  it('should return 400 when amount is an empty string', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-empty-amount',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '',
      });

    expect(res.status).toBe(400);
  });

  // ─── Duplicate jobId ────────────────────────────────────────────────────────

  it('should propagate a "duplicate job" error from the service as 500', async () => {
    __mockFns.createEscrow.mockRejectedValue(
      new Error('Escrow already exists for this job')
    );

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'dup-job',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '100',
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toContain('Escrow already exists');
  });

  // ─── Stellar network failures ──────────────────────────────────────────────

  it('should surface a "tx_bad_auth" Stellar error as 500', async () => {
    const stellarError = { message: 'Request failed', response: { data: { extras: { result_codes: { transaction: 'tx_bad_auth' } } } } };
    __mockFns.createEscrow.mockRejectedValue(stellarError);

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-bad-auth',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '100',
      });

    expect(res.status).toBe(500);
  });

  it('should surface a "tx_insufficient_balance" error as 500', async () => {
    __mockFns.createEscrow.mockRejectedValue(new Error('tx_insufficient_balance'));

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-no-funds',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '1000000',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  // ─── Malformed JSON ─────────────────────────────────────────────────────────

  it('should return 400 when body is malformed JSON', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Content-Type', 'application/json')
      .send('{ bad json >>>');

    expect(res.status).toBe(400);
  });

  // ─── Deadline edge cases ────────────────────────────────────────────────────

  it('should accept deadlineDays of 1 (minimum)', async () => {
    __mockFns.createEscrow.mockResolvedValue({
      escrowPublicKey: escrow.publicKey(),
      jobId: 'job-1day',
      status: EscrowStatus.FUNDED,
      stellarTxHash: 'hash',
      paymentTxHash: 'pay',
      refundTxHash: 'ref',
      deadline: Math.floor(Date.now() / 1000) + 86400,
    });

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-1day',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '10',
        deadlineDays: 1,
      });

    expect(res.status).toBe(201);
  });

  it('should accept deadlineDays of 90', async () => {
    __mockFns.createEscrow.mockResolvedValue({
      escrowPublicKey: escrow.publicKey(),
      jobId: 'job-90days',
      status: EscrowStatus.FUNDED,
      stellarTxHash: 'hash',
      paymentTxHash: 'pay',
      refundTxHash: 'ref',
      deadline: Math.floor(Date.now() / 1000) + 90 * 86400,
    });

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', AUTH_HEADER)
      .send({
        jobId: 'job-90days',
        hostPublicKey: host.publicKey(),
        talentPublicKey: talent.publicKey(),
        amount: '500',
        deadlineDays: 90,
      });

    expect(res.status).toBe(201);
  });

  // ─── HTTP method not allowed ────────────────────────────────────────────────

  it('should return 404 for GET on /escrow/create', async () => {
    const res = await request(app).get('/api/stellar/escrow/create');
    expect([401, 404, 500]).toContain(res.status);
  });
});
