import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Format: iv(12 bytes = 24 hex) + authTag(16 bytes = 32 hex) + ciphertext(hex)

export function encryptSecret(secret: string): string {
  const rawKey = process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];
  if (!rawKey) throw new Error('STELLAR_ESCROW_ENCRYPTION_KEY is not set');
  const key = Buffer.from(rawKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

export function decryptSecret(stored: string): string {
  const rawKey = process.env['STELLAR_ESCROW_ENCRYPTION_KEY'];
  if (!rawKey) throw new Error('STELLAR_ESCROW_ENCRYPTION_KEY is not set');
  const key = Buffer.from(rawKey, 'hex');
  const iv = Buffer.from(stored.slice(0, 24), 'hex');
  const tag = Buffer.from(stored.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(stored.slice(56), 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
