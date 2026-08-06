import { Global, Module } from '@nestjs/common';
import { EncryptionSelfCheck } from './encryption.self-check';
import { EncryptionService } from './encryption.service';

@Global()
@Module({
  providers: [EncryptionService, EncryptionSelfCheck],
  exports: [EncryptionService, EncryptionSelfCheck],
})
export class EncryptionModule {}
