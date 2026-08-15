import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EncryptedPayload = {
  /** Binary blob: version(2) + iv(12) + authTag(16) + ciphertext */
  ciphertext: Buffer;
  keyVersion: number;
};

@Injectable()
export class EncryptionService {
  private readonly keys = new Map<number, Buffer>();
  private readonly currentVersion: number;

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('ENCRYPTION_KEYS');
    const parsed = JSON.parse(raw) as Record<string, string>;

    for (const [version, keyBase64] of Object.entries(parsed)) {
      const key = Buffer.from(keyBase64, 'base64');
      if (key.length !== 32) {
        throw new Error(
          `ENCRYPTION_KEYS version ${version} must be 32 bytes (AES-256), got ${key.length}`,
        );
      }
      this.keys.set(Number(version), key);
    }

    this.currentVersion = Number(
      config.get('ENCRYPTION_KEY_VERSION') ?? Math.max(...this.keys.keys()),
    );

    if (!this.keys.has(this.currentVersion)) {
      throw new Error(
        `ENCRYPTION_KEY_VERSION ${this.currentVersion} is not present in ENCRYPTION_KEYS`,
      );
    }
  }

  encrypt(plaintext: string): EncryptedPayload {
    const key = this.keys.get(this.currentVersion)!;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const versionBuf = Buffer.alloc(2);
    versionBuf.writeUInt16BE(this.currentVersion, 0);

    return {
      ciphertext: Buffer.concat([versionBuf, iv, authTag, encrypted]),
      keyVersion: this.currentVersion,
    };
  }

  decrypt(ciphertext: Buffer): string {
    if (ciphertext.length < 2 + 12 + 16) {
      throw new Error('ciphertext too short');
    }

    const keyVersion = ciphertext.readUInt16BE(0);
    const key = this.keys.get(keyVersion);
    if (!key) {
      throw new Error(`Unknown encryption key version ${keyVersion}`);
    }

    const iv = ciphertext.subarray(2, 14);
    const authTag = ciphertext.subarray(14, 30);
    const encrypted = ciphertext.subarray(30);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
