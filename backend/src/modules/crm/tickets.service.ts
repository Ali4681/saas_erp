import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CrmOpsService } from './crm-ops.service';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly ops: CrmOpsService,
  ) {}

  private async nextTicketNumber(companyId: string): Promise<string> {
    const count = await this.prisma.supportTicket.count({ where: { companyId } });
    return `TKT-${String(count + 1).padStart(5, '0')}`;
  }

  async listTickets(companyId: string, status?: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.supportTicket.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      include: {
        contact: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicket(companyId: string, ticketId: string) {
    this.tenant.setCompanyId(companyId);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, companyId },
      include: {
        contact: true,
        assignedTo: { select: { id: true, fullName: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { createdBy: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async createTicket(input: {
    companyId: string;
    contactId: string;
    subject: string;
    priority?: string;
    description?: string;
    assignedToId?: string;
    invoiceId?: string;
    contractId?: string;
    slaDeadline?: string;
    createdByUserId?: string;
    ticketKind?: string;
    itemId?: string;
    warrantyExpiresOn?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const ticketNumber = await this.nextTicketNumber(input.companyId);
    const ticket = await this.prisma.supportTicket.create({
      data: {
        companyId: input.companyId,
        contactId: input.contactId,
        ticketNumber,
        subject: input.subject,
        priority: input.priority ?? 'NORMAL',
        description: input.description ?? null,
        assignedToId: input.assignedToId ?? null,
        invoiceId: input.invoiceId ?? null,
        contractId: input.contractId ?? null,
        slaDeadline: input.slaDeadline ? new Date(input.slaDeadline) : null,
        createdByUserId: input.createdByUserId ?? null,
        ticketKind: input.ticketKind ?? 'SUPPORT',
        itemId: input.itemId ?? null,
        warrantyExpiresOn: input.warrantyExpiresOn
          ? new Date(input.warrantyExpiresOn)
          : null,
      },
    });
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: input.contactId, companyId: input.companyId },
    });
    if (contact) {
      await this.ops.notifyContact(
        input.companyId,
        contact.phone,
        contact.email,
        contact.ownerUserId,
        `تم فتح تذكرة ${ticketNumber}: ${input.subject}`,
        'تذكرة دعم',
      );
    }
    return ticket;
  }

  async updateTicketStatus(
    companyId: string,
    ticketId: string,
    status: string,
    resolution?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, companyId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const validTransitions: Record<string, string[]> = {
      OPEN: ['IN_PROGRESS', 'CLOSED'],
      IN_PROGRESS: ['RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: [],
    };
    if (!validTransitions[ticket.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${ticket.status} to ${status}`);
    }
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        resolution: resolution ?? ticket.resolution,
        resolvedAt: status === 'RESOLVED' ? new Date() : ticket.resolvedAt,
        closedAt: status === 'CLOSED' ? new Date() : ticket.closedAt,
      },
    });
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: ticket.contactId, companyId },
    });
    if (contact) {
      await this.ops.notifyContact(
        companyId,
        contact.phone,
        contact.email,
        contact.ownerUserId,
        `تم تحديث حالة التذكرة ${ticket.ticketNumber} إلى ${status}`,
        'تحديث تذكرة',
      );
    }
    return updated;
  }

  async addComment(input: {
    companyId: string;
    ticketId: string;
    body: string;
    isInternal?: boolean;
    createdByUserId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: input.ticketId, companyId: input.companyId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return this.prisma.ticketComment.create({
      data: {
        ticketId: input.ticketId,
        body: input.body,
        isInternal: input.isInternal ?? false,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
  }
}
