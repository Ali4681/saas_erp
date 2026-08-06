import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CompanyPaymentMethodStatus } from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/auth/auth.decorators';
import type { AuthUser } from '../../common/auth/auth.decorators';
import { FinanceService } from './finance.service';

class CatalogQuery {
  @IsOptional()
  @IsString()
  country?: string;
}

class EnablePaymentMethodBody {
  @ValidateIf((o: EnablePaymentMethodBody) => !o.code)
  @IsString()
  paymentGatewayId?: string;

  @ValidateIf((o: EnablePaymentMethodBody) => !o.paymentGatewayId)
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}

class UpdatePaymentMethodBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(CompanyPaymentMethodStatus)
  status?: CompanyPaymentMethodStatus;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;
}

class ChargePaymentMethodBody {
  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  salesInvoiceId?: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;

  @IsOptional()
  @IsString()
  paymentMethodToken?: string;
}

@Controller('payment-gateways')
export class PaymentGatewaysCatalogController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(@Query() query: CatalogQuery) {
    return this.finance.listPaymentGateways(query.country);
  }
}

@Controller('companies/:companyId/payment-methods')
export class CompanyPaymentMethodsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(@Param('companyId') companyId: string) {
    return this.finance.listCompanyPaymentMethods(companyId);
  }

  @Post()
  @RequirePermissions('finance.write')
  enable(
    @Param('companyId') companyId: string,
    @Body() body: EnablePaymentMethodBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.finance.enableCompanyPaymentMethod({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch(':paymentMethodId')
  @RequirePermissions('finance.write')
  update(
    @Param('companyId') companyId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: UpdatePaymentMethodBody,
  ) {
    return this.finance.updateCompanyPaymentMethod({
      companyId,
      paymentMethodId,
      ...body,
    });
  }

  @Post(':paymentMethodId/charge')
  @RequirePermissions('finance.write')
  charge(
    @Param('companyId') companyId: string,
    @Param('paymentMethodId') paymentMethodId: string,
    @Body() body: ChargePaymentMethodBody,
  ) {
    return this.finance.chargeCompanyPaymentMethod({
      companyId,
      paymentMethodId,
      ...body,
    });
  }
}
