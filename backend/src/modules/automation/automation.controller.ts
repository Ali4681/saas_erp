import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AutomationStatus } from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { AutomationService } from './automation.service';
import type { AutomationActionInput } from './automation.actions';

class CreateRuleBody {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  module!: string;

  @IsString()
  triggerEvent!: string;

  @IsArray()
  actions!: AutomationActionInput[];

  @IsOptional()
  @IsArray()
  conditions?: unknown[];

  @IsOptional()
  @IsString()
  scheduleCron?: string;

  @IsOptional()
  @IsEnum(AutomationStatus)
  status?: AutomationStatus;
}

class UpdateRuleStatusBody {
  @IsEnum(AutomationStatus)
  status!: AutomationStatus;
}

class ExecuteBody {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;
}

class InstallTemplateBody {
  @IsString()
  templateCode!: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}

class InstallTemplatesBulkBody {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}

class RunsQuery {
  @IsOptional()
  @IsString()
  ruleId?: string;
}

@Controller('companies/:companyId/automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('catalog')
  @RequirePermissions('automation.read')
  catalog() {
    return this.automation.catalog();
  }

  @Get('summary')
  @RequirePermissions('automation.read')
  summary(@Param('companyId') companyId: string) {
    return this.automation.summary(companyId);
  }

  @Post('templates/install')
  @RequirePermissions('automation.write')
  installTemplate(
    @Param('companyId') companyId: string,
    @Body() body: InstallTemplateBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automation.installTemplate({
      companyId,
      createdById: user.userId,
      templateCode: body.templateCode,
      assigneeUserId: body.assigneeUserId,
      activate: body.activate !== false,
    });
  }

  @Post('templates/install-bulk')
  @RequirePermissions('automation.write')
  installTemplatesBulk(
    @Param('companyId') companyId: string,
    @Body() body: InstallTemplatesBulkBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automation.installTemplatesBulk({
      companyId,
      createdById: user.userId,
      module: body.module,
      assigneeUserId: body.assigneeUserId,
      activate: body.activate !== false,
    });
  }

  @Get('rules')
  @RequirePermissions('automation.read')
  listRules(@Param('companyId') companyId: string) {
    return this.automation.listRules(companyId);
  }

  @Post('rules')
  @RequirePermissions('automation.write')
  createRule(
    @Param('companyId') companyId: string,
    @Body() body: CreateRuleBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.automation.createRule({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('rules/:ruleId/status')
  @RequirePermissions('automation.write')
  updateRuleStatus(
    @Param('companyId') companyId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: UpdateRuleStatusBody,
  ) {
    return this.automation.updateRuleStatus(companyId, ruleId, body.status);
  }

  @Post('rules/:ruleId/execute')
  @RequirePermissions('automation.write')
  executeRule(
    @Param('companyId') companyId: string,
    @Param('ruleId') ruleId: string,
    @Body() body: ExecuteBody,
  ) {
    return this.automation.executeRule(companyId, ruleId, body);
  }

  @Get('runs')
  @RequirePermissions('automation.read')
  listRuns(
    @Param('companyId') companyId: string,
    @Query() query: RunsQuery,
  ) {
    return this.automation.listRuns(companyId, query.ruleId);
  }
}
