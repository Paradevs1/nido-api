/**
 * Unit tests: StellarUtil
 *
 * Cobre todos os métodos estáticos da classe StellarUtil,
 * incluindo os error paths de getTreasuryKeypair / getArbiterKeypair.
 */

// jest.mock é hoisted — factory roda antes de qualquer import,
// por isso geramos os keypairs de teste dentro dela.
jest.mock('../config/stellar', () => {
  const { Keypair } = jest.requireActual('@stellar/stellar-sdk');
  const treKp = Keypair.random();
  const arbKp = Keypair.random();
  const mockLoadAccount = jest.fn();

  return {
    stellarConfig: {
      network: 'testnet',
      usdc: {
        code: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      },
      treasury: { publicKey: treKp.publicKey(), secretKey: treKp.secret() },
      arbiter: { publicKey: arbKp.publicKey(), secretKey: arbKp.secret() },
      defaults: { timeout: 180, deadlineDays: 15, baseFee: '100' },
    },
    stellarServer: { loadAccount: mockLoadAccount },
    // Exposed for test access
    __mockLoadAccount: mockLoadAccount,
    __treasuryKp: treKp,
    __arbiterKp: arbKp,
  };
});

import { Keypair, Asset } from '@stellar/stellar-sdk';
import { StellarUtil } from '../utils/stellar.util';

const configMock = require('../config/stellar');
const mockLoadAccount = configMock.__mockLoadAccount as jest.Mock;

beforeEach(() => {
  mockLoadAccount.mockReset();
});

// ─── generateKeypair ──────────────────────────────────────────────────────────

describe('StellarUtil.generateKeypair()', () => {
  it('returns a Keypair with a valid public key', () => {
    const kp = StellarUtil.generateKeypair();
    expect(kp).toBeInstanceOf(Keypair);
    expect(StellarUtil.isValidPublicKey(kp.publicKey())).toBe(true);
  });

  it('returns a different keypair on each call', () => {
    const a = StellarUtil.generateKeypair();
    const b = StellarUtil.generateKeypair();
    expect(a.publicKey()).not.toBe(b.publicKey());
  });
});

// ─── isValidPublicKey ─────────────────────────────────────────────────────────

describe('StellarUtil.isValidPublicKey()', () => {
  it('returns true for a valid Stellar public key', () => {
    const kp = Keypair.random();
    expect(StellarUtil.isValidPublicKey(kp.publicKey())).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(StellarUtil.isValidPublicKey('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(StellarUtil.isValidPublicKey('not-a-key')).toBe(false);
  });

  it('returns false for a base58-like string that is not a valid G-key', () => {
    expect(StellarUtil.isValidPublicKey('GABC12345INVALID')).toBe(false);
  });

  it('returns false for a Stellar secret key (S-key) instead of public key', () => {
    const kp = Keypair.random();
    expect(StellarUtil.isValidPublicKey(kp.secret())).toBe(false);
  });
});

// ─── calculateDeadline ────────────────────────────────────────────────────────

describe('StellarUtil.calculateDeadline()', () => {
  it('returns now + days * 86400 as a unix timestamp', () => {
    const before = Math.floor(Date.now() / 1000);
    const deadline = StellarUtil.calculateDeadline(15);
    const after = Math.floor(Date.now() / 1000);

    expect(deadline).toBeGreaterThanOrEqual(before + 15 * 86400);
    expect(deadline).toBeLessThanOrEqual(after + 15 * 86400);
  });

  it('works with 0 days (deadline is now)', () => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = StellarUtil.calculateDeadline(0);
    expect(Math.abs(deadline - now)).toBeLessThan(2);
  });

  it('works with large day values', () => {
    const deadline = StellarUtil.calculateDeadline(365);
    const expected = Math.floor(Date.now() / 1000) + 365 * 86400;
    expect(Math.abs(deadline - expected)).toBeLessThan(2);
  });
});

// ─── getUSDCAsset ─────────────────────────────────────────────────────────────

describe('StellarUtil.getUSDCAsset()', () => {
  it('returns an Asset with code USDC', () => {
    const asset = StellarUtil.getUSDCAsset();
    expect(asset).toBeInstanceOf(Asset);
    expect(asset.code).toBe('USDC');
  });

  it('returns the USDC issuer from stellarConfig', () => {
    const asset = StellarUtil.getUSDCAsset();
    expect(asset.issuer).toBe('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
  });
});

// ─── loadAccount ─────────────────────────────────────────────────────────────

describe('StellarUtil.loadAccount()', () => {
  it('returns the account from Horizon on success', async () => {
    const mockAccount = { id: 'G123', balances: [], signers: [] };
    mockLoadAccount.mockResolvedValueOnce(mockAccount);

    const result = await StellarUtil.loadAccount('G123');
    expect(result).toBe(mockAccount);
    expect(mockLoadAccount).toHaveBeenCalledWith('G123');
  });

  it('wraps Horizon errors in a descriptive message', async () => {
    mockLoadAccount.mockRejectedValueOnce(new Error('404 Not Found'));

    await expect(StellarUtil.loadAccount('GBADKEY')).rejects.toThrow(
      /Failed to load account GBADKEY.*404/
    );
  });
});

// ─── getTreasuryKeypair ───────────────────────────────────────────────────────

describe('StellarUtil.getTreasuryKeypair()', () => {
  it('returns a Keypair when STELLAR_TREASURY_SECRET_KEY is configured', () => {
    const kp = StellarUtil.getTreasuryKeypair();
    expect(kp).toBeInstanceOf(Keypair);
    // Should match the keypair used in the mock
    expect(kp.publicKey()).toBe(configMock.__treasuryKp.publicKey());
  });

  it('throws when treasury secret key is missing', () => {
    const original = configMock.stellarConfig.treasury.secretKey;
    configMock.stellarConfig.treasury.secretKey = '';

    expect(() => StellarUtil.getTreasuryKeypair()).toThrow(
      /STELLAR_TREASURY_SECRET_KEY not configured/
    );

    configMock.stellarConfig.treasury.secretKey = original;
  });
});

// ─── getArbiterKeypair ────────────────────────────────────────────────────────

describe('StellarUtil.getArbiterKeypair()', () => {
  it('returns a Keypair when STELLAR_ARBITER_SECRET_KEY is configured', () => {
    const kp = StellarUtil.getArbiterKeypair();
    expect(kp).toBeInstanceOf(Keypair);
    expect(kp.publicKey()).toBe(configMock.__arbiterKp.publicKey());
  });

  it('throws when arbiter secret key is missing', () => {
    const original = configMock.stellarConfig.arbiter.secretKey;
    configMock.stellarConfig.arbiter.secretKey = '';

    expect(() => StellarUtil.getArbiterKeypair()).toThrow(
      /STELLAR_ARBITER_SECRET_KEY not configured/
    );

    configMock.stellarConfig.arbiter.secretKey = original;
  });
});
