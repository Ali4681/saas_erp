import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  ApprovalThresholdAction,
  BusinessHoursMode,
  TwelveHourPeriodMode,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { BusinessHoursService } from './business-hours.service';
import { GovernanceService } from './governance.service';
import { IndustryService } from './industry.service';

class UpsertBusinessHoursBody {
  @IsOptional()
  @IsEnum(BusinessHoursMode)
  mode?: BusinessHoursMode;

  @IsOptional()
  @IsString()
  defaultStartTime?: string;

  @IsOptional()
  @IsString()
  defaultEndTime?: string;

  @IsOptional()
  @IsBoolean()
  autoSplitShifts?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  autoShiftHours?: number;

  @IsOptional()
  @IsEnum(TwelveHourPeriodMode)
  twelveHourMode?: TwelveHourPeriodMode;

  @IsOptional()
  @IsString()
  period2StartTime?: string;

  @IsOptional()
  @IsString()
  period2EndTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class AddWindowBody {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt!: string;
}

class ApplyIndustryBody {
  @IsString()
  industryActivityId!: string;
}

class UpsertThresholdBody {
  @IsOptional()
  @IsString()
  id?: string;

  @IsEnum(ApprovalThresholdAction)
  actionType!: ApprovalThresholdAction;

  @IsNumberString()
  maxAmount!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  requiredPermission!: string;

  @IsOptional()
  @IsString()
  escalatePermission?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class LockPeriodBody {
  @IsString()
  periodStart!: string;

  @IsString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  backdateUntil?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class BreakGlassBody {
  @IsString()
  @MinLength(10)
  reason!: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes?: number;
}

@Controller('companies/:companyId')
export class GovernanceController {
  constructor(
    private readonly businessHours: BusinessHoursService,
    private readonly industry: IndustryService,
    private readonly governance: GovernanceService,
  ) {}

  @Get('business-hours')
  @RequirePermissions('companies.read')
  getBusinessHours(@Param('companyId') companyId: string) {
    return this.businessHours.getProfile(companyId);
  }

  @Put('business-hours')
  @RequirePermissions('companies.write')
  upsertBusinessHours(
    @Param('companyId') companyId: string,
    @Body() body: UpsertBusinessHoursBody,
  ) {
    return this.businessHours.upsertProfile(companyId, body);
  }

  @Post('business-hours/generate-shifts')
  @RequirePermissions('companies.write')
  generateShifts(@Param('companyId') companyId: string) {
    return this.businessHours.generateShifts(companyId);
  }

  @Post('business-hours/install-standard-shifts')
  @RequirePermissions('companies.write')
  installStandardShifts(@Param('companyId') companyId: string) {
    return this.businessHours.installStandardShifts(companyId);
  }

  @Post('business-hours/windows')
  @RequirePermissions('companies.write')
  addWindow(
    @Param('companyId') companyId: string,
    @Body() body: AddWindowBody,
  ) {
    return this.businessHours.addWindow(companyId, body);
  }

  @Delete('business-hours/windows/:windowId')
  @RequirePermissions('companies.write')
  deleteWindow(
    @Param('companyId') companyId: string,
    @Param('windowId') windowId: string,
  ) {
    return this.businessHours.deleteWindow(companyId, windowId);
  }

  @Get('industry-activities')
  @RequirePermissions('companies.read')
  async listIndustries() {
    await this.industry.ensureCatalog();
    return this.industry.listCatalog();
  }

  @Get('industry-activations')
  @RequirePermissions('companies.read')
  listActivations(@Param('companyId') companyId: string) {
    return this.industry.listActivations(companyId);
  }

  @Post('industry-activations')
  @RequirePermissions('companies.write')
  applyIndustry(
    @Param('companyId') companyId: string,
    @Body() body: ApplyIndustryBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.industry.applyPack(
      companyId,
      body.industryActivityId,
      user.userId,
    );
  }

  @Get('governance/sod-rules')
  @RequirePermissions('users.read')
  listSod(@Param('companyId') companyId: string) {
    return this.governance.listSodRules(companyId);
  }

  @Get('governance/thresholds')
  @RequirePermissions('finance.read')
  listThresholds(@Param('companyId') companyId: string) {
    return this.governance.listThresholds(companyId);
  }

  @Post('governance/thresholds')
  @RequirePermissions('finance.write')
  upsertThreshold(
    @Param('companyId') companyId: string,
    @Body() body: UpsertThresholdBody,
  ) {
    return this.governance.upsertThreshold(companyId, body);
  }

  @Get('governance/period-locks')
  @RequirePermissions('finance.read')
  listPeriodLocks(@Param('companyId') companyId: string) {
    return this.governance.listPeriodLocks(companyId);
  }

  @Post('governance/period-locks')
  @RequirePermissions('finance.write')
  lockPeriod(
    @Param('companyId') companyId: string,
    @Body() body: LockPeriodBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.lockPeriod(companyId, user.userId, body);
  }

  @Get('governance/break-glass')
  @RequirePermissions('users.read')
  listBreakGlass(@Param('companyId') companyId: string) {
    return this.governance.listBreakGlass(companyId);
  }

  @Post('governance/break-glass')
  @RequirePermissions('users.write')
  openBreakGlass(
    @Param('companyId') companyId: string,
    @Body() body: BreakGlassBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.openBreakGlass(companyId, user.userId, body);
  }

  @Post('governance/break-glass/:sessionId/revoke')
  @RequirePermissions('users.write')
  revokeBreakGlass(
    @Param('companyId') companyId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.governance.revokeBreakGlass(companyId, sessionId, user.userId);
  }
}
