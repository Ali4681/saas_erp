import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  ActivityStatus,
  ContractStatus,
  CrmActivityType,
  CrmContactType,
  OpportunityStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { CrmService } from './crm.service';

class CreateContactBody {
  @IsEnum(CrmContactType)
  contactType!: CrmContactType;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateContactBody {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(CrmContactType)
  contactType?: CrmContactType;

  @IsOptional()
  @IsEnum({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' })
  status?: 'ACTIVE' | 'INACTIVE';
}

class CreateOpportunityBody {
  @IsString()
  contactId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  pipelineId?: string;

  @IsOptional()
  @IsString()
  stageId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsNumberString()
  estimatedValue?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  expectedCloseDate?: string;
}

class UpdateOpportunityBody {
  @IsEnum(OpportunityStatus)
  status!: OpportunityStatus;

  @IsOptional()
  @IsString()
  stageId?: string;
}

class CreateActivityBody {
  @IsEnum(CrmActivityType)
  activityType!: CrmActivityType;

  @IsString()
  @MinLength(2)
  subject!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  opportunityId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

class UpdateActivityStatusBody {
  @IsEnum(ActivityStatus)
  status!: ActivityStatus;
}

class CreateContractBody {
  @IsString()
  contactId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  opportunityId?: string;

  @IsOptional()
  @IsString()
  startsOn?: string;

  @IsOptional()
  @IsString()
  endsOn?: string;

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

class UpdateContractStatusBody {
  @IsEnum(ContractStatus)
  status!: ContractStatus;
}

@Controller('companies/:companyId/crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('contacts')
  @RequirePermissions('crm.read')
  listContacts(@Param('companyId') companyId: string) {
    return this.crm.listContacts(companyId);
  }

  @Post('contacts')
  @RequirePermissions('crm.write')
  createContact(
    @Param('companyId') companyId: string,
    @Body() body: CreateContactBody,
  ) {
    return this.crm.createContact({ companyId, ...body });
  }

  @Patch('contacts/:contactId')
  @RequirePermissions('crm.write')
  updateContact(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Body() body: UpdateContactBody,
  ) {
    return this.crm.updateContact(companyId, contactId, body);
  }

  @Get('pipelines')
  @RequirePermissions('crm.read')
  listPipelines(@Param('companyId') companyId: string) {
    return this.crm.listPipelines(companyId);
  }

  @Post('pipelines/default')
  @RequirePermissions('crm.write')
  ensureDefaultPipeline(@Param('companyId') companyId: string) {
    return this.crm.ensureDefaultPipeline(companyId);
  }

  @Get('opportunities')
  @RequirePermissions('crm.read')
  listOpportunities(@Param('companyId') companyId: string) {
    return this.crm.listOpportunities(companyId);
  }

  @Post('opportunities')
  @RequirePermissions('crm.write')
  createOpportunity(
    @Param('companyId') companyId: string,
    @Body() body: CreateOpportunityBody,
  ) {
    return this.crm.createOpportunity({ companyId, ...body });
  }

  @Patch('opportunities/:opportunityId/status')
  @RequirePermissions('crm.write')
  updateOpportunityStatus(
    @Param('companyId') companyId: string,
    @Param('opportunityId') opportunityId: string,
    @Body() body: UpdateOpportunityBody,
  ) {
    return this.crm.updateOpportunityStatus(
      companyId,
      opportunityId,
      body.status,
      body.stageId,
    );
  }

  @Get('activities')
  @RequirePermissions('crm.read')
  listActivities(
    @Param('companyId') companyId: string,
    @Query('status') status?: ActivityStatus,
  ) {
    return this.crm.listActivities(companyId, status);
  }

  @Post('activities')
  @RequirePermissions('crm.write')
  createActivity(
    @Param('companyId') companyId: string,
    @Body() body: CreateActivityBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.crm.createActivity({
      companyId,
      createdById: user.userId,
      ...body,
    });
  }

  @Patch('activities/:activityId/status')
  @RequirePermissions('crm.write')
  updateActivityStatus(
    @Param('companyId') companyId: string,
    @Param('activityId') activityId: string,
    @Body() body: UpdateActivityStatusBody,
  ) {
    return this.crm.updateActivityStatus(companyId, activityId, body.status);
  }

  @Get('contracts')
  @RequirePermissions('crm.read')
  listContracts(@Param('companyId') companyId: string) {
    return this.crm.listContracts(companyId);
  }

  @Post('contracts')
  @RequirePermissions('crm.write')
  createContract(
    @Param('companyId') companyId: string,
    @Body() body: CreateContractBody,
  ) {
    return this.crm.createContract({ companyId, ...body });
  }

  @Patch('contracts/:contractId/status')
  @RequirePermissions('crm.write')
  updateContractStatus(
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() body: UpdateContractStatusBody,
  ) {
    return this.crm.updateContractStatus(companyId, contractId, body.status);
  }
}
