import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PaymentMethod,
  PurchaseOrderStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { PurchasingService } from './purchasing.service';

class PoLineBody {
  @IsString()
  itemId!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitCost!: string;

  @IsOptional()
  @IsNumberString()
  taxAmount?: string;
}

class BillLineBody {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumberString()
  quantity!: string;

  @IsNumberString()
  unitCost!: string;

  @IsOptional()
  @IsNumberString()
  taxAmount?: string;

  @IsOptional()
  @IsString()
  itemId?: string;
}

class CreateSupplierBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CreatePoBody {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  orderedOn?: string;

  @IsOptional()
  @IsString()
  expectedOn?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PoLineBody)
  items!: PoLineBody[];
}

class UpdatePoStatusBody {
  @IsEnum(PurchaseOrderStatus)
  status!: PurchaseOrderStatus;
}

class ReceivePoBody {
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

class CreateBillBody {
  @IsString()
  supplierId!: string;

  @IsString()
  billNumber!: string;

  @IsString()
  issuedOn!: string;

  @IsOptional()
  @IsString()
  dueOn?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsEnum({ DRAFT: 'DRAFT', ISSUED: 'ISSUED' })
  status?: 'DRAFT' | 'ISSUED';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillLineBody)
  items!: BillLineBody[];
}

class RecordPaymentBody {
  @IsString()
  supplierBillId!: string;

  @IsNumberString()
  amount!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  externalReference?: string;
}

@Controller('companies/:companyId/purchasing')
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('suppliers')
  @RequirePermissions('purchasing.read')
  listSuppliers(@Param('companyId') companyId: string) {
    return this.purchasing.listSuppliers(companyId);
  }

  @Post('suppliers')
  @RequirePermissions('purchasing.write')
  createSupplier(
    @Param('companyId') companyId: string,
    @Body() body: CreateSupplierBody,
  ) {
    return this.purchasing.createSupplier({ companyId, ...body });
  }

  @Get('purchase-orders')
  @RequirePermissions('purchasing.read')
  listPurchaseOrders(@Param('companyId') companyId: string) {
    return this.purchasing.listPurchaseOrders(companyId);
  }

  @Post('purchase-orders')
  @RequirePermissions('purchasing.write')
  createPurchaseOrder(
    @Param('companyId') companyId: string,
    @Body() body: CreatePoBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasing.createPurchaseOrder({
      companyId,
      requestedById: user.userId,
      ...body,
    });
  }

  @Patch('purchase-orders/:purchaseOrderId/status')
  @RequirePermissions('purchasing.write')
  updatePoStatus(
    @Param('companyId') companyId: string,
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body() body: UpdatePoStatusBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasing.updatePurchaseOrderStatus(
      companyId,
      purchaseOrderId,
      body.status,
      user.userId,
    );
  }

  @Post('purchase-orders/:purchaseOrderId/receive')
  @RequirePermissions('purchasing.write')
  receivePo(
    @Param('companyId') companyId: string,
    @Param('purchaseOrderId') purchaseOrderId: string,
    @Body() body: ReceivePoBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.purchasing.receivePurchaseOrder(
      companyId,
      purchaseOrderId,
      user.userId,
      body.warehouseId,
    );
  }

  @Get('bills')
  @RequirePermissions('purchasing.read')
  listBills(@Param('companyId') companyId: string) {
    return this.purchasing.listBills(companyId);
  }

  @Post('bills')
  @RequirePermissions('purchasing.write')
  createBill(
    @Param('companyId') companyId: string,
    @Body() body: CreateBillBody,
  ) {
    return this.purchasing.createBill({ companyId, ...body });
  }

  @Post('payments')
  @RequirePermissions('purchasing.write')
  recordPayment(
    @Param('companyId') companyId: string,
    @Body() body: RecordPaymentBody,
  ) {
    return this.purchasing.recordPayment({ companyId, ...body });
  }
}
