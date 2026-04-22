// Set env vars before any import
process.env['JWT_SECRET'] = 'test-secret-key-for-jest';
process.env['MONGODB_URI'] = 'mongodb://localhost:27017/test';
process.env['CRON_SECRET'] = 'test-cron-secret';
process.env['EVM_PRIVATE_KEY'] = '0x0000000000000000000000000000000000000000000000000000000000000001';
process.env['SOLANA_PRIVATE_KEY'] = 'test-solana-key';
process.env['SUI_PRIVATE_KEY'] = 'test-sui-key';
process.env['PORT'] = '0'; // random available port

// Mock database before importing app
jest.mock('../config/database', () => {
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

// Mock PaymentController to avoid real payment logic
jest.mock('../controllers/PaymentController', () => {
  return {
    PaymentController: jest.fn().mockImplementation(() => ({
      getBalanceSOL: (_req: any, res: any) => res.status(200).json({ balance: 0 }),
      getBalanceEVM: (_req: any, res: any) => res.status(200).json({ balance: 0 }),
      getBalanceSUI: (_req: any, res: any) => res.status(200).json({ balance: 0 }),
      getBalanceStellar: (_req: any, res: any) => res.status(200).json({ balance: 0 }),
      sendTokenWinners: (_req: any, res: any) => res.status(200).json({ success: true }),
      paymentKolsSelective: (_req: any, res: any) => res.status(200).json({ success: true }),
      paymentHostCreate: (_req: any, res: any) => res.status(200).json({ success: true }),
      paymentHostConfirm: (_req: any, res: any) => res.status(200).json({ success: true }),
      paymentPlanCreate: (_req: any, res: any) => res.status(200).json({ success: true }),
      paymentPlanConfirm: (_req: any, res: any) => res.status(200).json({ success: true }),
    })),
  };
});

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

function generateToken(role: string): string {
  return jwt.sign(
    { userId: '507f1f77bcf86cd799439011', email: 'test@test.com', role },
    process.env['JWT_SECRET']!,
    { issuer: 'bounties-api', audience: 'bounties-users', expiresIn: '1h' }
  );
}

const adminToken = generateToken('ADMIN');
const hostToken = generateToken('HOST');
const creatorToken = generateToken('CREATOR');

describe('Payment Routes - Guard Tests', () => {

  // ========== Balance routes — Admin only ==========

  const balanceRoutes = [
    '/api/payments/solana/balance',
    '/api/payments/evm/balance',
    '/api/payments/sui/balance',
    '/api/payments/stellar/balance',
  ];

  describe.each(balanceRoutes)('GET %s (admin only)', (route) => {
    it('should return 401 without token', async () => {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    });

    it('should return 403 for CREATOR', async () => {
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${creatorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for HOST', async () => {
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 200 for ADMIN', async () => {
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ========== Payment routes — Host only ==========

  const hostPostRoutes = [
    '/api/payments/send-winners/507f1f77bcf86cd799439011',
    '/api/payments/send-payment-kols-selective/507f1f77bcf86cd799439011',
    '/api/payments/payment-host-create',
    '/api/payments/payment-host-confirm',
    '/api/payments/plan-create',
    '/api/payments/plan-confirm',
  ];

  describe.each(hostPostRoutes)('POST %s (host only)', (route) => {
    it('should return 401 without token', async () => {
      const res = await request(app).post(route);
      expect(res.status).toBe(401);
    });

    it('should return 403 for CREATOR', async () => {
      const res = await request(app)
        .post(route)
        .set('Authorization', `Bearer ${creatorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for ADMIN', async () => {
      const res = await request(app)
        .post(route)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 200 for HOST', async () => {
      const res = await request(app)
        .post(route)
        .set('Authorization', `Bearer ${hostToken}`);
      expect(res.status).toBe(200);
    });
  });
});
