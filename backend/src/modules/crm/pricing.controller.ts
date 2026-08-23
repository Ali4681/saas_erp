import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RequireAnyPermission, RequirePermissions, CurrentUser, type AuthUser } from '../../common/auth/auth.decorators';
import { PricingService } from './pricing.service';

class CreatePriceListBody {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  listType?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpsertEntryBody {
  @IsString()
  itemId!: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQty?: number;

  @IsOptional()
  @IsBoolean()
  isVolumeBreak?: boolean;

  @IsOptional()
  @IsNumber()
  floorPrice?: number | null;

  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validTo?: string | null;
}

class CreateCouponBody {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  couponType?: string;

  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsOptional()
  @IsNumber()
  maxUsages?: number | null;

  @IsOptional()
  @IsNumber()
  maxUsagePerContact?: number | null;

  @IsOptional()
  @IsNumber()
  minOrderAmount?: number | null;

  @IsOptional()
  @IsString()
  validFrom?: string | null;

  @IsOptional()
  @IsString()
  validTo?: string | null;

  @IsOptional()
  @IsString()
  saleChannel?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

class ValidateCouponBody {
  @IsString()
  code!: string;

  @IsNumber()
  @Min(0)
  orderAmount!: number;

  @IsOptional()
  @IsString()
  contactId?: string;
}

@Controller('companies/:companyId/crm/pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('price-lists')
  @RequirePermissions('crm.read')
  listPriceLists(@Param('companyId') companyId: string) {
    return this.pricing.listPriceLists(companyId);
  }

  @Post('price-lists')
  @RequirePermissions('crm.write')
  createPriceList(
    @Param('companyId') companyId: string,
    @Body() body: CreatePriceListBody,
  ) {
    return this.pricing.createPriceList({ companyId, ...body });
  }

  @Post('price-lists/:id/entries')
  @RequirePermissions('crm.write')
  upsertEntry(
    @Param('id') priceListId: string,
    @Body() body: UpsertEntryBody,
  ) {
    return this.pricing.upsertEntry({ priceListId, ...body });
  }

  @Get('price-lists/:id/item-price')
  @RequirePermissions('crm.read')
  getItemPrice(
    @Param('companyId') companyId: string,
    @Param('id') priceListId: string,
    @Query('itemId') itemId: string,
    @Query('qty') qty: string,
  ) {
    return this.pricing.getItemPrice(companyId, priceListId, itemId, Number(qty) || 1);
  }

  @Get('coupons')
  @RequirePermissions('crm.read')
  listCoupons(@Param('companyId') companyId: string) {
    return this.pricing.listCoupons(companyId);
  }

  @Post('coupons')
  @RequireAnyPermission('crm.write', 'crm.coupons')
  createCoupon(
    @Param('companyId') companyId: string,
    @Body() body: CreateCouponBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.pricing.createCoupon({ companyId, ...body, createdByUserId: user.userId });
  }

  @Post('coupons/validate')
  @RequirePermissions('crm.read')
  validateCoupon(
    @Param('companyId') companyId: string,
    @Body() body: ValidateCouponBody,
  ) {
    return this.pricing.validateCoupon(companyId, body.code, body.orderAmount, body.contactId);
  }

  @Post('coupons/:code/apply')
  @RequireAnyPermission('crm.write', 'crm.coupons')
  applyCoupon(
    @Param('companyId') companyId: string,
    @Param('code') code: string,
    @Body() body: { invoiceId?: string; contactId?: string },
  ) {
    return this.pricing.applyCoupon(companyId, code, body.invoiceId, body.contactId);
  }

  @Get('bundles')
  @RequirePermissions('crm.read')
  listBundles(@Param('companyId') companyId: string) {
    return this.pricing.listBundles(companyId);
  }

  @Post('bundles')
  @RequireAnyPermission('crm.write', 'crm.coupons')
  createBundle(
    @Param('companyId') companyId: string,
    @Body()
    body: {
      name: string;
      sku?: string;
      bundlePrice: number;
      items: Array<{ itemId: string; quantity?: number }>;
    },
  ) {
    return this.pricing.createBundle({ companyId, ...body });
  }
}
