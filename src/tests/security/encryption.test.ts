/**
 * Suite: Encryption — AES-256-GCM
 * Testa as funções de criptografia de chaves privadas do escrow.
 *
 * Cobre:
 *  - VULN-004: secret não é mais base64 puro
 *  - Roundtrip encrypt → decrypt
 *  - Tamper detection via auth tag
 *  - Ausência de STELLAR_ESCROW_ENCRYPTION_KEY lança erro
 *  - IV aleatório: dois encrypt do mesmo valor produzem ciphertexts diferentes
 */

import { Keypair } from '@stellar/stellar-sdk';
import * as fc from 'fast-check';

// Definido antes de importar o módulo
const TEST_KEY = 'deadbeef'.repeat(8); // 32 bytes hex = 64 chars
process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = TEST_KEY;

import { encryptSecret, decryptSecret } from '../../utils/stellar-crypto';

describe('VULN-004: AES-256-GCM Key Storage', () => {
  const sampleSecret = Keypair.random().secret();

  it('encrypted !== base64 puro do secret (não é encoding, é criptografia)', () => {
    const encrypted = encryptSecret(sampleSecret);
    const naiveBase64 = Buffer.from(sampleSecret).toString('base64');
    expect(encrypted).not.toBe(naiveBase64);
    expect(encrypted).not.toContain(sampleSecret);
  });

  it('decrypt(encrypt(x)) === x — roundtrip correto', () => {
    const encrypted = encryptSecret(sampleSecret);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(sampleSecret);
  });

  it('dois encrypt do mesmo secret produzem ciphertexts diferentes (IV aleatório)', () => {
    const enc1 = encryptSecret(sampleSecret);
    const enc2 = encryptSecret(sampleSecret);
    expect(enc1).not.toBe(enc2); // IVs diferentes → outputs diferentes
  });

  it('output tem prefixo IV 24 hex + auth tag 32 hex antes do ciphertext', () => {
    const encrypted = encryptSecret(sampleSecret);
    // IV: 12 bytes = 24 hex chars
    // AuthTag: 16 bytes = 32 hex chars
    // Ciphertext: >= 1 char (secret Stellar tem 56 chars)
    expect(encrypted.length).toBeGreaterThan(24 + 32);
    // Todos hex válidos
    expect(/^[0-9a-f]+$/.test(encrypted)).toBe(true);
  });
});

describe('Tamper Detection — auth tag AES-GCM', () => {
  it('lança erro ao alterar último byte do ciphertext', () => {
    const encrypted = encryptSecret(Keypair.random().secret());
    // Corrompe o último byte do ciphertext
    const lastByte = encrypted.slice(-2);
    const tamperedByte = lastByte === 'ff' ? '00' : 'ff';
    const tampered = encrypted.slice(0, -2) + tamperedByte;

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('lança erro ao alterar o auth tag (bytes 24–56)', () => {
    const encrypted = encryptSecret(Keypair.random().secret());
    // Corrompe o primeiro byte da auth tag (offset 24)
    const tagByte = encrypted.slice(24, 26);
    const tamperedByte = tagByte === 'ff' ? '00' : 'ff';
    const tampered = encrypted.slice(0, 24) + tamperedByte + encrypted.slice(26);

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('lança erro ao alterar o IV (primeiros 24 chars)', () => {
    const encrypted = encryptSecret(Keypair.random().secret());
    const ivByte = encrypted.slice(0, 2);
    const tamperedByte = ivByte === 'ff' ? '00' : 'ff';
    const tampered = tamperedByte + encrypted.slice(2);

    // IV errado → decryption falha ou auth tag não bate
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe('Env var ausente', () => {
  const originalKey = process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];

  afterEach(() => {
    process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = originalKey;
  });

  it('encryptSecret lança quando STELLAR_ESCROW_ENCRYPTION_KEY não está definida', () => {
    delete process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];
    expect(() => encryptSecret('S...')).toThrow(/STELLAR_ESCROW_ENCRYPTION_KEY/);
  });

  it('decryptSecret lança quando STELLAR_ESCROW_ENCRYPTION_KEY não está definida', () => {
    delete process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];
    expect(() => decryptSecret('aabbcc')).toThrow(/STELLAR_ESCROW_ENCRYPTION_KEY/);
  });
});

describe('Property-based: encryptSecret é sempre invertível', () => {
  it('para qualquer secret Stellar válido, decrypt(encrypt(s)) === s', () => {
    fc.assert(
      fc.property(
        fc.constant(null).map(() => Keypair.random().secret()),
        (secret) => {
          process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = TEST_KEY;
          const roundtrip = decryptSecret(encryptSecret(secret));
          return roundtrip === secret;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('nunca produz output idêntico ao base64 do input', () => {
    fc.assert(
      fc.property(
        fc.constant(null).map(() => Keypair.random().secret()),
        (secret) => {
          process.env['STELLAR_ESCROW_ENCRYPTION_KEY'] = TEST_KEY;
          const encrypted = encryptSecret(secret);
          const naiveBase64 = Buffer.from(secret).toString('base64');
          return encrypted !== naiveBase64;
        }
      ),
      { numRuns: 20 }
    );
  });
});
