/**
 * Suite: Authorization Guards
 * Verifica que todos os endpoints Stellar retornam 401/403 sem credenciais válidas.
 * Zero network calls — StellarController completamente mockado.
 */

// ── Env vars antes de qualquer import ────────────────────────────────────────
process.env['JWT_SECRET'] = 'test-jwt-secret-32chars-for-jest!!';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test';
process.env['CRON_SECRET'] = 'test-cron-secret';
process.env['EVM_PRIVATE_KEY'] = '0x0000000000000000000000000000000000000000000000000000000000000001';
process.env['SOLANA_PRIVATE_KEY'] = 'test-solana-key';
process.env['SUI_PRIVATE_KEY'] = 'test-sui-key';
process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = 'a'.repeat(64); // 32-byte hex
process.env['PORT'] = '0';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../config/database', () => {
  const mockCollection = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }) }) }), toArray: jest.fn().mockResolvedValue([]) }),
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

// ── Mock StellarController — testes de auth não precisam de lógica real ──────
jest.mock('../../controllers/StellarController', () => ({
  StellarController: jest.fn().mockImplementation(() => ({
    createEscrow: (_req: any, res: any) => res.status(200).json({ success: true }),
    getPaymentXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    getRefundXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    releasePayment: (_req: any, res: any) => res.status(200).json({ success: true }),
    refundEscrow: (_req: any, res: any) => res.status(200).json({ success: true }),
    getEscrowStatus: (_req: any, res: any) => res.status(200).json({ success: true }),
    openDispute: (_req: any, res: any) => res.status(200).json({ success: true }),
    getDisputeXDR: (_req: any, res: any) => res.status(200).json({ success: true }),
    claimDispute: (_req: any, res: any) => res.status(200).json({ success: true }),
    listDisputes: (_req: any, res: any) => res.status(200).json({ success: true }),
    resolveDispute: (_req: any, res: any) => res.status(200).json({ success: true }),
  })),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';

function makeToken(role: string): string {
  return jwt.sign(
    { userId: 'user-id', email: 'test@test.com', role },
    process.env['JWT_SECRET']!,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' }
  );
}

const hostToken = makeToken('HOST');
const creatorToken = makeToken('CREATOR');
const adminToken = makeToken('ADMIN');

// ── Helpers ───────────────────────────────────────────────────────────────────

const STELLAR = '/api/stellar';

describe('VULN-001: Auth Guard — endpoints Stellar sem credenciais retornam 401', () => {
  it('POST /escrow/create → 401 sem token', async () => {
    const res = await request(app).post(`${STELLAR}/escrow/create`).send({});
    expect(res.status).toBe(401);
  });

  it('GET /escrow/:id/payment-xdr → 401 sem token', async () => {
    const res = await request(app).get(`${STELLAR}/escrow/job-123/payment-xdr`);
    expect(res.status).toBe(401);
  });

  it('GET /escrow/:id/refund-xdr → 401 sem token', async () => {
    const res = await request(app).get(`${STELLAR}/escrow/job-123/refund-xdr`);
    expect(res.status).toBe(401);
  });

  it('POST /escrow/release → 401 sem token', async () => {
    const res = await request(app).post(`${STELLAR}/escrow/release`).send({});
    expect(res.status).toBe(401);
  });

  it('POST /escrow/refund → 401 sem token', async () => {
    const res = await request(app).post(`${STELLAR}/escrow/refund`).send({});
    expect(res.status).toBe(401);
  });

  it('GET /escrow/:id/status → 401 sem token', async () => {
    const res = await request(app).get(`${STELLAR}/escrow/job-123/status`);
    expect(res.status).toBe(401);
  });

  it('POST /dispute → 401 sem token', async () => {
    const res = await request(app).post(`${STELLAR}/dispute`).send({});
    expect(res.status).toBe(401);
  });

  it('POST /dispute/claim → 401 sem token', async () => {
    const res = await request(app).post(`${STELLAR}/dispute/claim`).send({});
    expect(res.status).toBe(401);
  });
});

describe('Auth Guard — token inválido retorna 401', () => {
  it('POST /escrow/create com token malformado → 401', async () => {
    const res = await request(app)
      .post(`${STELLAR}/escrow/create`)
      .set('Authorization', 'Bearer token.invalido.aqui')
      .send({});
    expect(res.status).toBe(401);
  });

  it('POST /escrow/release com token expirado → 401', async () => {
    const expiredToken = jwt.sign(
      { userId: 'u1', email: 'x@x.com', role: 'HOST' },
      process.env['JWT_SECRET']!,
      { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: -1 }
    );
    const res = await request(app)
      .post(`${STELLAR}/escrow/release`)
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('Admin Guard — não-admin retorna 403', () => {
  it('GET /admin/disputes com token HOST → 403', async () => {
    const res = await request(app)
      .get(`${STELLAR}/admin/disputes`)
      .set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /admin/disputes com token CREATOR → 403', async () => {
    const res = await request(app)
      .get(`${STELLAR}/admin/disputes`)
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /admin/resolve com token HOST → 403', async () => {
    const res = await request(app)
      .post(`${STELLAR}/admin/resolve`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('Admin com token válido ADMIN → 200', async () => {
    const res = await request(app)
      .get(`${STELLAR}/admin/disputes`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Endpoint público com token HOST → 200 (passa authGuard)', async () => {
    const res = await request(app)
      .post(`${STELLAR}/escrow/create`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    expect(res.status).toBe(200);
  });
});
