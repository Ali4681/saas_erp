import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { FinanceModule } from '../finance/finance.module';
import { CrmModule } from '../crm/crm.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { ZatcaService } from './zatca.service';

@Module({
  imports: [
    forwardRef(() => AutomationModule),
    forwardRef(() => FinanceModule),
    forwardRef(() => CrmModule),
  ],
  controllers: [SalesController],
  providers: [SalesService, ZatcaService],
  exports: [SalesService, ZatcaService],
})
export class SalesModule {}
