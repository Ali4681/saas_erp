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
import { GlService } from '../finance/gl.service';
import { LoyaltyService } from '../crm/loyalty.service';
import { PricingService } from '../crm/pricing.service';
import { CrmOpsService } from '../crm/crm-ops.service';
import { ZatcaService } from './zatca.service';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly docNumbers: DocumentNumberService,
    @Inject(forwardRef(() => AutomationEngine))
    private readonly automation: AutomationEngine,
    private readonly gl: GlService,
    private readonly loyalty: LoyaltyService,
    private readonly pricing: PricingService,
    private readonly ops: CrmOpsService,
    private readonly zatca: ZatcaService,
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

  private async postIssuedInvoiceGl(
    companyId: string,
    userId: string | undefined,
    invoice: {
      id: string;
      invoiceNumber: string;
      totalAmount: unknown;
      taxAmount: unknown;
      currency: string;
      issuedOn: Date;
    },
    paymentKind: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT' | 'BNPL' = 'CASH',
  ) {
    try {
      await this.gl.ensureChartOfAccounts(companyId);
      await this.gl.postSalesInvoice(
        companyId,
        userId ?? 'system',
        {
          id: invoice.id,
          totalAmount: invoice.totalAmount as string | number,
          taxAmount: invoice.taxAmount as string | number,
          discountAmount: (invoice as { discountAmount?: unknown }).discountAmount as
            | string
            | number
            | undefined,
          currency: invoice.currency,
          issuedOn: invoice.issuedOn,
        },
        paymentKind,
      );
    } catch (error) {
      this.logger.warn(
        `GL sales invoice post failed for ${invoice.invoiceNumber}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
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
        ...(status === 'APPROVED' && approvedById ? { approvedById } : {}),
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
      include: { items: { orderBy: { position: 'asc' } }, contact: true },
    });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }
    if (!['APPROVED', 'ACCEPTED', 'SENT'].includes(quote.status)) {
      throw new BadRequestException(
        'Quote must be APPROVED, SENT, or ACCEPTED before conversion',
      );
    }

    const issuedDate = issuedOn ? new Date(issuedOn) : new Date();
    const isCreditSale =
      !!dueOn && quote.contact.customerTrack === 'B2B' && quote.totalAmount !== null;
    const paymentKind: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT' = isCreditSale
      ? 'CREDIT'
      : 'CASH';

    if (isCreditSale) {
      const creditLimit = Number(quote.contact.creditLimit ?? 0);
      if (creditLimit <= 0) {
        throw new BadRequestException('Credit is not allowed for this customer');
      }

      const dueDate = dueOn ? new Date(dueOn) : null;
      const days =
        dueDate && issuedDate
          ? Math.ceil((dueDate.getTime() - issuedDate.getTime()) / 86400000)
          : 0;
      if (
        quote.contact.creditTermsDays > 0 &&
        days > Number(quote.contact.creditTermsDays)
      ) {
        throw new BadRequestException('Invoice credit terms exceed customer allowed terms');
      }

      const outstandingAgg = await this.prisma.salesInvoice.aggregate({
        where: {
          companyId,
          contactId: quote.contactId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          balanceDue: { gt: 0 },
        },
        _sum: { balanceDue: true },
      });

      const outstanding = Number(outstandingAgg._sum.balanceDue ?? 0);
      const total = Number(quote.totalAmount);
      if (outstanding + total > creditLimit + 0.01) {
        throw new BadRequestException('Credit limit exceeded');
      }
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

    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.docNumbers.nextInvoiceNumber(
        tx,
        companyId,
      );
      const created = await tx.salesInvoice.create({
        data: {
          companyId,
          contactId: quote.contactId,
          salesQuoteId: quote.id,
          companyBranchId,
          createdById,
          invoiceNumber,
          status: 'ISSUED',
          issuedOn: issuedDate,
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

      return created;
    });

    await this.postIssuedInvoiceGl(
      companyId,
      createdById ?? undefined,
      invoice,
      paymentKind,
    );
    await this.fulfillIssuedInvoice(
      companyId,
      invoice.id,
      quote.contactId,
      Number(invoice.totalAmount),
      quote.contact.customerTrack,
      quote.contact.dateOfBirth,
      issuedDate.toISOString(),
      createdById,
      0,
    );
    return invoice;
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
    items: Array<LineInput & { bundleId?: string }>;
    status?: 'DRAFT' | 'ISSUED';
    createdById?: string;
    companyBranchId?: string;
    saleChannel?: string;
    couponCode?: string;
    priceListId?: string;
    storeCreditAmount?: string | number;
    extraDiscountPct?: number;
    overrideCode?: string;
    discountOverrideAuthorized?: boolean;
    paymentKind?: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT' | 'BNPL';
  }) {
    this.tenant.setCompanyId(input.companyId);
    const contact = await this.requireContact(
      input.companyId,
      input.contactId,
    );

    const saleChannel = input.saleChannel ?? 'POS';
    const expandedItems = await this.expandBundleLines(
      input.companyId,
      input.items,
    );
    const priceListId = await this.resolvePriceListId(
      input.companyId,
      input.contactId,
      input.priceListId,
    );
    const pricedItems = await this.applyPriceListToLines(
      input.companyId,
      priceListId,
      expandedItems,
    );

    let computed;
    try {
      computed = computeLines(pricedItems);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid line items',
      );
    }

    if (input.couponCode) {
      const couponResult = await this.pricing.validateCoupon(
        input.companyId,
        input.couponCode,
        Number(computed.totalAmount),
        input.contactId,
        saleChannel,
      );
      const extraDiscount = Number(couponResult.discountAmount);
      computed = {
        ...computed,
        discountAmount: (Number(computed.discountAmount) + extraDiscount).toFixed(2),
        totalAmount: Math.max(0, Number(computed.totalAmount) - extraDiscount).toFixed(2),
      };
    }

    if (input.extraDiscountPct && input.extraDiscountPct > 0) {
      const settings = await this.ops.getSettings(input.companyId);
      if (input.extraDiscountPct > settings.pos.maxDiscountPct) {
        const codeOk = input.overrideCode === settings.pos.overrideCode;
        if (!codeOk && !input.discountOverrideAuthorized) {
          throw new BadRequestException(
            'Discount exceeds cashier cap — override code required',
          );
        }
      }
      const extra = (Number(computed.totalAmount) * input.extraDiscountPct) / 100;
      computed = {
        ...computed,
        discountAmount: (Number(computed.discountAmount) + extra).toFixed(2),
        totalAmount: Math.max(0, Number(computed.totalAmount) - extra).toFixed(2),
      };
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

    const isCreditSale =
      status === 'ISSUED' && !!input.dueOn && contact.customerTrack === 'B2B';
    const paymentKind: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT' | 'BNPL' = isCreditSale
      ? 'CREDIT'
      : input.paymentKind
        ? input.paymentKind
        : saleChannel === 'BNPL'
          ? 'BNPL'
          : 'CASH';

    if (isCreditSale) {
      const creditLimit = Number(contact.creditLimit ?? 0);
      if (creditLimit <= 0) {
        throw new BadRequestException('Credit is not allowed for this customer');
      }
      const issuedDate = new Date(input.issuedOn);
      const dueDate = input.dueOn ? new Date(input.dueOn) : null;
      const days =
        dueDate && issuedDate
          ? Math.ceil((dueDate.getTime() - issuedDate.getTime()) / 86400000)
          : 0;
      if (contact.creditTermsDays > 0 && days > Number(contact.creditTermsDays)) {
        throw new BadRequestException('Invoice credit terms exceed customer allowed terms');
      }

      const outstandingAgg = await this.prisma.salesInvoice.aggregate({
        where: {
          companyId: input.companyId,
          contactId: input.contactId,
          status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
          balanceDue: { gt: 0 },
        },
        _sum: { balanceDue: true },
      });
      const outstanding = Number(outstandingAgg._sum.balanceDue ?? 0);
      const total = Number(computed.totalAmount);
      if (outstanding + total > creditLimit + 0.01) {
        throw new BadRequestException('Credit limit exceeded');
      }
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
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
          saleChannel,
          couponCode: input.couponCode?.trim() || null,
          priceListId,
          extraDiscountPct: input.extraDiscountPct ?? 0,
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

    if (status === 'ISSUED') {
      await this.postIssuedInvoiceGl(
        input.companyId,
        input.createdById,
        invoice,
        paymentKind,
      );
      if (input.couponCode) {
        await this.pricing
          .applyCoupon(
            input.companyId,
            input.couponCode,
            invoice.id,
            input.contactId,
            Number(computed.totalAmount),
            saleChannel,
          )
          .catch((error) =>
            this.logger.warn(
              `coupon apply failed: ${
                error instanceof Error ? error.message : 'unknown'
              }`,
            ),
          );
      }
      await this.fulfillIssuedInvoice(
        input.companyId,
        invoice.id,
        input.contactId,
        Number(computed.totalAmount),
        contact.customerTrack,
        contact.dateOfBirth,
        input.issuedOn,
        input.createdById,
        Number(input.storeCreditAmount ?? 0),
      );
      return this.prisma.salesInvoice.findFirstOrThrow({
        where: { id: invoice.id },
        include: { items: true, contact: true },
      });
    }

    return invoice;
  }

  async recordPayment(input: {
    companyId: string;
    salesInvoiceId: string;
    amount: string | number;
    method: PaymentMethod;
    paidAt?: string;
    bankAccountId?: string;
    externalReference?: string;
    createdById?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    const amount = Number(input.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('Payment amount must be > 0');
    }

    return this.prisma
      .$transaction(async (tx) => {
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
      })
      .then(async (payment) => {
        const invoice = await this.prisma.salesInvoice.findFirst({
          where: { id: input.salesInvoiceId, companyId: input.companyId },
          include: { contact: true },
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

        // B2B credit sales: clear AR when we receive a payment.
        if (
          invoice?.dueOn &&
          invoice.contact?.customerTrack === 'B2B' &&
          invoice.status !== 'CANCELLED'
        ) {
          try {
            await this.gl.ensureChartOfAccounts(input.companyId);
            const mapping = await this.gl.getMapping(input.companyId);

            const debitCode =
              payment.method === 'CASH'
                ? mapping.salesCashPosCode
                : mapping.salesCardBankCode;
            const amountNum = Number(payment.amount);

            await this.gl.postJournal({
              companyId: input.companyId,
              userId: input.createdById ?? 'system',
              entryType: 'SALES',
              entryDate: payment.paidAt,
              currency: invoice.currency,
              memo: `Sales receipt ${payment.receiptNumber}`,
              sourceType: 'SALES_PAYMENT',
              sourceId: payment.id,
              lines: [
                { code: debitCode, debit: amountNum, credit: 0, memo: 'Cash received' },
                { code: mapping.salesArLocalCode, debit: 0, credit: amountNum, memo: 'Clear AR' },
              ],
            });
          } catch (error) {
            this.logger.warn(
              `GL sales receipt post failed: ${
                error instanceof Error ? error.message : 'unknown'
              }`,
            );
          }
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
    toStoreCredit?: boolean;
    createdById?: string;
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
      include: { items: { orderBy: { position: 'asc' } }, contact: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (['DRAFT', 'CANCELLED'].includes(invoice.status)) {
      throw new BadRequestException(
        'Cannot credit a draft or cancelled invoice',
      );
    }

    const lines = input.items?.length
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

    const note = await this.prisma.$transaction(async (tx) => {
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

    if (input.toStoreCredit !== false) {
      try {
        await this.loyalty.creditStoreWallet({
          companyId: input.companyId,
          contactId: invoice.contactId,
          amount: total,
          sourceType: 'CREDIT_NOTE',
          sourceId: note.id,
          note: `Credit note ${note.creditNoteNumber}`,
          userId: input.createdById,
        });
      } catch (error) {
        this.logger.warn(
          `store credit from credit note failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    return note;
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
      `VAT: ${invoice.company.settings?.taxNumber ?? ''}`,
      `Invoice: ${invoice.invoiceNumber}`,
      `Status: ${invoice.status}`,
      `Customer: ${invoice.contact.name}`,
      `Tax #: ${invoice.contact.taxNumber ?? ''}`,
      `Issued: ${invoice.issuedOn.toISOString().slice(0, 10)} ${invoice.issuedOn.toISOString().slice(11, 19)}`,
      `Currency: ${invoice.currency}`,
      `Channel: ${invoice.saleChannel ?? 'POS'}`,
      `Subtotal: ${invoice.subtotal.toString()}`,
      `Tax (VAT): ${invoice.taxAmount.toString()}`,
      `Total: ${invoice.totalAmount.toString()}`,
      `Balance due: ${invoice.balanceDue.toString()}`,
      invoice.zatcaQr ? `ZATCA QR: ${invoice.zatcaQr.slice(0, 48)}…` : 'ZATCA QR: (generate via /zatca)',
      '--- Lines ---',
      ...invoice.items.map(
        (item) =>
          `${item.position}. ${item.description} x${item.quantity.toString()} @ ${item.unitPrice.toString()} = ${item.totalAmount.toString()}`,
      ),
      '--- Templates: THERMAL | A4 | SQUARE (select in print settings) ---',
    ];
    const pdf = buildSimplePdf(`Invoice ${invoice.invoiceNumber}`, lines);
    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      mimeType: 'application/pdf',
      contentBase64: pdf.toString('base64'),
      byteLength: pdf.length,
    };
  }

  async arAging(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceDue: { gt: 0 },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            customerTrack: true,
            creditLimit: true,
            creditTermsDays: true,
          },
        },
      },
      orderBy: { dueOn: 'asc' },
    });

    const outstandingByContact = new Map<string, number>();
    for (const inv of invoices) {
      outstandingByContact.set(
        inv.contactId,
        (outstandingByContact.get(inv.contactId) ?? 0) + Number(inv.balanceDue),
      );
    }

    const today = new Date();
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    const rows = invoices.map((inv) => {
      const due = inv.dueOn ?? inv.issuedOn;
      const days = Math.max(
        0,
        Math.floor((today.getTime() - due.getTime()) / 86400000),
      );
      const amount = Number(inv.balanceDue);
      if (days <= 0) buckets.current += amount;
      else if (days <= 30) buckets.d30 += amount;
      else if (days <= 60) buckets.d60 += amount;
      else if (days <= 90) buckets.d90 += amount;
      else buckets.older += amount;
      const outstanding = outstandingByContact.get(inv.contactId) ?? 0;
      const limit = Number(inv.contact.creditLimit ?? 0);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        contact: inv.contact,
        dueOn: inv.dueOn,
        issuedOn: inv.issuedOn,
        balanceDue: inv.balanceDue,
        currency: inv.currency,
        daysPastDue: days,
        blocked:
          inv.contact.customerTrack === 'B2B' &&
          limit > 0 &&
          outstanding >= limit - 0.01,
      };
    });

    return {
      buckets: {
        current: buckets.current.toFixed(2),
        d30: buckets.d30.toFixed(2),
        d60: buckets.d60.toFixed(2),
        d90: buckets.d90.toFixed(2),
        older: buckets.older.toFixed(2),
        total: Object.values(buckets)
          .reduce((s, n) => s + n, 0)
          .toFixed(2),
      },
      invoices: rows,
    };
  }

  async channelReport(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      select: {
        saleChannel: true,
        totalAmount: true,
        balanceDue: true,
        status: true,
      },
    });
    const map = new Map<
      string,
      { count: number; total: number; outstanding: number; paid: number }
    >();
    for (const inv of invoices) {
      const key = inv.saleChannel || 'POS';
      const cur = map.get(key) ?? { count: 0, total: 0, outstanding: 0, paid: 0 };
      const total = Number(inv.totalAmount);
      const due = Number(inv.balanceDue);
      cur.count += 1;
      cur.total += total;
      cur.outstanding += due;
      cur.paid += Math.max(0, total - due);
      map.set(key, cur);
    }
    return [...map.entries()].map(([channel, v]) => ({
      channel,
      count: v.count,
      total: v.total.toFixed(2),
      paid: v.paid.toFixed(2),
      outstanding: v.outstanding.toFixed(2),
    }));
  }

  private async resolvePriceListId(
    companyId: string,
    contactId: string,
    explicitId?: string,
  ) {
    if (explicitId) return explicitId;
    const contract = await this.prisma.crmContract.findFirst({
      where: {
        companyId,
        contactId,
        status: 'ACTIVE',
        priceListId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (contract?.priceListId) return contract.priceListId;
    const contact = await this.prisma.crmContact.findFirst({
      where: { id: contactId, companyId },
    });
    const listType = contact?.customerTrack === 'B2B' ? 'WHOLESALE' : 'RETAIL';
    const preferred = await this.prisma.priceList.findFirst({
      where: { companyId, isActive: true, isDefault: true },
    });
    if (preferred) return preferred.id;
    const typed = await this.prisma.priceList.findFirst({
      where: { companyId, isActive: true, listType },
    });
    return typed?.id ?? null;
  }

  private async applyPriceListToLines(
    companyId: string,
    priceListId: string | null,
    items: LineInput[],
  ): Promise<LineInput[]> {
    if (!priceListId) return items;
    const next: LineInput[] = [];
    for (const line of items) {
      if (!line.itemId) {
        next.push(line);
        continue;
      }
      const priced = await this.pricing.getItemPrice(
        companyId,
        priceListId,
        line.itemId,
        Number(line.quantity) || 1,
      );
      if (!priced) {
        next.push(line);
        continue;
      }
      next.push({ ...line, unitPrice: Number(priced.unitPrice) });
    }
    return next;
  }

  private async fulfillIssuedInvoice(
    companyId: string,
    invoiceId: string,
    contactId: string,
    totalAmount: number,
    customerTrack: string,
    dateOfBirth: Date | null,
    issuedOn: string,
    userId?: string,
    storeCreditAmount = 0,
  ) {
    const settings = await this.ops.getSettings(companyId);
    const rate =
      customerTrack === 'B2B'
        ? settings.loyalty.b2bRatePct
        : settings.loyalty.b2cRatePct;
    if (totalAmount > 0 && rate > 0) {
      let points = Math.floor((totalAmount * rate) / 100);
      const issued = new Date(issuedOn);
      if (
        dateOfBirth &&
        dateOfBirth.getUTCMonth() === issued.getUTCMonth() &&
        dateOfBirth.getUTCDate() === issued.getUTCDate()
      ) {
        points += settings.loyalty.birthdayBonus;
      }
      if (points > 0) {
        await this.loyalty
          .earnPoints({
            companyId,
            contactId,
            points,
            sourceType: 'SALES_INVOICE',
            sourceId: invoiceId,
            note: 'Invoice loyalty earn',
            userId,
          })
          .catch((error) =>
            this.logger.warn(
              `loyalty earn failed: ${
                error instanceof Error ? error.message : 'unknown'
              }`,
            ),
          );
      }
    }

    if (storeCreditAmount > 0) {
      try {
        await this.loyalty.debitStoreWallet({
          companyId,
          contactId,
          amount: storeCreditAmount,
          sourceType: 'SALES_INVOICE',
          sourceId: invoiceId,
          note: 'Applied on invoice',
          userId,
        });
        const invoice = await this.prisma.salesInvoice.findFirst({
          where: { id: invoiceId, companyId },
        });
        if (invoice) {
          const applied = Math.min(storeCreditAmount, Number(invoice.balanceDue));
          const newBalance = Number((Number(invoice.balanceDue) - applied).toFixed(2));
          await this.prisma.salesInvoice.update({
            where: { id: invoice.id },
            data: {
              storeCreditApplied: applied.toFixed(2),
              balanceDue: Math.max(0, newBalance).toFixed(2),
              status: newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            },
          });
        }
      } catch (error) {
        this.logger.warn(
          `store credit apply failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
  }

  async ingestChannelOrder(input: {
    companyId: string;
    createdById: string;
    provider: string;
    externalOrderId: string;
    saleChannel: string;
    contactPhone?: string;
    contactName?: string;
    commissionAmount?: number;
    items: LineInput[];
  }) {
    this.tenant.setCompanyId(input.companyId);
    const existing = await this.prisma.channelInboundOrder.findUnique({
      where: {
        companyId_provider_externalOrderId: {
          companyId: input.companyId,
          provider: input.provider,
          externalOrderId: input.externalOrderId,
        },
      },
    });
    if (existing?.salesInvoiceId) {
      return this.prisma.salesInvoice.findFirstOrThrow({
        where: { id: existing.salesInvoiceId },
      });
    }

    let contact = input.contactPhone
      ? await this.prisma.crmContact.findFirst({
          where: { companyId: input.companyId, phone: input.contactPhone },
        })
      : null;
    if (!contact) {
      contact = await this.prisma.crmContact.create({
        data: {
          companyId: input.companyId,
          contactType: 'CUSTOMER',
          customerTrack: 'B2C',
          name: input.contactName || `Channel ${input.provider}`,
          phone: input.contactPhone,
          source: input.provider,
        },
      });
    }

    const invoice = await this.createInvoice({
      companyId: input.companyId,
      contactId: contact.id,
      createdById: input.createdById,
      issuedOn: new Date().toISOString().slice(0, 10),
      status: 'ISSUED',
      saleChannel: input.saleChannel,
      paymentKind: input.saleChannel === 'BNPL' ? 'BNPL' : 'CASH',
      items: input.items,
    });

    await this.prisma.channelInboundOrder.create({
      data: {
        companyId: input.companyId,
        provider: input.provider,
        externalOrderId: input.externalOrderId,
        saleChannel: input.saleChannel,
        salesInvoiceId: invoice.id,
        commissionAmount: input.commissionAmount ?? 0,
      },
    });

    const commission = Number(input.commissionAmount ?? 0);
    if (commission > 0) {
      try {
        const mapping = await this.gl.getMapping(input.companyId);
        await this.gl.postJournal({
          companyId: input.companyId,
          userId: input.createdById,
          entryType: 'SALES',
          entryDate: new Date(),
          currency: invoice.currency,
          memo: `${input.provider} commission ${input.externalOrderId}`,
          sourceType: 'CHANNEL_COMMISSION',
          sourceId: invoice.id,
          lines: [
            {
              code: mapping.channelCommissionCode,
              debit: commission,
              credit: 0,
              memo: 'Platform commission',
            },
            {
              code: mapping.salesCashPosCode,
              debit: 0,
              credit: commission,
              memo: 'Commission withheld',
            },
          ],
        });
      } catch (error) {
        this.logger.warn(
          `channel commission GL failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }
    return invoice;
  }

  async listCustomerPurchaseOrders(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.customerPurchaseOrder.findMany({
      include: { contact: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createCustomerPurchaseOrder(input: {
    companyId: string;
    contactId: string;
    poNumber: string;
    issuedOn?: string;
    items: LineInput[];
    notes?: string;
  }) {
    this.tenant.setCompanyId(input.companyId);
    await this.requireContact(input.companyId, input.contactId);
    return this.prisma.customerPurchaseOrder.create({
      data: {
        companyId: input.companyId,
        contactId: input.contactId,
        poNumber: input.poNumber,
        issuedOn: input.issuedOn ? new Date(input.issuedOn) : new Date(),
        notes: input.notes,
        items: {
          create: input.items.map((line, i) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice ?? 0),
            itemId: line.itemId,
            position: i + 1,
          })),
        },
      },
      include: { items: true },
    });
  }

  async convertCustomerPurchaseOrder(
    companyId: string,
    poId: string,
    createdById: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const po = await this.prisma.customerPurchaseOrder.findFirst({
      where: { id: poId, companyId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Customer PO not found');
    if (po.salesInvoiceId) {
      throw new BadRequestException('PO already converted');
    }
    const contact = await this.requireContact(companyId, po.contactId);
    const due = new Date();
    due.setDate(due.getDate() + (contact.creditTermsDays || 0));
    const invoice = await this.createInvoice({
      companyId,
      contactId: po.contactId,
      createdById,
      issuedOn: new Date().toISOString().slice(0, 10),
      status: 'ISSUED',
      dueOn: due.toISOString().slice(0, 10),
      items: po.items.map((line) => ({
        description: line.description,
        quantity: line.quantity.toString(),
        unitPrice: line.unitPrice.toString(),
        itemId: line.itemId ?? undefined,
      })),
    });
    await this.prisma.customerPurchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CLOSED', salesInvoiceId: invoice.id },
    });
    return invoice;
  }

  async zatcaDocument(companyId: string, invoiceId: string) {
    this.tenant.setCompanyId(companyId);
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { contact: true, company: { include: { settings: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const settings = await this.ops.getSettings(companyId);
    const sellerName =
      settings.zatca.sellerName || invoice.company.displayName;
    const vatNumber =
      settings.zatca.vatNumber || invoice.company.settings?.taxNumber || '';
    const qr = this.zatca.buildTlvQr({
      sellerName,
      vatNumber,
      timestamp: invoice.issuedOn,
      total: Number(invoice.totalAmount),
      vat: Number(invoice.taxAmount),
    });
    const xml = this.zatca.buildSimplifiedXml({
      invoiceNumber: invoice.invoiceNumber,
      sellerName,
      vatNumber,
      issuedOn: invoice.issuedOn,
      total: Number(invoice.totalAmount),
      vat: Number(invoice.taxAmount),
      buyerName: invoice.contact.name,
    });
    await this.prisma.salesInvoice.update({
      where: { id: invoice.id },
      data: { zatcaQr: qr },
    });
    return { qr, ...xml };
  }

  async trackRevenueReport(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const invoices = await this.prisma.salesInvoice.findMany({
      where: { companyId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      include: { contact: { select: { customerTrack: true } } },
    });
    const acc = { B2C: { total: 0, count: 0 }, B2B: { total: 0, count: 0 } };
    for (const inv of invoices) {
      const key = inv.contact.customerTrack === 'B2B' ? 'B2B' : 'B2C';
      acc[key].total += Number(inv.totalAmount);
      acc[key].count += 1;
    }
    return {
      b2c: { ...acc.B2C, total: acc.B2C.total.toFixed(2) },
      b2b: { ...acc.B2B, total: acc.B2B.total.toFixed(2) },
    };
  }

  async ticketCostReport(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const tickets = await this.prisma.supportTicket.findMany({
      where: { companyId },
      include: { _count: { select: { comments: true } } },
    });
    const invoiceIds = tickets
      .map((t) => t.invoiceId)
      .filter((id): id is string => !!id);
    const invoices = invoiceIds.length
      ? await this.prisma.salesInvoice.findMany({
          where: { companyId, id: { in: invoiceIds } },
        })
      : [];
    const invoiceMap = new Map(invoices.map((i) => [i.id, Number(i.totalAmount)]));
    const laborRate = 50;
    const rows = tickets.map((t) => {
      const labor = t._count.comments * laborRate;
      const parts = t.invoiceId ? invoiceMap.get(t.invoiceId) ?? 0 : 0;
      return {
        ticketNumber: t.ticketNumber,
        ticketKind: t.ticketKind,
        status: t.status,
        commentCount: t._count.comments,
        laborCost: labor,
        partsCost: parts,
        totalCost: labor + parts,
      };
    });
    return {
      totalCost: rows.reduce((s, r) => s + r.totalCost, 0).toFixed(2),
      tickets: rows,
    };
  }

  async deferredContractRevenue(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const contracts = await this.prisma.crmContract.findMany({
      where: { companyId, status: 'ACTIVE' },
    });
    const today = new Date();
    const rows = contracts.map((c) => {
      const start = c.startsOn ?? today;
      const end = c.endsOn ?? start;
      const totalDays = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / 86400000),
      );
      const remaining = Math.max(
        0,
        Math.ceil((end.getTime() - today.getTime()) / 86400000),
      );
      const value = Number(c.value ?? 0);
      const deferred = (value * remaining) / totalDays;
      return {
        id: c.id,
        title: c.title,
        value,
        remainingDays: remaining,
        deferredRevenue: deferred.toFixed(2),
      };
    });
    return {
      totalDeferred: rows
        .reduce((s, r) => s + Number(r.deferredRevenue), 0)
        .toFixed(2),
      contracts: rows,
    };
  }

  private async expandBundleLines(
    companyId: string,
    items: Array<LineInput & { bundleId?: string }>,
  ): Promise<LineInput[]> {
    const out: LineInput[] = [];
    for (const line of items) {
      if (!line.bundleId) {
        out.push(line);
        continue;
      }
      const bundle = await this.prisma.productBundle.findFirst({
        where: { id: line.bundleId, companyId, isActive: true },
        include: { items: { include: { item: true } } },
      });
      if (!bundle || bundle.items.length === 0) {
        throw new BadRequestException('Bundle not found');
      }
      const packQty = Number(line.quantity ?? 1);
      const weights = bundle.items.map((row) => {
        const unit = Number(row.item.salePrice ?? row.item.cost ?? 0);
        return Math.max(0.01, unit * Number(row.quantity));
      });
      const weightSum = weights.reduce((s, w) => s + w, 0);
      bundle.items.forEach((row, i) => {
        const share = weights[i] / weightSum;
        const componentQty = Number(row.quantity) * packQty;
        out.push({
          description: `${bundle.name} / ${row.item.name}`,
          quantity: componentQty,
          unitPrice:
            (Number(bundle.bundlePrice) * packQty * share) / componentQty,
          itemId: row.itemId,
        });
      });
    }
    return out;
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
