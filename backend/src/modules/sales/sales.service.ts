import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  PaymentMethod,
  SalesDocumentStatus,
} from '../../generated/prisma/client';
import { DocumentNumberService } from '../../common/documents/document-number.service';
import { buildSimplePdf } from '../../common/documents/simple-pdf';
import {
  computeLines,
  type LineInput,
} from '../../common/documents/line-totals';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationEngine } from '../automation/automation.engine';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

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

  listQuotes(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.salesQuote.findMany({
      include: {
        contact: { select: { id: true, name: true } },
        items: { orderBy: { position: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createQuote(input: {
    companyId: string;
    createdById: string;
    contactId: string;
    issuedOn: string;
    expiresOn?: string;
    currency?: string;
    items: LineInput[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireContact(input.companyId, input.contactId);

    let computed;
    try {
      computed = computeLines(input.items);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid line items',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const quoteNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'quote',
      );
      return tx.salesQuote.create({
        data: {
          companyId: input.companyId,
          contactId: input.contactId,
          quoteNumber,
          issuedOn: new Date(input.issuedOn),
          expiresOn: input.expiresOn ? new Date(input.expiresOn) : undefined,
          currency: input.currency ?? 'SAR',
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxAmount: computed.taxAmount,
          totalAmount: computed.totalAmount,
          createdById: input.createdById,
          items: {
            create: computed.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              taxAmount: line.taxAmount,
              totalAmount: line.totalAmount,
              position: line.position,
              itemId: line.itemId,
            })),
          },
        },
        include: { items: true, contact: true },
      });
    });
  }

  async updateQuoteStatus(
    companyId: string,
    quoteId: string,
    status: SalesDocumentStatus,
    approvedById?: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const quote = await this.prisma.salesQuote.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const updated = await this.prisma.salesQuote.update({
      where: { id: quoteId },
      data: {
        status,
        ...(status === 'APPROVED' && approvedById
          ? { approvedById }
          : {}),
      },
      include: { items: true },
    });

    if (['ACCEPTED', 'APPROVED'].includes(status)) {
      this.emit(companyId, 'sales.quote.accepted', 'sales_quote', updated.id, {
        quoteId: updated.id,
        contactId: updated.contactId,
        status: updated.status,
        previousStatus: quote.status,
      });
    }

    return updated;
  }

  async convertQuoteToInvoice(
    companyId: string,
    quoteId: string,
    issuedOn?: string,
    dueOn?: string,
    opts?: { createdById?: string; companyBranchId?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    const quote = await this.prisma.salesQuote.findFirst({
      where: { id: quoteId, companyId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    if (!['APPROVED', 'ACCEPTED', 'SENT'].includes(quote.status)) {
      throw new BadRequestException(
        'Quote must be APPROVED, SENT, or ACCEPTED before conversion',
      );
    }

    const createdById = opts?.createdById ?? quote.createdById;
    let companyBranchId = opts?.companyBranchId;
    if (!companyBranchId && createdById) {
      const membership = await this.prisma.companyUser.findFirst({
        where: { companyId, userId: createdById },
        select: { branchId: true },
      });
      companyBranchId = membership?.branchId ?? undefined;
    }

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.docNumbers.nextInvoiceNumber(
        tx,
        companyId,
      );
      const invoice = await tx.salesInvoice.create({
        data: {
          companyId,
          contactId: quote.contactId,
          salesQuoteId: quote.id,
          companyBranchId,
          createdById,
          invoiceNumber,
          status: 'ISSUED',
          issuedOn: issuedOn ? new Date(issuedOn) : new Date(),
          dueOn: dueOn ? new Date(dueOn) : undefined,
          currency: quote.currency,
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          taxAmount: quote.taxAmount,
          totalAmount: quote.totalAmount,
          balanceDue: quote.totalAmount,
          items: {
            create: quote.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              totalAmount: item.totalAmount,
              position: item.position,
              itemId: item.itemId,
            })),
          },
        },
        include: { items: true, contact: true },
      });

      await tx.salesQuote.update({
        where: { id: quoteId },
        data: { status: 'CLOSED' },
      });

      return invoice;
    });
  }

  listInvoices(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.salesInvoice.findMany({
      include: {
        contact: { select: { id: true, name: true } },
        items: { orderBy: { position: 'asc' } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createInvoice(input: {
    companyId: string;
    contactId: string;
    issuedOn: string;
    dueOn?: string;
    currency?: string;
    items: LineInput[];
    status?: 'DRAFT' | 'ISSUED';
    createdById?: string;
    companyBranchId?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireContact(input.companyId, input.contactId);

    let computed;
    try {
      computed = computeLines(input.items);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid line items',
      );
    }

    let companyBranchId = input.companyBranchId;
    if (!companyBranchId && input.createdById) {
      const membership = await this.prisma.companyUser.findFirst({
        where: { companyId: input.companyId, userId: input.createdById },
        select: { branchId: true },
      });
      companyBranchId = membership?.branchId ?? undefined;
    }

    const status = input.status ?? 'DRAFT';
    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.docNumbers.nextInvoiceNumber(
        tx,
        input.companyId,
      );
      return tx.salesInvoice.create({
        data: {
          companyId: input.companyId,
          contactId: input.contactId,
          companyBranchId,
          createdById: input.createdById,
          invoiceNumber,
          status,
          issuedOn: new Date(input.issuedOn),
          dueOn: input.dueOn ? new Date(input.dueOn) : undefined,
          currency: input.currency ?? 'SAR',
          subtotal: computed.subtotal,
          discountAmount: computed.discountAmount,
          taxAmount: computed.taxAmount,
          totalAmount: computed.totalAmount,
          balanceDue: computed.totalAmount,
          items: {
            create: computed.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountAmount: line.discountAmount,
              taxAmount: line.taxAmount,
              totalAmount: line.totalAmount,
              position: line.position,
              itemId: line.itemId,
            })),
          },
        },
        include: { items: true, contact: true },
      });
    });
  }

  async recordPayment(input: {
    companyId: string;
    salesInvoiceId: string;
    amount: string | number;
    method: PaymentMethod;
    paidAt?: string;
    bankAccountId?: string;
    externalReference?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('Payment amount must be > 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findFirst({
        where: { id: input.salesInvoiceId, companyId: input.companyId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }
      if (['CANCELLED', 'DRAFT'].includes(invoice.status)) {
        throw new BadRequestException(
          'Cannot pay a draft or cancelled invoice',
        );
      }

      const balance = Number(invoice.balanceDue);
      if (amount > balance + 0.001) {
        throw new BadRequestException('Payment exceeds balance due');
      }

      if (input.bankAccountId) {
        const account = await tx.bankAccount.findFirst({
          where: { id: input.bankAccountId, companyId: input.companyId },
        });
        if (!account) {
          throw new BadRequestException('Bank account not found');
        }
      }

      const receiptNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'receipt',
      );
      const payment = await tx.salesPayment.create({
        data: {
          companyId: input.companyId,
          salesInvoiceId: invoice.id,
          bankAccountId: input.bankAccountId,
          receiptNumber,
          method: input.method,
          amount: amount.toFixed(2),
          currency: invoice.currency,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          externalReference: input.externalReference,
        },
      });

      const newBalance = Number((balance - amount).toFixed(2));
      const status =
        newBalance <= 0
          ? 'PAID'
          : newBalance < Number(invoice.totalAmount)
            ? 'PARTIALLY_PAID'
            : invoice.status;

      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          balanceDue: newBalance.toFixed(2),
          status,
        },
      });

      await tx.financialTransaction.create({
        data: {
          companyId: input.companyId,
          transactionType: 'RECEIPT',
          direction: 'INFLOW',
          amount: amount.toFixed(2),
          currency: invoice.currency,
          occurredAt: payment.paidAt,
          salesInvoiceId: invoice.id,
          description: `Receipt ${receiptNumber} for invoice ${invoice.invoiceNumber}`,
        },
      });

      return payment;
    }).then(async (payment) => {
      const invoice = await this.prisma.salesInvoice.findFirst({
        where: { id: input.salesInvoiceId, companyId: input.companyId },
      });
      if (invoice?.status === 'PAID') {
        this.emit(
          input.companyId,
          'sales.invoice.paid',
          'sales_invoice',
          invoice.id,
          {
            invoiceId: invoice.id,
            contactId: invoice.contactId,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: String(invoice.totalAmount),
          },
        );
      }
      return payment;
    });
  }

  listCreditNotes(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.salesCreditNote.findMany({
      include: {
        items: true,
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { issuedOn: 'desc' },
      take: 100,
    });
  }

  async createCreditNote(input: {
    companyId: string;
    salesInvoiceId: string;
    reason?: string;
    issuedOn?: string;
    items?: Array<{
      salesInvoiceItemId?: string;
      description: string;
      quantity: string | number;
      amount: string | number;
    }>;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: input.salesInvoiceId, companyId: input.companyId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (['DRAFT', 'CANCELLED'].includes(invoice.status)) {
      throw new BadRequestException(
        'Cannot credit a draft or cancelled invoice',
      );
    }

    const lines =
      input.items?.length
        ? input.items
        : invoice.items.map((item) => ({
            salesInvoiceItemId: item.id,
            description: item.description,
            quantity: item.quantity.toString(),
            amount: item.totalAmount.toString(),
          }));

    const total = lines.reduce((sum, line) => sum + Number(line.amount), 0);
    if (!(total > 0)) {
      throw new BadRequestException('Credit note total must be > 0');
    }

    return this.prisma.$transaction(async (tx) => {
      const creditNoteNumber = await this.docNumbers.nextSequence(
        tx,
        input.companyId,
        'creditNote',
      );
      const note = await tx.salesCreditNote.create({
        data: {
          companyId: input.companyId,
          salesInvoiceId: invoice.id,
          creditNoteNumber,
          status: 'APPROVED',
          issuedOn: input.issuedOn ? new Date(input.issuedOn) : new Date(),
          reason: input.reason,
          totalAmount: total.toFixed(2),
          currency: invoice.currency,
          items: {
            create: lines.map((line) => ({
              salesInvoiceItemId: line.salesInvoiceItemId,
              description: line.description,
              quantity: Number(line.quantity).toFixed(3),
              amount: Number(line.amount).toFixed(2),
            })),
          },
        },
        include: { items: true },
      });

      const newBalance = Number(
        (Number(invoice.balanceDue) - total).toFixed(2),
      );
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          balanceDue: Math.max(0, newBalance).toFixed(2),
          status:
            newBalance <= 0
              ? 'PAID'
              : newBalance < Number(invoice.totalAmount)
                ? 'PARTIALLY_PAID'
                : invoice.status,
        },
      });

      return note;
    });
  }

  async invoicePdf(companyId: string, invoiceId: string) {
    this.tenant.setCompanyId(companyId);
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        contact: true,
        items: { orderBy: { position: 'asc' } },
        company: { include: { settings: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const lines = [
      `Company: ${invoice.company.displayName}`,
      `Invoice: ${invoice.invoiceNumber}`,
      `Status: ${invoice.status}`,
      `Customer: ${invoice.contact.name}`,
      `Issued: ${invoice.issuedOn.toISOString().slice(0, 10)}`,
      `Currency: ${invoice.currency}`,
      `Subtotal: ${invoice.subtotal.toString()}`,
      `Tax: ${invoice.taxAmount.toString()}`,
      `Total: ${invoice.totalAmount.toString()}`,
      `Balance due: ${invoice.balanceDue.toString()}`,
      '--- Lines ---',
      ...invoice.items.map(
        (item) =>
          `${item.position}. ${item.description} x${item.quantity.toString()} = ${item.totalAmount.toString()}`,
      ),
    ];
    const pdf = buildSimplePdf(`Invoice ${invoice.invoiceNumber}`, lines);
    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: pdf.toString('base64'),
      byteLength: pdf.length,
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
