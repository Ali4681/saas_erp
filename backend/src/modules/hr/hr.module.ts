import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';
import { HrController } from './hr.controller';
import { HrIdentityScheduler } from './hr-identity.scheduler';
import { HrService } from './hr.service';

@Module({
  imports: [
    forwardRef(() => AutomationModule),
    PlatformModule,
    NotificationsModule,
  ],
  controllers: [HrController],
  providers: [HrService, HrIdentityScheduler],
  exports: [HrService],
})
export class HrModule {}
