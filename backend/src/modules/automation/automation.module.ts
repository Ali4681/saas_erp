import { Module, forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CrmModule } from '../crm/crm.module';
import { WorkModule } from '../work/work.module';
import { SalesModule } from '../sales/sales.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchasingModule } from '../purchasing/purchasing.module';
import { HrModule } from '../hr/hr.module';
import { AutomationActionExecutor } from './automation.actions';
import { AutomationController } from './automation.controller';
import { AutomationEngine } from './automation.engine';
import { AutomationScheduler } from './automation.scheduler';
import { AutomationService } from './automation.service';

@Module({
  imports: [
    NotificationsModule,
    forwardRef(() => CrmModule),
    forwardRef(() => WorkModule),
    forwardRef(() => SalesModule),
    forwardRef(() => InventoryModule),
    forwardRef(() => PurchasingModule),
    forwardRef(() => HrModule),
  ],
  controllers: [AutomationController],
  providers: [
    AutomationService,
    AutomationEngine,
    AutomationActionExecutor,
    AutomationScheduler,
  ],
  exports: [AutomationService, AutomationEngine],
})
export class AutomationModule {}
