import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { FinanceModule } from '../finance/finance.module';
import { PlatformModule } from '../platform/platform.module';
import { InventoryController } from './inventory.controller';
import { InventoryOpsController } from './inventory-ops.controller';
import { InventoryOpsService } from './inventory-ops.service';
import { InventoryScheduler } from './inventory.scheduler';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    forwardRef(() => AutomationModule),
    FinanceModule,
    PlatformModule,
  ],
  controllers: [InventoryController, InventoryOpsController],
  providers: [InventoryService, InventoryOpsService, InventoryScheduler],
  exports: [InventoryService, InventoryOpsService],
})
export class InventoryModule {}
