import { Injectable } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * Lightweight self-check used by Phase 1 probe endpoint / future health hooks.
 */
@Injectable()
export class EncryptionSelfCheck {
  constructor(private readonly encryption: EncryptionService) {}

  run(sample = 'iban:SA0380000000608010167519'): {
    ok: boolean;
    keyVersion: number;
  } {
    const encrypted = this.encryption.encrypt(sample);
    const decrypted = this.encryption.decrypt(encrypted.ciphertext);
    return {
      ok: decrypted === sample,
      keyVersion: encrypted.keyVersion,
    };
  }
}
