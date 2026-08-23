import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { CashierShiftsService } from './cashier-shifts.service';

class OpenShiftBody {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsNumberString()
  openingFloat?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  workShiftId?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class CloseShiftBody {
  @IsNumberString()
  countedCash!: string;

  @IsOptional()
  @IsNumberString()
  cashSales?: string;

  @IsOptional()
  @IsNumberString()
  cardSales?: string;

  @IsOptional()
  @IsNumberString()
  transferSales?: string;

  @IsOptional()
  @IsNumberString()
  pettyExpenses?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class HandoverBody {
  @IsNumberString()
  amount!: string;

  @IsIn(['NEXT_CASHIER', 'TREASURY', 'BANK'])
  target!: 'NEXT_CASHIER' | 'TREASURY' | 'BANK';

  @IsOptional()
  @IsString()
  toSessionId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}

@Controller('companies/:companyId/finance/cashier-shifts')
export class CashierShiftsController {
  constructor(private readonly shifts: CashierShiftsService) {}

  @Get()
  @RequirePermissions('finance.read')
  list(
    @Param('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    return this.shifts.list(companyId, status);
  }

  @Get(':sessionId')
  @RequirePermissions('finance.read')
  get(
    @Param('companyId') companyId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.shifts.get(companyId, sessionId);
  }

  @Post()
  @RequirePermissions('finance.write')
  open(
    @Param('companyId') companyId: string,
    @Body() body: OpenShiftBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shifts.open({
      companyId,
      userId: user.userId,
      ...body,
    });
  }

  @Post(':sessionId/close')
  @RequirePermissions('finance.write')
  close(
    @Param('companyId') companyId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: CloseShiftBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shifts.close({
      companyId,
      sessionId,
      userId: user.userId,
      ...body,
    });
  }

  @Post(':sessionId/approve')
  @RequirePermissions('finance.write')
  approve(
    @Param('companyId') companyId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shifts.approve({
      companyId,
      sessionId,
      approvedByUserId: user.userId,
    });
  }

  @Post(':sessionId/handover')
  @RequirePermissions('finance.write')
  handover(
    @Param('companyId') companyId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: HandoverBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shifts.handover({
      companyId,
      fromSessionId: sessionId,
      createdByUserId: user.userId,
      ...body,
    });
  }
}
