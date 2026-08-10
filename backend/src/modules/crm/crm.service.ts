import {
  Inject,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  ActivityStatus,
  ContractStatus,
  CrmActivityType,
  CrmContactType,
  OpportunityStatus,
} from '../../generated/prisma/client';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly docNumbers: DocumentNumberService,
    @Inject(forwardRef(() => AutomationEngine))
    private readonly automation: AutomationEngine,
  ) {}

  private emit(
    companyId: string,
    event: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ) {
    void this.automation
      .dispatch({ companyId, event, entityType, entityId, payload })
      .catch((error) => {
        this.logger.warn(
          `automation ${event} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      });
  }

  // --- Contacts ---

  listContacts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.crmContact.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
  }

  async createContact(input: {
    companyId: string;
    contactType: CrmContactType;
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    source?: string;
    ownerUserId?: string;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const contact = await this.prisma.crmContact.create({
      data: {
        companyId: input.companyId,
        contactType: input.contactType,
        name: input.name,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        source: input.source,
        ownerUserId: input.ownerUserId,
        notes: input.notes,
      },
    });

    const payload = {
      contactId: contact.id,
      contactType: contact.contactType,
      name: contact.name,
      ownerUserId: contact.ownerUserId,
      assigneeUserId: contact.ownerUserId,
    };
    this.emit(
      input.companyId,
      'crm.contact.created',
      'crm_contact',
      contact.id,
      payload,
    );
    if (contact.contactType === 'LEAD') {
      this.emit(
        input.companyId,
        'crm.lead.created',
        'crm_contact',
        contact.id,
        payload,
      );
    }

    return contact;
  }

  async updateContact(
    companyId: string,
    contactId: string,
    data: {
      name?: string;
      companyName?: string;
      email?: string;
      phone?: string;
      source?: string;
      ownerUserId?: string | null;
      notes?: string;
      contactType?: CrmContactType;
      status?: 'ACTIVE' | 'INACTIVE';
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireContact(companyId, contactId);
    return this.prisma.crmContact.update({
      where: { id: contactId },
      data,
    });
  }

  // --- Pipelines ---

  listPipelines(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.crmPipeline.findMany({
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async ensureDefaultPipeline(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const existing = await this.prisma.crmPipeline.findFirst({
      where: { companyId, isDefault: true },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.crmPipeline.create({
      data: {
        companyId,
        name: 'Default Pipeline',
        isDefault: true,
        defaultCompanyId: companyId,
        stages: {
          create: [
            { name: 'New', position: 1, probability: 10 },
            { name: 'Qualified', position: 2, probability: 30 },
            { name: 'Proposal', position: 3, probability: 60 },
            { name: 'Won', position: 4, probability: 100, isClosed: true },
            { name: 'Lost', position: 5, probability: 0, isClosed: true },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  // --- Opportunities ---

  listOpportunities(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.crmOpportunity.findMany({
      include: {
        contact: { select: { id: true, name: true, contactType: true } },
        stage: true,
        pipeline: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async createOpportunity(input: {
    companyId: string;
    contactId: string;
    title: string;
    pipelineId?: string;
    stageId?: string;
    ownerUserId?: string;
    estimatedValue?: string | number;
    currency?: string;
    expectedCloseDate?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireContact(input.companyId, input.contactId);

    let pipelineId = input.pipelineId;
    let stageId = input.stageId;
    if (!pipelineId || !stageId) {
      const pipeline = await this.ensureDefaultPipeline(input.companyId);
      pipelineId = pipelineId ?? pipeline.id;
      stageId = stageId ?? pipeline.stages[0]?.id;
    }
    if (!stageId) {
      throw new BadRequestException('Pipeline has no stages');
    }

    const stage = await this.prisma.crmPipelineStage.findFirst({
      where: { id: stageId, pipelineId },
    });
    if (!stage) {
      throw new BadRequestException('Stage does not belong to pipeline');
    }

    return this.prisma.crmOpportunity.create({
      data: {
        companyId: input.companyId,
        contactId: input.contactId,
        pipelineId,
        stageId,
        title: input.title,
        ownerUserId: input.ownerUserId,
        estimatedValue: input.estimatedValue
          ? String(input.estimatedValue)
          : undefined,
        currency: input.currency ?? 'SAR',
        expectedCloseDate: input.expectedCloseDate
          ? new Date(input.expectedCloseDate)
          : undefined,
      },
      include: { stage: true, contact: true },
    });
  }

  async updateOpportunityStatus(
    companyId: string,
    opportunityId: string,
    status: OpportunityStatus,
    stageId?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const opportunity = await this.prisma.crmOpportunity.findFirst({
      where: { id: opportunityId, companyId },
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    if (stageId) {
      const stage = await this.prisma.crmPipelineStage.findFirst({
        where: { id: stageId, pipelineId: opportunity.pipelineId },
      });
      if (!stage) {
        throw new BadRequestException('Stage does not belong to pipeline');
      }
    }

    return this.prisma.crmOpportunity.update({
      where: { id: opportunityId },
      data: {
        status,
        ...(stageId ? { stageId } : {}),
      },
      include: { stage: true },
    }).then((updated) => {
      this.emit(
        companyId,
        'crm.opportunity.status_changed',
        'crm_opportunity',
        updated.id,
        {
          opportunityId: updated.id,
          contactId: updated.contactId,
          status: updated.status,
          previousStatus: opportunity.status,
          stageId: updated.stageId,
          stageName: updated.stage?.name ?? '',
          ownerUserId: updated.ownerUserId,
          assigneeUserId: updated.ownerUserId,
          interested:
            /qualified|interest|مهتم|تأهيل/i.test(updated.stage?.name ?? '') ||
            Number(updated.stage?.probability ?? 0) >= 30,
        },
      );
      return updated;
    });
  }

  // --- Activities ---

  listActivities(companyId: string, status?: ActivityStatus) {
    this.tenant.setCompanyId(companyId);
    const allowed = new Set(Object.values(ActivityStatus));
    const statusFilter =
      status && allowed.has(status) ? status : undefined;
    return this.prisma.crmActivity.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: {
        contact: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { scheduledAt: 'desc' }],
      take: 200,
    });
  }

  async createActivity(input: {
    companyId: string;
    createdById: string;
    activityType: CrmActivityType;
    subject: string;
    notes?: string;
    contactId?: string;
    opportunityId?: string;
    scheduledAt?: string;
    assignedToId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    if (input.contactId) {
      await this.requireContact(input.companyId, input.contactId);
    }
    if (input.opportunityId) {
      const opp = await this.prisma.crmOpportunity.findFirst({
        where: { id: input.opportunityId, companyId: input.companyId },
      });
      if (!opp) {
        throw new BadRequestException('Opportunity not found');
      }
    }

    return this.prisma.crmActivity.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById,
        activityType: input.activityType,
        subject: input.subject,
        notes: input.notes,
        contactId: input.contactId,
        opportunityId: input.opportunityId,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : undefined,
        assignedToId: input.assignedToId,
      },
    });
  }

  async updateActivityStatus(
    companyId: string,
    activityId: string,
    status: ActivityStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const activity = await this.prisma.crmActivity.findFirst({
      where: { id: activityId, companyId },
    });
    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
    return this.prisma.crmActivity.update({
      where: { id: activityId },
      data: {
        status,
        ...(status === 'COMPLETED' && !activity.occurredAt
          ? { occurredAt: new Date() }
          : {}),
      },
    });
  }

  // --- Contracts ---

  listContracts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.crmContract.findMany({
      include: {
        contact: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createContract(input: {
    companyId: string;
    contactId: string;
    title: string;
    opportunityId?: string;
    startsOn?: string;
    endsOn?: string;
    value?: string | number;
    currency?: string;
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireContact(input.companyId, input.contactId);

    return this.prisma.$transaction(async (tx) => {
      const contractNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'contract',
      );
      return tx.crmContract.create({
        data: {
          companyId: input.companyId,
          contactId: input.contactId,
          opportunityId: input.opportunityId,
          contractNumber,
          title: input.title,
          startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
          endsOn: input.endsOn ? new Date(input.endsOn) : undefined,
          value: input.value ? String(input.value) : undefined,
          currency: input.currency ?? 'SAR',
          notes: input.notes,
        },
      });
    });
  }

  async updateContractStatus(
    companyId: string,
    contractId: string,
    status: ContractStatus,
  ) {
    this.tenant.setCompanyId(companyId);
    const contract = await this.prisma.crmContract.findFirst({
      where: { id: contractId, companyId },
    });
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }
    return this.prisma.crmContract.update({
      where: { id: contractId },
      data: { status },
    });
  }

  private async requireContact(companyId: string, contactId: string) {
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return contact;
  }
}
