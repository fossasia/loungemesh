import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

// AES-256 requires a 32-byte key (256 bits).
// We parse the hex string from environment variables.
const getEncryptionKey = (): Buffer => {
  if (!ENCRYPTION_KEY_HEX) {
    throw new Error('ENCRYPTION_KEY environment variable is not defined.');
  }
  if (ENCRYPTION_KEY_HEX.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
  }
  return Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits is recommended for GCM

export function encryptToken(text: string): string {
  if (!text) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Return IV, ciphertext, and tag joined by colons
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

export function decryptToken(encryptedText: string): string {
  if (!encryptedText) return '';
  const key = getEncryptionKey();
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format. Expected iv:ciphertext:tag');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const authTag = Buffer.from(parts[2], 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
