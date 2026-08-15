import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformModule } from '../platform/platform.module';
import { SalesModule } from '../sales/sales.module';
import { UsersModule } from '../users/users.module';
import { HrController } from './hr.controller';
import { HrIdentityScheduler } from './hr-identity.scheduler';
import { HrQiwaService } from './hr-qiwa.service';
import { HrService } from './hr.service';

@Module({
  imports: [
    forwardRef(() => AutomationModule),
    forwardRef(() => SalesModule),
    PlatformModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [HrController],
  providers: [HrService, HrQiwaService, HrIdentityScheduler],
  exports: [HrService, HrQiwaService],
})
export class HrModule {}
