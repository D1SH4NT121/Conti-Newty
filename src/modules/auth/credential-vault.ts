import crypto from 'crypto';
import { config } from '../../config';

// AES-256-GCM encryption for credentials
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export class CredentialVault {
  public static encrypt(secret: string): string {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(config.jwtSecret, salt, 32);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Store as salt:iv:cipher:tag in hex
    return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
  }

  public static decrypt(saltIvCipherTag: string): string {
    const parts = saltIvCipherTag.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted credential format');
    }
    const [saltHex, ivHex, cipherHex, tagHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const key = crypto.scryptSync(config.jwtSecret, salt, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
