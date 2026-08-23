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
  CustomerTrack,
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
    customerTrack?: CustomerTrack;
    taxNumber?: string;
    companyRegNumber?: string;
    creditLimit?: string | number;
    creditTermsDays?: string | number;
    dateOfBirth?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);

    // Auto-derive B2B track when tax / commercial keys exist.
    const derivedTrack: CustomerTrack =
      input.customerTrack ??
      (input.taxNumber || input.companyRegNumber ? 'B2B' : 'B2C');

    const contact = await this.prisma.crmContact.create({
      data: {
        companyId: input.companyId,
        contactType: input.contactType,
        customerTrack: derivedTrack,
        name: input.name,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        source: input.source,
        ownerUserId: input.ownerUserId,
        notes: input.notes,
        taxNumber: input.taxNumber,
        companyRegNumber: input.companyRegNumber,
        creditLimit:
          input.creditLimit !== undefined
            ? String(input.creditLimit)
            : undefined,
        creditTermsDays:
          input.creditTermsDays !== undefined
            ? Number(input.creditTermsDays)
            : undefined,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
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
      customerTrack?: CustomerTrack;
      taxNumber?: string | null;
      companyRegNumber?: string | null;
      creditLimit?: string | number | null;
      creditTermsDays?: string | number | null;
      dateOfBirth?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    await this.requireContact(companyId, contactId);

    const derivedTrack: CustomerTrack | undefined =
      data.customerTrack ??
      (data.taxNumber || data.companyRegNumber ? 'B2B' : undefined);

    const { dateOfBirth, creditLimit, creditTermsDays, ...rest } = data;
    return this.prisma.crmContact.update({
      where: { id: contactId },
      data: {
        ...rest,
        customerTrack: derivedTrack,
        taxNumber: data.taxNumber ?? undefined,
        companyRegNumber: data.companyRegNumber ?? undefined,
        creditLimit:
          creditLimit === null || creditLimit === undefined
            ? undefined
            : String(creditLimit),
        creditTermsDays:
          creditTermsDays === null || creditTermsDays === undefined
            ? undefined
            : Number(creditTermsDays),
        dateOfBirth:
          dateOfBirth === undefined
            ? undefined
            : dateOfBirth
              ? new Date(dateOfBirth)
              : null,
      },
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

    return this.prisma.crmOpportunity
      .update({
        where: { id: opportunityId },
        data: {
          status,
          ...(stageId ? { stageId } : {}),
        },
        include: { stage: true },
      })
      .then((updated) => {
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
              /qualified|interest|مهتم|تأهيل/i.test(
                updated.stage?.name ?? '',
              ) || Number(updated.stage?.probability ?? 0) >= 30,
          },
        );
        return updated;
      });
  }

  // --- Activities ---

  listActivities(companyId: string, status?: ActivityStatus) {
    this.tenant.setCompanyId(companyId);
    const allowed = new Set(Object.values(ActivityStatus));
    const statusFilter = status && allowed.has(status) ? status : undefined;
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
    contractType?: string;
    autoRenew?: boolean;
    renewalAlertDays?: number;
    priceListId?: string;
    discountPct?: number;
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
          contractType: input.contractType,
          autoRenew: input.autoRenew ?? false,
          renewalAlertDays: input.renewalAlertDays ?? 30,
          priceListId: input.priceListId,
          discountPct: input.discountPct ?? 0,
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

  async renewContract(companyId: string, contractId: string) {
    this.tenant.setCompanyId(companyId);
    const old = await this.prisma.crmContract.findFirst({
      where: { id: contractId, companyId },
    });
    if (!old) throw new NotFoundException('Contract not found');

    return this.prisma.$transaction(async (tx) => {
      const contractNumber = await this.docNumbers.nextSequence(tx, companyId, 'contract');
      const durationMs = old.endsOn && old.startsOn
        ? old.endsOn.getTime() - old.startsOn.getTime()
        : 365 * 24 * 60 * 60 * 1000;
      const newStart = old.endsOn ?? new Date();
      const newEnd = new Date(newStart.getTime() + durationMs);
      const newContract = await tx.crmContract.create({
        data: {
          companyId: old.companyId,
          contactId: old.contactId,
          opportunityId: old.opportunityId,
          contractNumber,
          title: old.title,
          status: ContractStatus.DRAFT,
          startsOn: newStart,
          endsOn: newEnd,
          value: old.value,
          currency: old.currency ?? 'SAR',
          notes: old.notes,
          contractType: (old as any).contractType,
          autoRenew: (old as any).autoRenew,
          renewalAlertDays: (old as any).renewalAlertDays,
          priceListId: (old as any).priceListId,
          discountPct: (old as any).discountPct,
          renewedFromId: old.id,
        },
      });
      await tx.crmContract.update({
        where: { id: old.id },
        data: { status: ContractStatus.ARCHIVED },
      });
      return newContract;
    });
  }

  async listExpiringContracts(companyId: string, withinDays = 30) {
    this.tenant.setCompanyId(companyId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return this.prisma.crmContract.findMany({
      where: {
        companyId,
        status: ContractStatus.ACTIVE,
        endsOn: { lte: cutoff, gte: new Date() },
      },
      include: { contact: { select: { id: true, name: true } } },
      orderBy: { endsOn: 'asc' },
    });
  }

  async listBirthdayContacts(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const month = new Date().getMonth() + 1;
    const contacts = await this.prisma.crmContact.findMany({
      where: { companyId, status: 'ACTIVE', dateOfBirth: { not: null } },
      take: 500,
    });
    return contacts.filter((c) => {
      if (!c.dateOfBirth) return false;
      return c.dateOfBirth.getUTCMonth() + 1 === month;
    });
  }

  async contactInsights(companyId: string, contactId: string) {
    this.tenant.setCompanyId(companyId);
    const contact = await this.requireContact(companyId, contactId);
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        contactId,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      include: {
        items: { include: { item: { select: { id: true, name: true, sku: true } } } },
      },
      orderBy: { issuedOn: 'desc' },
      take: 50,
    });

    const purchased = new Map<
      string,
      { itemId: string; name: string; quantity: number; times: number }
    >();
    for (const inv of invoices) {
      for (const line of inv.items) {
        if (!line.itemId || !line.item) continue;
        const cur = purchased.get(line.itemId) ?? {
          itemId: line.itemId,
          name: line.item.name,
          quantity: 0,
          times: 0,
        };
        cur.quantity += Number(line.quantity);
        cur.times += 1;
        purchased.set(line.itemId, cur);
      }
    }

    const purchasedIds = [...purchased.keys()];
    const companionCounts = new Map<string, { itemId: string; name: string; score: number }>();
    if (purchasedIds.length) {
      const related = await this.prisma.salesInvoiceItem.findMany({
        where: {
          itemId: { in: purchasedIds },
          invoice: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        },
        select: { salesInvoiceId: true },
        take: 400,
      });
      const invoiceIds = [...new Set(related.map((r) => r.salesInvoiceId))];
      if (invoiceIds.length) {
        const companions = await this.prisma.salesInvoiceItem.findMany({
          where: {
            salesInvoiceId: { in: invoiceIds },
            AND: [
              { itemId: { not: null } },
              { itemId: { notIn: purchasedIds } },
            ],
          },
          include: { item: { select: { id: true, name: true } } },
          take: 800,
        });
        for (const line of companions) {
          if (!line.itemId || !line.item) continue;
          const cur = companionCounts.get(line.itemId) ?? {
            itemId: line.itemId,
            name: line.item.name,
            score: 0,
          };
          cur.score += 1;
          companionCounts.set(line.itemId, cur);
        }
      }
    }

    const birthdayThisMonth = contact.dateOfBirth
      ? contact.dateOfBirth.getUTCMonth() === new Date().getUTCMonth()
      : false;

    return {
      contact: {
        id: contact.id,
        name: contact.name,
        customerTrack: contact.customerTrack,
        dateOfBirth: contact.dateOfBirth,
        birthdayThisMonth,
      },
      purchaseHistory: [...purchased.values()].sort((a, b) => b.times - a.times),
      suggestions: [...companionCounts.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
      recentInvoices: invoices.slice(0, 10).map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issuedOn: inv.issuedOn,
        totalAmount: inv.totalAmount,
        currency: inv.currency,
        saleChannel: inv.saleChannel,
      })),
    };
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
