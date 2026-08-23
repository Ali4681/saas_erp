import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { FinanceModule } from '../finance/finance.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { LoyaltyService } from './loyalty.service';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { TicketsService } from './tickets.service';
import { CrmOpsService } from './crm-ops.service';
import { CrmScheduler } from './crm.scheduler';

@Module({
  imports: [
    forwardRef(() => AutomationModule),
    FinanceModule,
    MessagingModule,
    NotificationsModule,
  ],
  controllers: [CrmController, PricingController],
  providers: [
    CrmService,
    LoyaltyService,
    PricingService,
    TicketsService,
    CrmOpsService,
    CrmScheduler,
  ],
  exports: [CrmService, LoyaltyService, PricingService, TicketsService, CrmOpsService],
})
export class CrmModule {}
