import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import {
  CompanyPaymentMethodsController,
  PaymentGatewaysCatalogController,
} from './payment-gateways.controller';

@Module({
  controllers: [
    FinanceController,
    PaymentGatewaysCatalogController,
    CompanyPaymentMethodsController,
  ],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
