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
  CustomerTrack,
  OpportunityStatus,
} from '../../generated/prisma/client';
import {
  CurrentUser,
  RequireAnyPermission,
  RequirePermissions,
  type AuthUser,
} from '../../common/auth/auth.decorators';
import { CrmService } from './crm.service';
import { LoyaltyService } from './loyalty.service';
import { TicketsService } from './tickets.service';
import { CrmOpsService } from './crm-ops.service';

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

  @IsOptional()
  @IsEnum(CustomerTrack)
  customerTrack?: CustomerTrack;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  companyRegNumber?: string;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @IsOptional()
  @IsNumberString()
  creditTermsDays?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;
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

  @IsOptional()
  @IsEnum(CustomerTrack)
  customerTrack?: CustomerTrack;

  @IsOptional()
  @IsString()
  taxNumber?: string | null;

  @IsOptional()
  @IsString()
  companyRegNumber?: string | null;

  @IsOptional()
  @IsNumberString()
  creditLimit?: string | null;

  @IsOptional()
  @IsNumberString()
  creditTermsDays?: string | null;

  @IsOptional()
  @IsString()
  dateOfBirth?: string | null;
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

  @IsOptional()
  @IsString()
  contractType?: string;

  @IsOptional()
  autoRenew?: boolean;

  @IsOptional()
  renewalAlertDays?: number;

  @IsOptional()
  @IsString()
  priceListId?: string;
}

class UpdateContractStatusBody {
  @IsEnum(ContractStatus)
  status!: ContractStatus;
}

class CreateTicketBody {
  @IsString()
  contactId!: string;

  @IsString()
  @MinLength(2)
  subject!: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  slaDeadline?: string;

  @IsOptional()
  @IsString()
  ticketKind?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  warrantyExpiresOn?: string;
}

class UpdateTicketStatusBody {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  resolution?: string;
}

class AddCommentBody {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  isInternal?: boolean;
}

class RenewContractBody {
  // empty – all data comes from the existing contract
}

@Controller('companies/:companyId/crm')
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly loyalty: LoyaltyService,
    private readonly tickets: TicketsService,
    private readonly ops: CrmOpsService,
  ) {}

  @Get('ops-settings')
  @RequirePermissions('crm.read')
  getOpsSettings(@Param('companyId') companyId: string) {
    return this.ops.getSettings(companyId);
  }

  @Patch('ops-settings')
  @RequirePermissions('crm.write')
  saveOpsSettings(
    @Param('companyId') companyId: string,
    @Body() body: Partial<{ loyalty: object; pos: object; zatca: object }>,
  ) {
    return this.ops.saveSettings(companyId, body as never);
  }

  @Post('contacts/:contactId/otp')
  @RequireAnyPermission('crm.write', 'crm.loyalty')
  requestOtp(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Body() body: { purpose?: string },
  ) {
    return this.ops.requestOtp(companyId, contactId, body.purpose ?? 'LOYALTY_REDEEM');
  }

  @Get('contacts')
  @RequirePermissions('crm.read')
  listContacts(@Param('companyId') companyId: string) {
    return this.crm.listContacts(companyId);
  }

  @Get('birthdays')
  @RequirePermissions('crm.read')
  listBirthdays(@Param('companyId') companyId: string) {
    return this.crm.listBirthdayContacts(companyId);
  }

  @Get('contacts/:contactId/insights')
  @RequirePermissions('crm.read')
  contactInsights(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.crm.contactInsights(companyId, contactId);
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

  @Get('contracts/expiring')
  @RequirePermissions('crm.read')
  listExpiringContracts(
    @Param('companyId') companyId: string,
    @Query('withinDays') withinDays?: string,
  ) {
    return this.crm.listExpiringContracts(
      companyId,
      withinDays ? Number(withinDays) : 30,
    );
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

  @Post('contracts/:contractId/renew')
  @RequirePermissions('crm.write')
  renewContract(
    @Param('companyId') companyId: string,
    @Param('contractId') contractId: string,
    @Body() _body: RenewContractBody,
  ) {
    return this.crm.renewContract(companyId, contractId);
  }

  // ── Loyalty ──────────────────────────────────────────────────────────────

  @Get('contacts/:contactId/loyalty')
  @RequirePermissions('crm.read')
  getLoyalty(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.loyalty.getLoyaltyAccount(companyId, contactId);
  }

  @Post('contacts/:contactId/loyalty/earn')
  @RequireAnyPermission('crm.write', 'crm.loyalty')
  earnPoints(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Body() body: { points: number; note?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.loyalty.earnPoints({ companyId, contactId, ...body, userId: user.userId });
  }

  @Post('contacts/:contactId/loyalty/redeem')
  @RequireAnyPermission('crm.write', 'crm.loyalty')
  redeemPoints(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Body() body: { points: number; note?: string; otpCode?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.loyalty.redeemPoints({ companyId, contactId, ...body, userId: user.userId });
  }

  // ── Store Credit ──────────────────────────────────────────────────────────

  @Get('contacts/:contactId/store-credit')
  @RequirePermissions('crm.read')
  getStoreCredit(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.loyalty.getStoreCredit(companyId, contactId);
  }

  @Post('contacts/:contactId/store-credit/credit')
  @RequirePermissions('crm.write')
  creditWallet(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Body() body: { amount: number; note?: string; sourceId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.loyalty.creditStoreWallet({ companyId, contactId, ...body, userId: user.userId });
  }

  @Post('contacts/:contactId/store-credit/debit')
  @RequirePermissions('crm.write')
  debitWallet(
    @Param('companyId') companyId: string,
    @Param('contactId') contactId: string,
    @Body() body: { amount: number; note?: string; sourceId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.loyalty.debitStoreWallet({ companyId, contactId, ...body, userId: user.userId });
  }

  // ── Support Tickets ───────────────────────────────────────────────────────

  @Get('tickets')
  @RequirePermissions('crm.read')
  listTickets(
    @Param('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    return this.tickets.listTickets(companyId, status);
  }

  @Post('tickets')
  @RequirePermissions('crm.write')
  createTicket(
    @Param('companyId') companyId: string,
    @Body() body: CreateTicketBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.createTicket({ companyId, ...body, createdByUserId: user.userId });
  }

  @Get('tickets/:ticketId')
  @RequirePermissions('crm.read')
  getTicket(
    @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.tickets.getTicket(companyId, ticketId);
  }

  @Patch('tickets/:ticketId/status')
  @RequirePermissions('crm.write')
  updateTicketStatus(
    @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: UpdateTicketStatusBody,
  ) {
    return this.tickets.updateTicketStatus(companyId, ticketId, body.status, body.resolution);
  }

  @Post('tickets/:ticketId/comments')
  @RequirePermissions('crm.write')
  addComment(
    @Param('companyId') companyId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: AddCommentBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.addComment({ companyId, ticketId, ...body, createdByUserId: user.userId });
  }
}
