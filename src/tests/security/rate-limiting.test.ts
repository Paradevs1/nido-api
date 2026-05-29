/**
 * Security: Rate Limiting — Stellar Endpoints
 *
 * Verifica que express-rate-limit está aplicado por usuário (userId do JWT)
 * nos endpoints críticos da API Stellar.
 *
 * Cada teste usa um userId único para garantir que buckets não sangrem entre casos.
 * O app criado aqui é minimal (sem o global limiter do app.ts) para isolar
 * exatamente o comportamento dos limiters definidos em stellar.routes.ts.
 *
 * Ref: AUDIT.md SEC-OPEN-003 / TASK-006
 */

// ── Env vars antes de qualquer import ────────────────────────────────────────
process.env['JWT_SECRET'] = 'test-jwt-secret-32chars-for-jest!!';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test';
process.env['CRON_SECRET'] = 'test-cron-secret';
process.env['EVM_PRIVATE_KEY'] = '0x0000000000000000000000000000000000000000000000000000000000000001';
process.env['SOLANA_PRIVATE_KEY'] = 'test-solana-key';
process.env['SUI_PRIVATE_KEY'] = 'test-sui-key';
process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = 'a'.repeat(64);
process.env['PORT'] = '0';
process.env['NODE_ENV'] = 'test';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../config/database', () => {
  const mockCollection = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
        }),
      }),
      toArray: jest.fn().mockResolvedValue([]),
    }),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    createIndex: jest.fn().mockResolvedValue('index'),
    countDocuments: jest.fn().mockResolvedValue(0),
  };
  const mockDb = { collection: jest.fn().mockReturnValue(mockCollection) };
  return {
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
    getBountiesDB: jest.fn().mockResolvedValue(mockDb),
    ensureConnection: jest.fn().mockResolvedValue(undefined),
    ensureIndexes: jest.fn().mockResolvedValue(undefined),
  };
});

// ── Mock StellarController — rate limiting não depende de lógica de negócio ──
jest.mock('../../controllers/StellarController', () => ({
  StellarController: jest.fn().mockImplementation(() => ({
    createEscrow: (_req: any, res: any) => res.status(201).json({ success: true }),
    getFundingXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    fundEscrow: (_req: any, res: any) => res.status(201).json({ success: true }),
    prepareInbound: (_req: any, res: any) => res.status(200).json({ success: true }),
    registerBurn: (_req: any, res: any) => res.status(200).json({ success: true }),
    relayInboundMint: (_req: any, res: any) => res.status(200).json({ success: true }),
    getPaymentXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    getRefundXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    releasePayment: (_req: any, res: any) => res.status(200).json({ success: true }),
    refundEscrow: (_req: any, res: any) => res.status(200).json({ success: true }),
    getEscrowStatus: (_req: any, res: any) => res.status(200).json({ success: true }),
    openDispute: (_req: any, res: any) => res.status(201).json({ success: true }),
    getDisputeXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    claimDispute: (_req: any, res: any) => res.status(200).json({ success: true }),
    listDisputes: (_req: any, res: any) => res.status(200).json({ success: true }),
    resolveDispute: (_req: any, res: any) => res.status(200).json({ success: true }),
  })),
}));

import express, { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import stellarRoutes from '../../routes/stellar.routes';

// ── App minimal — sem global limiter do app.ts (que tem skipRateLimit localhost) ─
const app: Application = express();
app.use(express.json());
app.use('/api/stellar', stellarRoutes);

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env['JWT_SECRET']!;

function makeToken(userId: string, role = 'HOST'): string {
  return jwt.sign(
    { userId, email: `${userId}@test.com`, role },
    JWT_SECRET,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' },
  );
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const VALID_CREATE_BODY = {
  jobId: 'job-test-001',
  hostPublicKey: 'GCLSN5ZQ3IXS4BPNTJYCQ5R5TH27Z5ZZF3KGICAEYOH25FXRUCUTXUV',
  talentPublicKey: 'GDPN3GCAJRJFMYBLIZ4THBPVHYGQLKQRJH7XORZ7BLNF2GBXF5EXZUE',
  amount: '100',
};

// ─── POST /escrow/create — limit: 5/min per user ──────────────────────────────

describe('Rate Limiting — POST /escrow/create (5/min per user)', () => {
  it('should allow exactly 5 requests within the window', async () => {
    const token = makeToken(uid('create-allow'));
    const auth = `Bearer ${token}`;

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/stellar/escrow/create')
          .set('Authorization', auth)
          .send(VALID_CREATE_BODY),
      ),
    );

    for (const res of responses) {
      expect(res.status).not.toBe(429);
    }
  });

  it('should block the 6th request with 429', async () => {
    const token = makeToken(uid('create-block'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/create')
        .set('Authorization', auth)
        .send(VALID_CREATE_BODY);
    }

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);

    expect(res.status).toBe(429);
  });

  it('429 body should have success:false and RATE_LIMIT_EXCEEDED error code', async () => {
    const token = makeToken(uid('create-shape'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/create')
        .set('Authorization', auth)
        .send(VALID_CREATE_BODY);
    }

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      success: false,
      message: expect.stringContaining('Too many'),
      error: 'RATE_LIMIT_EXCEEDED',
    });
  });

  it('should include RateLimit-* headers (RFC draft-6) in every response', async () => {
    const token = makeToken(uid('create-hdr'));
    const auth = `Bearer ${token}`;

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  it('RateLimit-Remaining should decrement with each successful request', async () => {
    const token = makeToken(uid('create-decrement'));
    const auth = `Bearer ${token}`;

    const r1 = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);

    const r2 = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);

    const rem1 = parseInt(r1.headers['ratelimit-remaining'] as string, 10);
    const rem2 = parseInt(r2.headers['ratelimit-remaining'] as string, 10);
    expect(rem2).toBeLessThan(rem1);
  });

  it('should keep separate buckets per userId — user B is not blocked by user A', async () => {
    const authA = `Bearer ${makeToken(uid('A'))}`;
    const authB = `Bearer ${makeToken(uid('B'))}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/create')
        .set('Authorization', authA)
        .send(VALID_CREATE_BODY);
    }

    const blockedA = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', authA)
      .send(VALID_CREATE_BODY);
    expect(blockedA.status).toBe(429);

    const resB = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', authB)
      .send(VALID_CREATE_BODY);
    expect(resB.status).not.toBe(429);
  });

  it('legacy X-RateLimit-* headers must NOT be present (draft-6 only)', async () => {
    const token = makeToken(uid('create-legacy'));
    const auth = `Bearer ${token}`;

    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);

    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
  });

  it('should return 401 for requests without token — no rate limit bucket consumed', async () => {
    const res = await request(app)
      .post('/api/stellar/escrow/create')
      .send(VALID_CREATE_BODY);

    expect(res.status).toBe(401);
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});

// ─── POST /escrow/release — limit: 10/min per user ───────────────────────────

describe('Rate Limiting — POST /escrow/release (10/min per user)', () => {
  it('should allow exactly 10 requests within the window', async () => {
    const token = makeToken(uid('release-allow'));
    const auth = `Bearer ${token}`;

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/stellar/escrow/release')
          .set('Authorization', auth)
          .send({ jobId: 'job-1', signedXDR: 'test-xdr' }),
      ),
    );

    for (const res of responses) {
      expect(res.status).not.toBe(429);
    }
  });

  it('should block the 11th request with 429', async () => {
    const token = makeToken(uid('release-block'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/stellar/escrow/release')
        .set('Authorization', auth)
        .send({ jobId: 'job-1', signedXDR: 'test-xdr' });
    }

    const res = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', auth)
      .send({ jobId: 'job-1', signedXDR: 'test-xdr' });

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
  });

  it('release limit (10) should be higher than create limit (5)', async () => {
    const token = makeToken(uid('release-higher'));
    const auth = `Bearer ${token}`;

    // exhaust create limit
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/create')
        .set('Authorization', auth)
        .send(VALID_CREATE_BODY);
    }
    const createBlocked = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);
    expect(createBlocked.status).toBe(429);

    // release has its own bucket with 10/min — still works
    const releaseRes = await request(app)
      .post('/api/stellar/escrow/release')
      .set('Authorization', auth)
      .send({ jobId: 'job-1', signedXDR: 'test-xdr' });
    expect(releaseRes.status).not.toBe(429);
  });
});

// ─── POST /escrow/refund — shares releaseRefundLimiter ───────────────────────

describe('Rate Limiting — POST /escrow/refund (10/min per user, same limiter as release)', () => {
  it('should block the 11th refund request', async () => {
    const token = makeToken(uid('refund-block'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/stellar/escrow/refund')
        .set('Authorization', auth)
        .send({ jobId: 'job-1', signedXDR: 'test-xdr' });
    }

    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', auth)
      .send({ jobId: 'job-1', signedXDR: 'test-xdr' });

    expect(res.status).toBe(429);
  });

  it('release and refund share a bucket — 5 release + 6 refund = block at refund #6', async () => {
    const token = makeToken(uid('shared-bucket'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/release')
        .set('Authorization', auth)
        .send({ jobId: 'job-1', signedXDR: 'test-xdr' });
    }

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/refund')
        .set('Authorization', auth)
        .send({ jobId: 'job-1', signedXDR: 'test-xdr' });
    }

    // 11th TX submission (across both endpoints) should be blocked
    const res = await request(app)
      .post('/api/stellar/escrow/refund')
      .set('Authorization', auth)
      .send({ jobId: 'job-1', signedXDR: 'test-xdr' });

    expect(res.status).toBe(429);
  });
});

// ─── GET /escrow/:jobId/status — limit: 30/min per user ──────────────────────

describe('Rate Limiting — GET /escrow/:jobId/status (30/min per user)', () => {
  it('should include RateLimit-* headers on status responses', async () => {
    const token = makeToken(uid('status-hdr'));
    const auth = `Bearer ${token}`;

    const res = await request(app)
      .get('/api/stellar/escrow/job-abc/status')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
    expect(res.headers['ratelimit-reset']).toBeDefined();
  });

  it('status limit (30) is higher than create limit (5) — 6 status calls all succeed', async () => {
    const token = makeToken(uid('status-high'));
    const auth = `Bearer ${token}`;

    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        request(app)
          .get(`/api/stellar/escrow/job-${i}/status`)
          .set('Authorization', auth),
      ),
    );

    for (const res of responses) {
      expect(res.status).not.toBe(429);
    }
  });

  it('create and status endpoints have independent buckets per user', async () => {
    const token = makeToken(uid('buckets-independent'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/create')
        .set('Authorization', auth)
        .send(VALID_CREATE_BODY);
    }

    const createBlocked = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);
    expect(createBlocked.status).toBe(429);

    const statusRes = await request(app)
      .get('/api/stellar/escrow/job-test/status')
      .set('Authorization', auth);
    expect(statusRes.status).not.toBe(429);
  });
});

// ─── POST /dispute — limit: 5/min per user ───────────────────────────────────

describe('Rate Limiting — POST /dispute (5/min per user)', () => {
  it('should allow exactly 5 dispute opens within the window', async () => {
    const token = makeToken(uid('dispute-allow'));
    const auth = `Bearer ${token}`;

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/stellar/dispute')
          .set('Authorization', auth)
          .send({ jobId: 'job-dispute', reason: 'no delivery' }),
      ),
    );

    for (const res of responses) {
      expect(res.status).not.toBe(429);
    }
  });

  it('should block the 6th dispute with 429', async () => {
    const token = makeToken(uid('dispute-block'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/dispute')
        .set('Authorization', auth)
        .send({ jobId: 'job-dispute', reason: 'no delivery' });
    }

    const res = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', auth)
      .send({ jobId: 'job-dispute', reason: 'no delivery' });

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
  });

  it('dispute bucket is independent from create bucket', async () => {
    const token = makeToken(uid('dispute-independent'));
    const auth = `Bearer ${token}`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/stellar/escrow/create')
        .set('Authorization', auth)
        .send(VALID_CREATE_BODY);
    }

    const createBlocked = await request(app)
      .post('/api/stellar/escrow/create')
      .set('Authorization', auth)
      .send(VALID_CREATE_BODY);
    expect(createBlocked.status).toBe(429);

    const disputeRes = await request(app)
      .post('/api/stellar/dispute')
      .set('Authorization', auth)
      .send({ jobId: 'job-dispute', reason: 'no delivery' });
    expect(disputeRes.status).not.toBe(429);
  });
});

// ─── GET XDR endpoints — share statusLimiter ────────────────────────────────

describe('Rate Limiting — GET /escrow/:jobId/payment-xdr and /refund-xdr', () => {
  it('payment-xdr and refund-xdr share the status bucket (30/min) with /status', async () => {
    const token = makeToken(uid('xdr-bucket'));
    const auth = `Bearer ${token}`;

    // 3 status + 3 payment-xdr + 3 refund-xdr = 9 total — all in budget
    const responses = await Promise.all([
      ...Array.from({ length: 3 }, () =>
        request(app).get('/api/stellar/escrow/job-test/status').set('Authorization', auth),
      ),
      ...Array.from({ length: 3 }, () =>
        request(app).get('/api/stellar/escrow/job-test/payment-xdr').set('Authorization', auth),
      ),
      ...Array.from({ length: 3 }, () =>
        request(app).get('/api/stellar/escrow/job-test/refund-xdr').set('Authorization', auth),
      ),
    ]);

    for (const res of responses) {
      expect(res.status).not.toBe(429);
    }
  });
});

// ─── Admin endpoints — no rate limiting (protected by adminGuard) ─────────────

describe('Admin endpoints — authorization without rate-limit headers', () => {
  it('GET /admin/disputes returns 403 for non-ADMIN role', async () => {
    const token = makeToken(uid('admin-test'), 'HOST');
    const auth = `Bearer ${token}`;

    const res = await request(app)
      .get('/api/stellar/admin/disputes')
      .set('Authorization', auth);

    expect(res.status).toBe(403);
  });

  it('GET /admin/disputes returns 200 for ADMIN role', async () => {
    const token = makeToken(uid('admin-ok'), 'ADMIN');
    const auth = `Bearer ${token}`;

    const res = await request(app)
      .get('/api/stellar/admin/disputes')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
  });
});
