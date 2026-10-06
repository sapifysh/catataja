import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'catat-gmail-oauth-salt-v1';

/**
 * Derives a 32-byte AES key from the server's GOOGLE_CLIENT_SECRET.
 */
function getDerivedKey(): Buffer {
  const secret = process.env.GOOGLE_CLIENT_SECRET || 'catat-secure-default-secret-fallback';
  return crypto.scryptSync(secret, SALT, 32);
}

export interface EncryptedPayload {
  ciphertext: string; // hex
  iv: string;         // hex
  tag: string;        // hex
}

/**
 * Encrypts plaintext string using AES-256-GCM with server secret.
 */
export function encryptData(plaintext: string): EncryptedPayload {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypts AES-256-GCM payload using server secret.
 */
export function decryptData(payload: EncryptedPayload): string {
  const key = getDerivedKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(payload.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
