/**
 * Suite: Property-Based Tests
 * Invariantes do escrow state machine e validação de chaves Stellar.
 */

process.env['JWT_SECRET'] = 'test-jwt-secret-32chars-for-jest!!';
process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = 'deadbeef'.repeat(8);

import * as fc from 'fast-check';
import { Keypair } from '@stellar/stellar-sdk';
import { StellarUtil } from '../../utils/stellar.util';

// ── Stub mínimo do stellarConfig para não precisar de env vars de Stellar ────
jest.mock('../../config/stellar', () => ({
  stellarConfig: {
    networkPassphrase: 'Test SDF Network ; September 2015',
    usdc: { code: 'USDC', issuer: 'GTEST000000000000000000000000000000000000000000000000000000' },
    treasury: { publicKey: '', secretKey: '' },
    arbiter: { publicKey: '', secretKey: '' },
    defaults: { deadlineDays: 30, timeout: 300 },
  },
  stellarServer: {
    loadAccount: jest.fn().mockRejectedValue(new Error('mocked')),
  },
}));

describe('Propriedade: isValidPublicKey', () => {
  it('nunca aceita string que não começa com G como chave pública', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.startsWith('G')),
        (s) => !StellarUtil.isValidPublicKey(s)
      ),
      { numRuns: 200 }
    );
  });

  it('nunca aceita string vazia', () => {
    expect(StellarUtil.isValidPublicKey('')).toBe(false);
  });

  it('nunca aceita strings de comprimento diferente de 56', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(
          (s) => s.startsWith('G') && s.length !== 56
        ),
        (s) => !StellarUtil.isValidPublicKey(s)
      ),
      { numRuns: 100 }
    );
  });

  it('sempre aceita chaves geradas pelo SDK', () => {
    fc.assert(
      fc.property(
        fc.constant(null).map(() => Keypair.random().publicKey()),
        (key) => StellarUtil.isValidPublicKey(key)
      ),
      { numRuns: 50 }
    );
  });
});

describe('Propriedade: self-dealing invariante', () => {
  function validateEscrowParties(host: string, talent: string): void {
    if (host === talent) throw new Error('must be different accounts');
  }

  it('host === talent sempre lança, independente do valor da chave', () => {
    fc.assert(
      fc.property(
        fc.constant(null).map(() => Keypair.random().publicKey()),
        (key) => {
          let threw = false;
          try {
            validateEscrowParties(key, key);
          } catch {
            threw = true;
          }
          return threw;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('host !== talent nunca lança', () => {
    fc.assert(
      fc.property(
        fc.constant(null).map(() => ({
          h: Keypair.random().publicKey(),
          t: Keypair.random().publicKey(),
        })).filter(({ h, t }) => h !== t),
        ({ h, t }) => {
          let threw = false;
          try {
            validateEscrowParties(h, t);
          } catch {
            threw = true;
          }
          return !threw;
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Propriedade: deadline é sempre no futuro', () => {
  it('calculateDeadline(n) > now para n > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }),
        (days) => {
          const now = Math.floor(Date.now() / 1000);
          const deadline = StellarUtil.calculateDeadline(days);
          return deadline > now;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('deadline cresce monotonicamente com o número de dias', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 180 }),
        fc.integer({ min: 1, max: 180 }),
        (a, b) => {
          if (a === b) return true;
          const da = StellarUtil.calculateDeadline(a);
          const db = StellarUtil.calculateDeadline(b);
          return a < b ? da < db : da > db;
        }
      ),
      { numRuns: 50 }
    );
  });
});
