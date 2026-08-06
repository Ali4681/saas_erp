import { Module } from '@nestjs/common';
import { BrevoClient } from './brevo.client';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  controllers: [MessagingController],
  providers: [BrevoClient, MessagingService],
  exports: [MessagingService, BrevoClient],
})
export class MessagingModule {}
