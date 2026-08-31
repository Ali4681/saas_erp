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
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RequirePermissions } from '../../common/auth/auth.decorators';
import { PosService } from './pos.service';

class CreatePosBody {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string;

  @IsOptional()
  @IsString()
  locationNote?: string;
}

class UpdatePosBody {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  companyBranchId?: string | null;

  @IsOptional()
  @IsString()
  locationNote?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

class AddCashierBody {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

class UpdateCashierBody {
  @IsOptional()
  @IsString()
  displayName?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

@Controller('companies/:companyId/sales/pos')
export class PosController {
  constructor(private readonly pos: PosService) {}

  @Get('branches')
  @RequirePermissions('sales.read')
  listBranches(@Param('companyId') companyId: string) {
    return this.pos.listBranches(companyId);
  }

  @Get()
  @RequirePermissions('sales.read')
  list(@Param('companyId') companyId: string) {
    return this.pos.listPointsOfSale(companyId);
  }

  @Get('cashiers')
  @RequirePermissions('sales.read')
  listCashiers(
    @Param('companyId') companyId: string,
    @Query('pointOfSaleId') pointOfSaleId?: string,
  ) {
    return this.pos.listCashiers(companyId, pointOfSaleId);
  }

  @Post()
  @RequirePermissions('sales.write')
  create(
    @Param('companyId') companyId: string,
    @Body() body: CreatePosBody,
  ) {
    return this.pos.createPointOfSale({ companyId, ...body });
  }

  @Patch('cashiers/:cashierId')
  @RequirePermissions('sales.write')
  updateCashier(
    @Param('companyId') companyId: string,
    @Param('cashierId') cashierId: string,
    @Body() body: UpdateCashierBody,
  ) {
    return this.pos.updateCashier(companyId, cashierId, body);
  }

  @Post('cashiers/:cashierId/deactivate')
  @RequirePermissions('sales.write')
  deactivateCashier(
    @Param('companyId') companyId: string,
    @Param('cashierId') cashierId: string,
  ) {
    return this.pos.removeCashier(companyId, cashierId);
  }

  @Post(':posId/cashiers')
  @RequirePermissions('sales.write')
  addCashier(
    @Param('companyId') companyId: string,
    @Param('posId') posId: string,
    @Body() body: AddCashierBody,
  ) {
    return this.pos.addCashier({
      companyId,
      pointOfSaleId: posId,
      ...body,
    });
  }

  @Patch(':posId')
  @RequirePermissions('sales.write')
  update(
    @Param('companyId') companyId: string,
    @Param('posId') posId: string,
    @Body() body: UpdatePosBody,
  ) {
    return this.pos.updatePointOfSale(companyId, posId, body);
  }
}
