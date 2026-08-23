import { Module } from '@nestjs/common';
import { GovernanceModule } from '../governance/governance.module';
import { CashierShiftsController } from './cashier-shifts.controller';
import { CashierShiftsService } from './cashier-shifts.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { GlController } from './gl.controller';
import { GlService } from './gl.service';
import {
  CompanyPaymentMethodsController,
  PaymentGatewaysCatalogController,
} from './payment-gateways.controller';

@Module({
  imports: [GovernanceModule],
  controllers: [
    FinanceController,
    GlController,
    PaymentGatewaysCatalogController,
    CompanyPaymentMethodsController,
    CashierShiftsController,
  ],
  providers: [FinanceService, CashierShiftsService, GlService],
  exports: [FinanceService, CashierShiftsService, GlService],
})
export class FinanceModule {}
