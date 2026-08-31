import { Module, forwardRef } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { FinanceModule } from '../finance/finance.module';
import { CrmModule } from '../crm/crm.module';
import { SalesController } from './sales.controller';
import { SalesPublicController } from './sales-public.controller';
import { SalesService } from './sales.service';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { ZatcaService } from './zatca.service';

@Module({
  imports: [
    forwardRef(() => AutomationModule),
    forwardRef(() => FinanceModule),
    forwardRef(() => CrmModule),
  ],
  controllers: [SalesController, SalesPublicController, PosController],
  providers: [SalesService, PosService, ZatcaService],
  exports: [SalesService, PosService, ZatcaService],
})
export class SalesModule {}
