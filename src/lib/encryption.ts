/**
 * Encryption utilities for sensitive data (AWS credentials)
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits

/**
 * Get encryption key from environment variable
 * In production, this should be stored securely (e.g., AWS KMS, HashiCorp Vault)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Key should be base64-encoded 32 bytes (256 bits)
  const keyBuffer = Buffer.from(key, 'base64');
  
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits) when base64 decoded');
  }

  return keyBuffer;
}

/**
 * Generate a secure encryption key
 * Use this to generate ENCRYPTION_KEY for .env file
 */
export function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32); // 256 bits
  return key.toString('base64');
}

/**
 * Encrypt sensitive data
 * Returns base64-encoded string in format: iv:authTag:encryptedData
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encryptedData (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * Expects base64-encoded string in format: iv:authTag:encryptedData
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const [ivB64, authTagB64, encryptedB64] = parts;
    
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt AWS credentials object
 */
export interface AWSCredentials {
  access_key_id?: string;
  secret_access_key?: string;
  session_token?: string;
}

export function encryptCredentials(credentials: AWSCredentials): {
  access_key_id_encrypted?: string;
  secret_access_key_encrypted?: string;
  session_token_encrypted?: string;
} {
  return {
    access_key_id_encrypted: credentials.access_key_id 
      ? encrypt(credentials.access_key_id) 
      : undefined,
    secret_access_key_encrypted: credentials.secret_access_key 
      ? encrypt(credentials.secret_access_key) 
      : undefined,
    session_token_encrypted: credentials.session_token 
      ? encrypt(credentials.session_token) 
      : undefined,
  };
}

/**
 * Decrypt AWS credentials object
 */
export function decryptCredentials(encrypted: {
  access_key_id_encrypted?: string;
  secret_access_key_encrypted?: string;
  session_token_encrypted?: string;
}): AWSCredentials {
  return {
    access_key_id: encrypted.access_key_id_encrypted 
      ? decrypt(encrypted.access_key_id_encrypted) 
      : undefined,
    secret_access_key: encrypted.secret_access_key_encrypted 
      ? decrypt(encrypted.secret_access_key_encrypted) 
      : undefined,
    session_token: encrypted.session_token_encrypted 
      ? decrypt(encrypted.session_token_encrypted) 
      : undefined,
  };
}

/**
 * Test encryption/decryption
 * Use for validating ENCRYPTION_KEY
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-secret-data-' + Date.now();
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    return testData === decrypted;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
