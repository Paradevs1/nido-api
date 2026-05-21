import { Keypair } from '@stellar/stellar-sdk';
import { StellarEscrowModel, IStellarEscrow, EscrowStatus } from '../../models/StellarEscrow';

// ─── Mock database layer ───────────────────────────────────────────────────────
//
//  We replace the real MongoDB driver with an in-memory store so this suite
//  runs without a running MongoDB instance while still exercising every method
//  on StellarEscrowModel.
// ─────────────────────────────────────────────────────────────────────────────

const inMemoryDB: Map<string, IStellarEscrow & { _id: string }> = new Map();
let idCounter = 0;

jest.mock('../../config/database', () => ({
  getBountiesDB: jest.fn().mockResolvedValue({
    collection: jest.fn().mockReturnValue({
      insertOne: jest.fn(async (doc: IStellarEscrow) => {
        const id = String(++idCounter);
        inMemoryDB.set(id, { ...doc, _id: id } as any);
        return { insertedId: id };
      }),
      findOne: jest.fn(async (filter: any) => {
        for (const doc of inMemoryDB.values()) {
          if (
            (filter.job_id && doc.job_id === filter.job_id) ||
            (filter.escrow_public_key && doc.escrow_public_key === filter.escrow_public_key)
          ) {
            return doc;
          }
        }
        return null;
      }),
      find: jest.fn((filter: any) => ({
        toArray: jest.fn(async () => {
          return [...inMemoryDB.values()].filter(doc => {
            if (filter.host_public_key)
              return doc.host_public_key === filter.host_public_key;
            if (filter.talent_public_key)
              return doc.talent_public_key === filter.talent_public_key;
            if (filter.status) return doc.status === filter.status;
            return true;
          });
        }),
        sort: jest.fn().mockReturnThis(),
      })),
      updateOne: jest.fn(async (filter: any, update: any) => {
        for (const [id, doc] of inMemoryDB.entries()) {
          if (filter.job_id && doc.job_id === filter.job_id) {
            inMemoryDB.set(id, { ...doc, ...update.$set });
            return { modifiedCount: 1 };
          }
        }
        return { modifiedCount: 0 };
      }),
      deleteMany: jest.fn(async (filter: any) => {
        let count = 0;
        for (const [id, doc] of inMemoryDB.entries()) {
          const statusMatch = filter.status?.$in?.includes(doc.status);
          const dateMatch = filter.created_at?.$lt
            ? doc.created_at < filter.created_at.$lt
            : true;
          if (statusMatch && dateMatch) {
            inMemoryDB.delete(id);
            count++;
          }
        }
        return { deletedCount: count };
      }),
      countDocuments: jest.fn(async () => inMemoryDB.size),
      createIndex: jest.fn(async () => ({})),
      aggregate: jest.fn((pipeline: any[]) => ({
        toArray: jest.fn(async () => {
          const group = pipeline?.[0]?.$group;
          if (!group) return [];
          if (group._id === '$status') {
            const counts: Record<string, number> = {};
            for (const doc of inMemoryDB.values()) {
              counts[doc.status] = (counts[doc.status] || 0) + 1;
            }
            return Object.entries(counts).map(([s, c]) => ({ _id: s, count: c }));
          }
          if (group._id === null) {
            const total = [...inMemoryDB.values()].reduce(
              (sum, d) => sum + parseFloat(d.amount || '0'),
              0
            );
            return inMemoryDB.size ? [{ total }] : [];
          }
          return [];
        }),
      })),
    }),
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEscrowData(overrides: Partial<IStellarEscrow> = {}) {
  const host = Keypair.random();
  const talent = Keypair.random();
  const escrow = Keypair.random();
  const arbiter = Keypair.random();

  return {
    job_id: `job-${Math.random().toString(36).slice(2)}`,
    escrow_public_key: escrow.publicKey(),
    host_public_key: host.publicKey(),
    talent_public_key: talent.publicKey(),
    arbiter_public_key: arbiter.publicKey(),
    amount: '100',
    asset_code: 'USDC',
    status: EscrowStatus.FUNDED,
    ...overrides,
  } as Omit<IStellarEscrow, '_id' | 'created_at' | 'updated_at'>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StellarEscrowModel (MongoDB integration – in-memory)', () => {
  beforeEach(() => {
    inMemoryDB.clear();
    idCounter = 0;
    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should persist escrow and return it with _id', async () => {
      const data = makeEscrowData();
      const result = await StellarEscrowModel.create(data);

      expect(result._id).toBeDefined();
      expect(result.job_id).toBe(data.job_id);
      expect(result.amount).toBe('100');
    });

    it('should set created_at and updated_at automatically', async () => {
      const data = makeEscrowData();
      const before = new Date();
      const result = await StellarEscrowModel.create(data);
      const after = new Date();

      expect(result.created_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.created_at.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should not overwrite provided fields', async () => {
      const data = makeEscrowData({ status: EscrowStatus.COMPLETED });
      const result = await StellarEscrowModel.create(data);
      expect(result.status).toBe(EscrowStatus.COMPLETED);
    });
  });

  // ─── findByJobId ──────────────────────────────────────────────────────────

  describe('findByJobId', () => {
    it('should return null for a non-existent jobId', async () => {
      const result = await StellarEscrowModel.findByJobId('does-not-exist');
      expect(result).toBeNull();
    });

    it('should find an escrow by jobId after creation', async () => {
      const data = makeEscrowData({ job_id: 'find-me-123' });
      await StellarEscrowModel.create(data);

      const found = await StellarEscrowModel.findByJobId('find-me-123');
      expect(found).not.toBeNull();
      expect(found?.job_id).toBe('find-me-123');
    });
  });

  // ─── findByPublicKey ──────────────────────────────────────────────────────

  describe('findByPublicKey', () => {
    it('should return null for a public key that was not stored', async () => {
      const result = await StellarEscrowModel.findByPublicKey(
        Keypair.random().publicKey()
      );
      expect(result).toBeNull();
    });

    it('should find an escrow by its escrow_public_key', async () => {
      const escrowKey = Keypair.random().publicKey();
      const data = makeEscrowData({ escrow_public_key: escrowKey });
      await StellarEscrowModel.create(data);

      const found = await StellarEscrowModel.findByPublicKey(escrowKey);
      expect(found).not.toBeNull();
      expect(found?.escrow_public_key).toBe(escrowKey);
    });
  });

  // ─── findByHostPublicKey ──────────────────────────────────────────────────

  describe('findByHostPublicKey', () => {
    it('should return an empty array when host has no escrows', async () => {
      const results = await StellarEscrowModel.findByHostPublicKey(
        Keypair.random().publicKey()
      );
      expect(results).toEqual([]);
    });

    it('should return all escrows for a given host', async () => {
      const hostKey = Keypair.random().publicKey();
      await StellarEscrowModel.create(makeEscrowData({ host_public_key: hostKey }));
      await StellarEscrowModel.create(makeEscrowData({ host_public_key: hostKey }));

      const results = await StellarEscrowModel.findByHostPublicKey(hostKey);
      expect(results).toHaveLength(2);
      results.forEach(r => expect(r.host_public_key).toBe(hostKey));
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should return false for a non-existent jobId', async () => {
      const updated = await StellarEscrowModel.updateStatus(
        'ghost-job',
        EscrowStatus.COMPLETED
      );
      expect(updated).toBe(false);
    });

    it('should update and return true for an existing escrow', async () => {
      const data = makeEscrowData({ job_id: 'update-me', status: EscrowStatus.FUNDED });
      await StellarEscrowModel.create(data);

      const updated = await StellarEscrowModel.updateStatus(
        'update-me',
        EscrowStatus.COMPLETED
      );
      expect(updated).toBe(true);
    });
  });

  // ─── findByStatus ─────────────────────────────────────────────────────────

  describe('findByStatus', () => {
    it('should return escrows that match the requested status', async () => {
      await StellarEscrowModel.create(makeEscrowData({ status: EscrowStatus.FUNDED }));
      await StellarEscrowModel.create(makeEscrowData({ status: EscrowStatus.COMPLETED }));

      const funded = await StellarEscrowModel.findByStatus(EscrowStatus.FUNDED);
      expect(funded.length).toBeGreaterThanOrEqual(1);
      funded.forEach(e => expect(e.status).toBe(EscrowStatus.FUNDED));
    });
  });

  // ─── findByTalentPublicKey ────────────────────────────────────────────────

  describe('findByTalentPublicKey', () => {
    it('should return empty array when talent has no escrows', async () => {
      const results = await StellarEscrowModel.findByTalentPublicKey(
        Keypair.random().publicKey()
      );
      expect(results).toEqual([]);
    });

    it('should return all escrows for a given talent', async () => {
      const talentKey = Keypair.random().publicKey();
      await StellarEscrowModel.create(makeEscrowData({ talent_public_key: talentKey }));
      await StellarEscrowModel.create(makeEscrowData({ talent_public_key: talentKey }));

      const results = await StellarEscrowModel.findByTalentPublicKey(talentKey);
      expect(results).toHaveLength(2);
      results.forEach(r => expect(r.talent_public_key).toBe(talentKey));
    });
  });

  // ─── ensureIndexes ────────────────────────────────────────────────────────

  describe('ensureIndexes', () => {
    it('should create indexes without throwing', async () => {
      await expect(StellarEscrowModel.ensureIndexes()).resolves.toBeUndefined();
    });
  });

  // ─── create — duplicate key error ─────────────────────────────────────────

  describe('create — duplicate key', () => {
    it('should throw a descriptive error on duplicate job_id (code 11000)', async () => {
      const { getBountiesDB } = require('../../config/database');
      const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      getBountiesDB.mockResolvedValueOnce({
        collection: jest.fn().mockReturnValue({
          insertOne: jest.fn().mockRejectedValue(dupError),
        }),
      });

      await expect(
        StellarEscrowModel.create(makeEscrowData({ job_id: 'dup-job' }))
      ).rejects.toThrow('Escrow already exists for job dup-job');
    });
  });

  // ─── updateTxHash ─────────────────────────────────────────────────────────

  describe('updateTxHash', () => {
    it('should return false for a non-existent jobId', async () => {
      const updated = await StellarEscrowModel.updateTxHash('ghost', 'tx-hash');
      expect(updated).toBe(false);
    });

    it('should update stellar_tx_hash and return true', async () => {
      await StellarEscrowModel.create(makeEscrowData({ job_id: 'tx-job' }));
      const updated = await StellarEscrowModel.updateTxHash('tx-job', 'new-tx-hash');
      expect(updated).toBe(true);
    });
  });

  // ─── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return total count, byStatus breakdown, and totalAmount', async () => {
      await StellarEscrowModel.create(makeEscrowData({ status: EscrowStatus.FUNDED, amount: '100' }));
      await StellarEscrowModel.create(makeEscrowData({ status: EscrowStatus.COMPLETED, amount: '200' }));

      const stats = await StellarEscrowModel.getStats();

      expect(stats.total).toBe(2);
      expect(typeof stats.totalAmount).toBe('number');
      expect(stats.byStatus).toBeDefined();
    });

    it('should return zero totalAmount when collection is empty', async () => {
      const stats = await StellarEscrowModel.getStats();
      expect(stats.total).toBe(0);
      expect(stats.totalAmount).toBe(0);
    });
  });

  // ─── deleteOldEscrows ─────────────────────────────────────────────────────

  describe('deleteOldEscrows', () => {
    it('should delete completed and refunded escrows older than daysOld', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const host = Keypair.random();
      const talent = Keypair.random();
      const arbiter = Keypair.random();
      const escrow = Keypair.random();

      inMemoryDB.set('old-completed', {
        _id: 'old-completed',
        job_id: 'old-completed-job',
        escrow_public_key: escrow.publicKey(),
        host_public_key: host.publicKey(),
        talent_public_key: talent.publicKey(),
        arbiter_public_key: arbiter.publicKey(),
        amount: '100',
        asset_code: 'USDC',
        status: EscrowStatus.COMPLETED,
        created_at: oldDate,
        updated_at: oldDate,
      } as any);

      const deletedCount = await StellarEscrowModel.deleteOldEscrows(90);
      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });

    it('should NOT delete funded escrows (only completed/refunded)', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const kp = Keypair.random();
      inMemoryDB.set('old-funded', {
        _id: 'old-funded',
        job_id: 'old-funded-job',
        escrow_public_key: kp.publicKey(),
        host_public_key: Keypair.random().publicKey(),
        talent_public_key: Keypair.random().publicKey(),
        arbiter_public_key: Keypair.random().publicKey(),
        amount: '50',
        asset_code: 'USDC',
        status: EscrowStatus.FUNDED,
        created_at: oldDate,
        updated_at: oldDate,
      } as any);

      const before = inMemoryDB.size;
      await StellarEscrowModel.deleteOldEscrows(90);
      expect(inMemoryDB.size).toBe(before);
    });
  });
});
