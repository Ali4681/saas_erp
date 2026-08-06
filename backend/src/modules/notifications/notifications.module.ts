import { Module } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [FirebaseAdminService, NotificationsService],
  exports: [NotificationsService, FirebaseAdminService],
})
export class NotificationsModule {}
