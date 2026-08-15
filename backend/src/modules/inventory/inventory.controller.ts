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
  IsArray,
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { StockMovementType } from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { InventoryService } from './inventory.service';

class CreateCategoryBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

class CreateUnitBody {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  decimalPlaces?: number;
}

class CreateItemBody {
  @IsString()
  unitId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  itemCategoryId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumberString()
  cost?: string;

  @IsOptional()
  @IsNumberString()
  salePrice?: string;

  @IsOptional()
  @IsNumberString()
  minStock?: string;

  @IsOptional()
  @IsNumberString()
  taxRate?: string;

  @IsOptional()
  @IsString()
  parentItemId?: string;
}

class CreateWarehouseBody {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;
}

class CreateMovementBody {
  @IsString()
  warehouseId!: string;

  @IsString()
  itemId!: string;

  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsNumberString()
  unitCost?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;
}

class CreateCountBody {
  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}

class CountLineBody {
  @IsString()
  itemId!: string;

  @IsNumberString()
  countedQuantity!: string;
}

class BalancesQuery {
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

@Controller('companies/:companyId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('categories')
  @RequirePermissions('inventory.read')
  listCategories(@Param('companyId') companyId: string) {
    return this.inventory.listCategories(companyId);
  }

  @Post('categories')
  @RequirePermissions('inventory.write')
  createCategory(
    @Param('companyId') companyId: string,
    @Body() body: CreateCategoryBody,
  ) {
    return this.inventory.createCategory({ companyId, ...body });
  }

  @Get('units')
  @RequirePermissions('inventory.read')
  listUnits(@Param('companyId') companyId: string) {
    return this.inventory.listUnits(companyId);
  }

  @Post('units')
  @RequirePermissions('inventory.write')
  createUnit(
    @Param('companyId') companyId: string,
    @Body() body: CreateUnitBody,
  ) {
    return this.inventory.createUnit({ companyId, ...body });
  }

  @Get('items')
  @RequirePermissions('inventory.read')
  listItems(@Param('companyId') companyId: string) {
    return this.inventory.listItems(companyId);
  }

  @Post('items')
  @RequirePermissions('inventory.write')
  createItem(
    @Param('companyId') companyId: string,
    @Body() body: CreateItemBody,
  ) {
    return this.inventory.createItem({ companyId, ...body });
  }

  @Get('warehouses')
  @RequirePermissions('inventory.read')
  listWarehouses(@Param('companyId') companyId: string) {
    return this.inventory.listWarehouses(companyId);
  }

  @Post('warehouses')
  @RequirePermissions('inventory.write')
  createWarehouse(
    @Param('companyId') companyId: string,
    @Body() body: CreateWarehouseBody,
  ) {
    return this.inventory.createWarehouse({ companyId, ...body });
  }

  @Get('balances')
  @RequirePermissions('inventory.read')
  listBalances(
    @Param('companyId') companyId: string,
    @Query() query: BalancesQuery,
  ) {
    return this.inventory.listBalances(companyId, query.warehouseId);
  }

  @Get('movements')
  @RequirePermissions('inventory.read')
  listMovements(@Param('companyId') companyId: string) {
    return this.inventory.listMovements(companyId);
  }

  @Post('movements')
  @RequirePermissions('inventory.write')
  createMovement(
    @Param('companyId') companyId: string,
    @Body() body: CreateMovementBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.createMovement({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Get('counts')
  @RequirePermissions('inventory.read')
  listCounts(@Param('companyId') companyId: string) {
    return this.inventory.listCounts(companyId);
  }

  @Post('counts')
  @RequirePermissions('inventory.write')
  createCount(
    @Param('companyId') companyId: string,
    @Body() body: CreateCountBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.createStockCount({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('counts/:stockCountId/lines')
  @RequirePermissions('inventory.write')
  submitCountLine(
    @Param('companyId') companyId: string,
    @Param('stockCountId') stockCountId: string,
    @Body() body: CountLineBody,
  ) {
    return this.inventory.submitCountLine(
      companyId,
      stockCountId,
      body.itemId,
      body.countedQuantity,
    );
  }

  @Post('counts/:stockCountId/approve')
  @RequirePermissions('inventory.write')
  approveCount(
    @Param('companyId') companyId: string,
    @Param('stockCountId') stockCountId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventory.approveStockCount(
      companyId,
      stockCountId,
      user.userId,
    );
  }
}
