import crypto from 'crypto';
import { config } from '../../config';

// AES-256-GCM encryption for credentials
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY = crypto.scryptSync(config.jwtSecret || 'default-secret', 'salt', 32);

export class CredentialVault {
  public static encrypt(secret: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Store as iv:cipher:tag in hex
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
  }

  public static decrypt(ivCipherTag: string): string {
    const [ivHex, cipherHex, tagHex] = ivCipherTag.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(cipherHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
