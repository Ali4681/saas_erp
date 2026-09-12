import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { CashierShiftsService } from '../finance/cashier-shifts.service';
import {
  DEFAULT_POS_CASHIER_PERMISSIONS,
  SUPERVISOR_POS_PERMISSIONS,
  mergePosPermissions,
  type PosCashierPermissions,
} from './pos-permissions';
import {
  POS_PAYMENT_PROVIDER_BOOTSTRAP,
  posPaymentAdapter,
} from './pos-payment.adapter';
import {
  POS_INDUSTRY_TEMPLATES,
  findPosTemplate,
  type PosTemplateCategory,
} from './pos-templates';
import { SalesService } from './sales.service';

type TerminalLine = {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  note?: string;
  taxAmount?: number;
};

export type PosTerminalLayout = {
  accentColor: string | null;
  categoryOrder: string[];
  pinnedItemIds: string[];
};

const ALLOWED_CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'GBP'] as const;

@Injectable()
export class PosTerminalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly sales: SalesService,
    private readonly cashierShifts: CashierShiftsService,
  ) {}

  listTemplates() {
    return POS_INDUSTRY_TEMPLATES.map((t) => ({
      code: t.code,
      nameAr: t.nameAr,
      nameEn: t.nameEn,
      descriptionAr: t.descriptionAr,
      descriptionEn: t.descriptionEn,
      accentColor: t.accentColor,
      categoryCount: t.categories.length,
    }));
  }

  async bootstrap(companyId: string, userId: string, pointOfSaleId?: string) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(
      companyId,
      userId,
      pointOfSaleId,
    );
    const permissions = await this.resolvePermissions(
      companyId,
      assignment?.cashier ?? null,
      userId,
    );

    const [categories, items, walkIn, held, openShift, settingsBag] =
      await Promise.all([
        this.prisma.itemCategory.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            parentId: true,
            code: true,
          },
          orderBy: [{ name: 'asc' }],
        }),
        this.prisma.item.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            salePrice: true,
            itemCategoryId: true,
            imageAttachmentId: true,
            taxRate: true,
          },
          orderBy: { name: 'asc' },
          take: 800,
        }),
        this.ensureWalkInContact(companyId),
        this.listHeldInvoices(companyId, userId, assignment, permissions),
        this.prisma.cashierShiftSession.findFirst({
          where: {
            companyId,
            userId,
            status: 'OPEN',
          },
          orderBy: { openedAt: 'desc' },
        }),
        this.prisma.companySettings.findUnique({ where: { companyId } }),
      ]);

    const bag =
      settingsBag?.settings &&
      typeof settingsBag.settings === 'object' &&
      !Array.isArray(settingsBag.settings)
        ? (settingsBag.settings as Record<string, unknown>)
        : {};
    const posBag =
      bag.posTerminal &&
      typeof bag.posTerminal === 'object' &&
      !Array.isArray(bag.posTerminal)
        ? (bag.posTerminal as Record<string, unknown>)
        : {};

    const myAssignments = await this.prisma.posCashier.findMany({
      where: { companyId, userId, status: 'ACTIVE' },
      include: {
        pointOfSale: {
          select: {
            id: true,
            code: true,
            name: true,
            templateCode: true,
            layoutJson: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      assignment: assignment
        ? {
            pointOfSale: assignment.pos,
            cashier:
              assignment.cashier.id
                ? {
                    id: assignment.cashier.id,
                    displayName: assignment.cashier.displayName,
                    employeeId: assignment.cashier.employeeId,
                  }
                : null,
          }
        : null,
      myAssignments: myAssignments.map((a) => ({
        cashierId: a.id,
        pointOfSale: a.pointOfSale,
      })),
      permissions,
      categories,
      products: items.map((it) => {
        const price = it.salePrice != null ? Number(it.salePrice) : 0;
        return {
          id: it.id,
          name: it.name,
          sku: it.sku,
          barcode: it.barcode,
          categoryId: it.itemCategoryId,
          price,
          imageAttachmentId: it.imageAttachmentId,
          taxRate: it.taxRate != null ? Number(it.taxRate) : 15,
        };
      }),
      walkInContact: walkIn,
      heldInvoices: held,
      openShift,
      layout: this.normalizeLayout(
        assignment?.pos.layoutJson ?? posBag.layout ?? null,
        typeof posBag.accentColor === 'string' ? posBag.accentColor : null,
      ),
      templateCode:
        assignment?.pos.templateCode ??
        (typeof posBag.templateCode === 'string' ? posBag.templateCode : null),
      templates: this.listTemplates(),
      exchangeRates: this.normalizeExchangeRates(posBag.exchangeRates),
      allowedCurrencies: [...ALLOWED_CURRENCIES],
      hasSupervisorPin: this.hasSupervisorPinValue(posBag.supervisorPin),
      paymentProvider: POS_PAYMENT_PROVIDER_BOOTSTRAP,
      paymentAdapter: posPaymentAdapter.provider,
      companyDefaults: {
        taxRate: 15,
        currency: 'SAR',
      },
    };
  }

  permissionTemplates() {
    return {
      cashier: { ...DEFAULT_POS_CASHIER_PERMISSIONS },
      supervisor: { ...SUPERVISOR_POS_PERMISSIONS },
    };
  }

  async setSupervisorPin(companyId: string, userId: string, pin: string) {
    this.tenant.setCompanyId(companyId);
    const trimmed = String(pin ?? '').trim();
    if (trimmed.length < 4) {
      throw new BadRequestException('PIN must be at least 4 characters');
    }
    await this.patchPosTerminalSettings(companyId, { supervisorPin: trimmed });
    await this.writeAudit({
      companyId,
      userId,
      action: 'SUPERVISOR_PIN_SET',
      payload: {},
    });
    return { ok: true, hasSupervisorPin: true };
  }

  async verifySupervisorPin(companyId: string, pin: string) {
    this.tenant.setCompanyId(companyId);
    const ok = await this.checkSupervisorPin(companyId, pin);
    if (!ok) throw new ForbiddenException('Invalid supervisor PIN');
    return { ok: true as const };
  }

  async getExchangeRates(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const posBag = await this.loadPosTerminalBag(companyId);
    return {
      exchangeRates: this.normalizeExchangeRates(posBag.exchangeRates),
      allowedCurrencies: [...ALLOWED_CURRENCIES],
      baseCurrency: 'SAR',
    };
  }

  async patchExchangeRates(
    companyId: string,
    userId: string,
    rates: Record<string, number>,
  ) {
    this.tenant.setCompanyId(companyId);
    const normalized = this.normalizeExchangeRates(rates, true);
    await this.patchPosTerminalSettings(companyId, {
      exchangeRates: normalized,
    });
    await this.writeAudit({
      companyId,
      userId,
      action: 'EXCHANGE_RATES_UPDATE',
      payload: { currencies: Object.keys(normalized) },
    });
    return {
      exchangeRates: normalized,
      allowedCurrencies: [...ALLOWED_CURRENCIES],
      baseCurrency: 'SAR',
    };
  }

  /**
   * Accept `978604`, `INV-978604`, `inv-0001`, etc. — expand to the forms
   * document numbering may have stored.
   */
  private invoiceLookupKeys(q: string): string[] {
    const raw = String(q ?? '').trim();
    if (!raw) return [];
    const keys = new Set<string>([raw, raw.toUpperCase()]);

    const match = raw.toUpperCase().match(/^(?:([A-Z]+)-)?(\d+)$/);
    if (match) {
      const prefix = match[1] ?? 'INV';
      const digits = match[2]!;
      const unpadded = digits.replace(/^0+/, '') || '0';
      const padded4 = unpadded.padStart(4, '0');
      for (const d of [digits, unpadded, padded4]) {
        keys.add(d);
        keys.add(`${prefix}-${d}`);
        keys.add(`INV-${d}`);
      }
    } else if (!raw.includes('-')) {
      keys.add(`INV-${raw}`);
      keys.add(`INV-${raw.toUpperCase()}`);
    }

    return [...keys];
  }

  async lookupInvoice(companyId: string, q: string) {
    this.tenant.setCompanyId(companyId);
    const query = String(q ?? '').trim();
    if (!query) throw new BadRequestException('q is required');

    const keys = this.invoiceLookupKeys(query);
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: {
        companyId,
        OR: [{ id: query }, { invoiceNumber: { in: keys } }],
      },
      include: {
        contact: { select: { id: true, name: true } },
        items: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            itemId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            taxAmount: true,
            totalAmount: true,
            position: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createReturn(
    companyId: string,
    userId: string,
    input: {
      invoiceId?: string;
      invoiceNumber?: string;
      reason?: string;
      overridePin?: string;
      items: Array<{
        salesInvoiceItemId: string;
        quantity: number;
        amount?: number;
      }>;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(companyId, userId);
    const permissions = await this.resolvePermissions(
      companyId,
      assignment?.cashier ?? null,
      userId,
    );

    if (!permissions.returns) {
      await this.requireSupervisorPin(
        companyId,
        input.overridePin,
        'Returns require supervisor PIN',
      );
    }

    if (!input.items?.length) {
      throw new BadRequestException('Return items are required');
    }

    if (!input.invoiceId && !input.invoiceNumber) {
      throw new BadRequestException('invoiceId or invoiceNumber is required');
    }

    const numberKeys = input.invoiceNumber
      ? this.invoiceLookupKeys(input.invoiceNumber)
      : [];
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: {
        companyId,
        OR: [
          ...(input.invoiceId ? [{ id: input.invoiceId }] : []),
          ...(numberKeys.length
            ? [{ invoiceNumber: { in: numberKeys } }]
            : []),
        ],
      },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const byId = new Map(invoice.items.map((it) => [it.id, it]));
    const creditLines = input.items.map((line) => {
      const src = byId.get(line.salesInvoiceItemId);
      if (!src) {
        throw new BadRequestException(
          `Invoice line not found: ${line.salesInvoiceItemId}`,
        );
      }
      const qty = Number(line.quantity);
      const maxQty = Number(src.quantity);
      if (!(qty > 0) || qty > maxQty) {
        throw new BadRequestException(
          `Invalid return quantity for line ${src.id}`,
        );
      }
      const proportional =
        maxQty > 0 ? (qty / maxQty) * Number(src.totalAmount) : 0;
      const amount =
        line.amount != null && Number.isFinite(Number(line.amount))
          ? Number(line.amount)
          : proportional;
      if (!(amount > 0)) {
        throw new BadRequestException('Return line amount must be > 0');
      }
      return {
        salesInvoiceItemId: src.id,
        description: src.description,
        quantity: qty,
        amount,
      };
    });

    const note = await this.sales.createCreditNote({
      companyId,
      salesInvoiceId: invoice.id,
      reason: input.reason,
      createdById: userId,
      items: creditLines,
    });

    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: assignment?.pos.id,
      posCashierId: assignment?.cashier.id,
      action: 'RETURN',
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        creditNoteId: note.id,
        creditNoteNumber: note.creditNoteNumber,
        lineCount: creditLines.length,
        reason: input.reason,
      },
    });

    return note;
  }

  async shiftSummary(companyId: string, userId: string, pointOfSaleId?: string) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(
      companyId,
      userId,
      pointOfSaleId,
    );
    const posId = assignment?.pos.id;
    const openShift = await this.prisma.cashierShiftSession.findFirst({
      where: {
        companyId,
        userId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!openShift) {
      return {
        openShift: null,
        sales: { cashSales: 0, cardSales: 0, transferSales: 0, invoiceCount: 0 },
      };
    }

    const sales = await this.computeShiftSales(
      companyId,
      openShift.openedAt,
      openShift.pointOfSaleId ?? posId,
    );
    return { openShift, sales };
  }

  async openShift(
    companyId: string,
    userId: string,
    input: { openingFloat?: number; pointOfSaleId?: string },
  ) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(
      companyId,
      userId,
      input.pointOfSaleId,
    );
    if (!assignment) {
      throw new ForbiddenException('No POS assignment for shift open');
    }
    const employeeId =
      assignment.cashier.employeeId && assignment.cashier.employeeId.length > 0
        ? assignment.cashier.employeeId
        : null;
    if (!employeeId) {
      throw new BadRequestException(
        'Cashier employeeId required to open a shift',
      );
    }

    const session = await this.cashierShifts.open({
      companyId,
      userId,
      employeeId,
      openingFloat: input.openingFloat ?? 0,
      branchId: assignment.pos.companyBranchId ?? undefined,
      pointOfSaleId: assignment.pos.id,
    });

    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: assignment.pos.id,
      posCashierId: assignment.cashier.id || null,
      action: 'SHIFT_OPEN',
      payload: {
        sessionId: session.id,
        openingFloat: input.openingFloat ?? 0,
      },
    });
    return session;
  }

  async closeShift(
    companyId: string,
    userId: string,
    input: {
      denominations: Array<{ value: number; count: number }>;
      pettyExpenses?: number;
      notes?: string;
      overridePin?: string;
      pointOfSaleId?: string;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(
      companyId,
      userId,
      input.pointOfSaleId,
    );
    const permissions = await this.resolvePermissions(
      companyId,
      assignment?.cashier ?? null,
      userId,
    );
    if (!permissions.shiftClose) {
      await this.requireSupervisorPin(
        companyId,
        input.overridePin,
        'Shift close requires supervisor PIN',
      );
    }

    const posId = assignment?.pos.id;
    const openShift = await this.prisma.cashierShiftSession.findFirst({
      where: {
        companyId,
        userId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!openShift) throw new BadRequestException('No open shift to close');

    const denoms = input.denominations ?? [];
    const countedCash = denoms.reduce(
      (sum, d) => sum + Number(d.value) * Number(d.count),
      0,
    );
    const sales = await this.computeShiftSales(
      companyId,
      openShift.openedAt,
      openShift.pointOfSaleId ?? posId,
    );

    const notesPayload = {
      text: input.notes ?? null,
      denominations: denoms,
      salesSnapshot: sales,
    };

    const result = await this.cashierShifts.close({
      companyId,
      sessionId: openShift.id,
      userId,
      countedCash,
      cashSales: sales.cashSales,
      cardSales: sales.cardSales,
      transferSales: sales.transferSales,
      pettyExpenses: input.pettyExpenses ?? 0,
      notes: JSON.stringify(notesPayload),
    });

    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: posId,
      posCashierId: assignment?.cashier.id,
      action: 'SHIFT_CLOSE',
      payload: {
        sessionId: openShift.id,
        countedCash,
        journalEntryId: result.journalEntryId,
        zReportNumber: result.zReportNumber,
      },
    });

    return result;
  }

  async checkout(
    companyId: string,
    userId: string,
    input: {
      pointOfSaleId?: string;
      contactId?: string;
      lines: TerminalLine[];
      paymentMethod: 'CASH' | 'CARD' | 'CREDIT' | 'MIXED' | 'GIFT' | 'WALLET';
      paymentSplits?: Array<{ method: string; amount: number | string }>;
      extraDiscountPct?: number;
      overrideCode?: string;
      notes?: string;
      status?: 'ISSUED' | 'ON_HOLD';
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(
      companyId,
      userId,
      input.pointOfSaleId,
    );
    if (!assignment) {
      throw new ForbiddenException(
        'You are not assigned as an active cashier on a POS terminal',
      );
    }
    const posCashierId =
      assignment.cashier.id && assignment.cashier.id.length > 0
        ? assignment.cashier.id
        : undefined;
    const permissions = await this.resolvePermissions(
      companyId,
      'permissionsJson' in assignment.cashier
        ? assignment.cashier
        : null,
      userId,
    );

    if (!input.lines?.length) {
      throw new BadRequestException('Cart is empty');
    }

    if (input.status === 'ON_HOLD' && !permissions.holdRetrieve) {
      throw new ForbiddenException('Hold invoice permission denied');
    }

    if (input.paymentMethod === 'CREDIT' && !permissions.creditSales) {
      throw new ForbiddenException('Credit sales permission denied');
    }
    if (
      (input.paymentMethod === 'GIFT' || input.paymentMethod === 'WALLET') &&
      !permissions.giftCards
    ) {
      throw new ForbiddenException('Gift card / wallet payment permission denied');
    }

    if (input.extraDiscountPct && input.extraDiscountPct > 0) {
      if (!permissions.discounts) {
        throw new ForbiddenException('Discount permission denied');
      }
      if (input.extraDiscountPct > permissions.discountMaxPct) {
        if (!input.overrideCode) {
          throw new ForbiddenException(
            `Discount exceeds cashier cap (${permissions.discountMaxPct}%)`,
          );
        }
      }
    }

    for (const line of input.lines) {
      if (line.unitPrice != null) {
        const item = await this.prisma.item.findFirst({
          where: { id: line.itemId, companyId },
          select: { salePrice: true },
        });
        const list =
          item?.salePrice != null ? Number(item.salePrice) : null;
        if (
          list != null &&
          list > 0 &&
          Math.abs(Number(line.unitPrice) - list) / list > 0.0001
        ) {
          if (!permissions.priceOverride) {
            throw new ForbiddenException('Price override permission denied');
          }
          const pct = (Math.abs(Number(line.unitPrice) - list) / list) * 100;
          if (pct > permissions.priceOverrideMaxPct) {
            throw new ForbiddenException(
              `Price override exceeds max ${permissions.priceOverrideMaxPct}%`,
            );
          }
        }
      }
    }

    const contactId =
      input.contactId || (await this.ensureWalkInContact(companyId)).id;

    const issuedOn = new Date().toISOString().slice(0, 10);
    const status = input.status ?? 'ISSUED';
    const tender =
      input.paymentMethod === 'GIFT' || input.paymentMethod === 'WALLET'
        ? 'MIXED'
        : input.paymentMethod;

    const invoice = await this.sales.createInvoice({
      companyId,
      contactId,
      issuedOn,
      currency: 'SAR',
      status,
      createdById: userId,
      saleChannel: 'POS',
      paymentMethod: tender,
      paymentKind:
        tender === 'CREDIT'
          ? 'CREDIT'
          : tender === 'MIXED'
            ? 'MIXED'
            : tender === 'CARD'
              ? 'CARD'
              : 'CASH',
      paymentSplits: input.paymentSplits,
      extraDiscountPct: input.extraDiscountPct,
      overrideCode: input.overrideCode,
      pointOfSaleId: assignment.pos.id,
      posCashierId,
      items: input.lines.map((line) => ({
        itemId: line.itemId,
        description: line.note
          ? `${line.description} (${line.note})`.slice(0, 240)
          : line.description.slice(0, 240),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxAmount: line.taxAmount,
      })),
    });

    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: assignment.pos.id,
      posCashierId,
      action: status === 'ON_HOLD' ? 'HOLD_INVOICE' : 'CHECKOUT',
      payload: {
        invoiceId: invoice.id,
        paymentMethod: input.paymentMethod,
        totalAmount: invoice.totalAmount,
        lineCount: input.lines.length,
      },
    });

    return invoice;
  }

  async voidHeld(
    companyId: string,
    userId: string,
    invoiceId: string,
  ) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(companyId, userId);
    const permissions = await this.resolvePermissions(
      companyId,
      assignment?.cashier ?? null,
      userId,
    );
    if (!permissions.voidBeforeSave && !permissions.holdRetrieve) {
      throw new ForbiddenException('Void / unpark permission denied');
    }

    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!['ON_HOLD', 'DRAFT'].includes(invoice.status)) {
      throw new BadRequestException('Only held/draft invoices can be voided here');
    }
    if (
      !permissions.holdSeeOthers &&
      invoice.createdById &&
      invoice.createdById !== userId
    ) {
      throw new ForbiddenException('Cannot void another cashier held invoice');
    }

    const cancelled = await this.sales.cancelInvoice(companyId, invoiceId);
    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: assignment?.pos.id,
      posCashierId: assignment?.cashier.id,
      action: 'VOID_HELD',
      payload: { invoiceId },
    });
    return cancelled;
  }

  async issueHeld(
    companyId: string,
    userId: string,
    invoiceId: string,
    input: {
      paymentMethod?: string;
      paymentSplits?: Array<{ method: string; amount: number | string }>;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(companyId, userId);
    const permissions = await this.resolvePermissions(
      companyId,
      assignment?.cashier ?? null,
      userId,
    );
    if (!permissions.holdRetrieve) {
      throw new ForbiddenException('Retrieve held invoice permission denied');
    }

    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (
      !permissions.holdSeeOthers &&
      invoice.createdById &&
      invoice.createdById !== userId
    ) {
      throw new ForbiddenException('Cannot retrieve another cashier held invoice');
    }

    const issued = await this.sales.issueHeldInvoice({
      companyId,
      invoiceId,
      paymentMethod: input.paymentMethod,
      paymentSplits: input.paymentSplits,
    });

    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: assignment?.pos.id,
      posCashierId: assignment?.cashier.id,
      action: 'RETRIEVE_HOLD',
      payload: { invoiceId, paymentMethod: input.paymentMethod },
    });
    return issued;
  }

  async openCashDrawer(companyId: string, userId: string, reason: string) {
    this.tenant.setCompanyId(companyId);
    const assignment = await this.resolveMyAssignment(companyId, userId);
    const permissions = await this.resolvePermissions(
      companyId,
      assignment?.cashier ?? null,
      userId,
    );
    if (!permissions.openCashDrawer) {
      throw new ForbiddenException('Manual cash drawer open denied');
    }
    if (!reason.trim()) {
      throw new BadRequestException('Reason is required');
    }
    return this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: assignment?.pos.id,
      posCashierId: assignment?.cashier.id,
      action: 'CASH_DRAWER_OPEN',
      payload: { reason: reason.trim() },
    });
  }

  async saveLayout(
    companyId: string,
    userId: string,
    input: {
      pointOfSaleId: string;
      layoutJson?: Record<string, unknown> | null;
      templateCode?: string | null;
    },
  ) {
    this.tenant.setCompanyId(companyId);
    const pos = await this.prisma.pointOfSale.findFirst({
      where: { id: input.pointOfSaleId, companyId },
    });
    if (!pos) throw new NotFoundException('Point of sale not found');

    const layoutJson =
      input.layoutJson !== undefined
        ? input.layoutJson === null
          ? null
          : (this.normalizeLayout(input.layoutJson) as unknown as Record<
              string,
              unknown
            >)
        : undefined;

    const updated = await this.prisma.pointOfSale.update({
      where: { id: pos.id },
      data: {
        ...(layoutJson !== undefined
          ? { layoutJson: layoutJson as Prisma.InputJsonValue }
          : {}),
        ...(input.templateCode !== undefined
          ? { templateCode: input.templateCode }
          : {}),
      },
    });
    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: pos.id,
      action: 'LAYOUT_SAVE',
      payload: { templateCode: input.templateCode },
    });
    return {
      ...updated,
      layoutJson: layoutJson ?? this.normalizeLayout(updated.layoutJson),
    };
  }

  async applyTemplate(
    companyId: string,
    userId: string,
    input: { templateCode: string; pointOfSaleId?: string; seedCategories?: boolean },
  ) {
    this.tenant.setCompanyId(companyId);
    const template = findPosTemplate(input.templateCode);
    if (!template) throw new BadRequestException('Unknown POS template');

    let createdCategories: Array<{ id: string; name: string; parentId: string | null }> =
      [];
    if (input.seedCategories !== false) {
      createdCategories = await this.seedTemplateCategories(
        companyId,
        template.categories,
      );
    }

    if (input.pointOfSaleId) {
      await this.prisma.pointOfSale.updateMany({
        where: { id: input.pointOfSaleId, companyId },
        data: {
          templateCode: template.code,
          layoutJson: {
            accentColor: template.accentColor,
            categoryOrder: createdCategories
              .filter((c) => !c.parentId)
              .map((c) => c.id),
            templateCode: template.code,
          } as Prisma.InputJsonValue,
        },
      });
    }

    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    const bag =
      settings?.settings &&
      typeof settings.settings === 'object' &&
      !Array.isArray(settings.settings)
        ? { ...(settings.settings as Record<string, unknown>) }
        : {};
    bag.posTerminal = {
      ...(typeof bag.posTerminal === 'object' &&
      bag.posTerminal &&
      !Array.isArray(bag.posTerminal)
        ? (bag.posTerminal as Record<string, unknown>)
        : {}),
      templateCode: template.code,
      accentColor: template.accentColor,
    };
    await this.prisma.companySettings.upsert({
      where: { companyId },
      create: { companyId, settings: bag as Prisma.InputJsonValue },
      update: { settings: bag as Prisma.InputJsonValue },
    });

    await this.writeAudit({
      companyId,
      userId,
      pointOfSaleId: input.pointOfSaleId,
      action: 'APPLY_TEMPLATE',
      payload: { templateCode: template.code, categories: createdCategories.length },
    });

    return {
      template,
      categories: createdCategories,
    };
  }

  async updateCashierPermissions(
    companyId: string,
    cashierId: string,
    permissions: Partial<PosCashierPermissions>,
  ) {
    this.tenant.setCompanyId(companyId);
    const cashier = await this.prisma.posCashier.findFirst({
      where: { id: cashierId, companyId },
    });
    if (!cashier) throw new NotFoundException('Cashier not found');
    const merged = mergePosPermissions(
      { ...mergePosPermissions(cashier.permissionsJson), ...permissions },
    );
    return this.prisma.posCashier.update({
      where: { id: cashierId },
      data: { permissionsJson: merged as unknown as Prisma.InputJsonValue },
    });
  }

  async listAudit(companyId: string, limit = 50) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.posAuditEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        pointOfSale: { select: { id: true, code: true, name: true } },
      },
    });
  }

  private async listHeldInvoices(
    companyId: string,
    userId: string,
    assignment: Awaited<ReturnType<PosTerminalService['resolveMyAssignment']>>,
    permissions: PosCashierPermissions,
  ) {
    return this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        status: 'ON_HOLD',
        ...(assignment?.pos.id ? { pointOfSaleId: assignment.pos.id } : {}),
        ...(permissions.holdSeeOthers ? {} : { createdById: userId }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        createdAt: true,
        createdById: true,
        contact: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalAmount: true,
            itemId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  private async ensureWalkInContact(companyId: string) {
    const existing = await this.prisma.crmContact.findFirst({
      where: {
        companyId,
        contactType: 'CUSTOMER',
        name: 'Walk-in / نقدي',
      },
      select: { id: true, name: true },
    });
    if (existing) return existing;

    return this.prisma.crmContact.create({
      data: {
        companyId,
        contactType: 'CUSTOMER',
        customerTrack: 'B2C',
        name: 'Walk-in / نقدي',
        source: 'POS-WALKIN',
        notes: 'Default POS walk-in customer',
      },
      select: { id: true, name: true },
    });
  }

  private async resolveMyAssignment(
    companyId: string,
    userId: string,
    pointOfSaleId?: string,
  ) {
    const cashier = await this.prisma.posCashier.findFirst({
      where: {
        companyId,
        userId,
        status: 'ACTIVE',
        ...(pointOfSaleId ? { pointOfSaleId } : {}),
        pointOfSale: { status: 'ACTIVE' },
      },
      include: {
        pointOfSale: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (cashier) {
      return { cashier, pos: cashier.pointOfSale };
    }

    // Supervisors / admins without a PosCashier row can still operate the
    // terminal on the selected (or first active) POS during setup.
    let pos = pointOfSaleId
      ? await this.prisma.pointOfSale.findFirst({
          where: { id: pointOfSaleId, companyId, status: 'ACTIVE' },
        })
      : await this.prisma.pointOfSale.findFirst({
          where: { companyId, status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        });

    if (!pos) {
      pos = await this.prisma.pointOfSale.create({
        data: {
          companyId,
          code: 'MAIN',
          name: 'Main POS',
          locationNote: 'Auto-created for cashier terminal',
        },
      });
    }

    const employee = await this.prisma.employee.findFirst({
      where: { companyId, userId, employmentStatus: 'ACTIVE' },
    });
    if (!employee) {
      return {
        cashier: {
          id: '',
          displayName: null,
          employeeId: '',
          permissionsJson: null,
        },
        pos,
        virtual: true as const,
      };
    }

    const ensured = await this.prisma.posCashier.upsert({
      where: {
        pointOfSaleId_userId: {
          pointOfSaleId: pos.id,
          userId,
        },
      },
      update: { status: 'ACTIVE' },
      create: {
        companyId,
        pointOfSaleId: pos.id,
        employeeId: employee.id,
        userId,
        displayName: employee.fullName,
      },
      include: { pointOfSale: true },
    });
    return { cashier: ensured, pos: ensured.pointOfSale };
  }

  private async resolvePermissions(
    companyId: string,
    cashier: { permissionsJson: unknown } | null,
    userId: string,
  ): Promise<PosCashierPermissions> {
    const membership = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
      include: { role: { select: { code: true } } },
    });
    const roleCode = membership?.role?.code ?? '';
    const base =
      roleCode === 'POS_SUPERVISOR' ||
      roleCode === 'SHIFT_SUPERVISOR' ||
      roleCode === 'COMPANY_ADMIN' ||
      roleCode === 'COMPANY_OWNER' ||
      roleCode === 'BRANCH_MANAGER'
        ? SUPERVISOR_POS_PERMISSIONS
        : DEFAULT_POS_CASHIER_PERMISSIONS;

    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    const bag =
      settings?.settings &&
      typeof settings.settings === 'object' &&
      !Array.isArray(settings.settings)
        ? (settings.settings as Record<string, unknown>)
        : {};
    const posBag =
      bag.posTerminal &&
      typeof bag.posTerminal === 'object' &&
      !Array.isArray(bag.posTerminal)
        ? (bag.posTerminal as Record<string, unknown>)
        : {};
    const companyDefaults = mergePosPermissions(
      posBag.defaultPermissions,
      base,
    );
    return mergePosPermissions(cashier?.permissionsJson, companyDefaults);
  }

  private async seedTemplateCategories(
    companyId: string,
    nodes: PosTemplateCategory[],
    parentId: string | null = null,
  ) {
    const created: Array<{ id: string; name: string; parentId: string | null }> =
      [];
    for (const node of nodes) {
      const code = `POS-${node.code}`.toUpperCase().slice(0, 40);
      let cat = await this.prisma.itemCategory.findFirst({
        where: { companyId, codeKey: code },
      });
      if (!cat) {
        cat = await this.prisma.itemCategory.create({
          data: {
            companyId,
            code,
            codeKey: code,
            name: node.nameAr,
            parentId,
            status: 'ACTIVE',
          },
        });
      }
      created.push({ id: cat.id, name: cat.name, parentId: cat.parentId });
      if (node.children?.length) {
        const kids = await this.seedTemplateCategories(
          companyId,
          node.children,
          cat.id,
        );
        created.push(...kids);
      }
    }
    return created;
  }

  private async writeAudit(input: {
    companyId: string;
    userId: string;
    pointOfSaleId?: string | null;
    posCashierId?: string | null;
    action: string;
    payload?: Record<string, unknown>;
  }) {
    return this.prisma.posAuditEvent.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        pointOfSaleId: input.pointOfSaleId || null,
        posCashierId: input.posCashierId || null,
        action: input.action,
        payloadJson: (input.payload ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  private normalizeLayout(
    raw: unknown,
    fallbackAccent: string | null = null,
  ): PosTerminalLayout {
    const bag =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};
    const accent =
      typeof bag.accentColor === 'string'
        ? bag.accentColor
        : fallbackAccent;
    const categoryOrder = Array.isArray(bag.categoryOrder)
      ? bag.categoryOrder.filter((x): x is string => typeof x === 'string')
      : [];
    const pinnedItemIds = Array.isArray(bag.pinnedItemIds)
      ? bag.pinnedItemIds.filter((x): x is string => typeof x === 'string')
      : [];
    return {
      accentColor: accent,
      categoryOrder,
      pinnedItemIds,
    };
  }

  private normalizeExchangeRates(
    raw: unknown,
    strict = false,
  ): Record<string, number> {
    const out: Record<string, number> = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (strict) throw new BadRequestException('exchangeRates object required');
      return out;
    }
    for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
      const currency = code.toUpperCase();
      if (!(ALLOWED_CURRENCIES as readonly string[]).includes(currency)) {
        if (strict) {
          throw new BadRequestException(`Unsupported currency: ${currency}`);
        }
        continue;
      }
      if (currency === 'SAR') {
        out.SAR = 1;
        continue;
      }
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        if (strict) {
          throw new BadRequestException(`Invalid rate for ${currency}`);
        }
        continue;
      }
      out[currency] = n;
    }
    if (!out.SAR) out.SAR = 1;
    return out;
  }

  private hasSupervisorPinValue(raw: unknown): boolean {
    return typeof raw === 'string' && raw.trim().length > 0;
  }

  private async loadPosTerminalBag(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    const bag =
      settings?.settings &&
      typeof settings.settings === 'object' &&
      !Array.isArray(settings.settings)
        ? (settings.settings as Record<string, unknown>)
        : {};
    const posBag =
      bag.posTerminal &&
      typeof bag.posTerminal === 'object' &&
      !Array.isArray(bag.posTerminal)
        ? (bag.posTerminal as Record<string, unknown>)
        : {};
    return posBag;
  }

  private async patchPosTerminalSettings(
    companyId: string,
    patch: Record<string, unknown>,
  ) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    const bag =
      settings?.settings &&
      typeof settings.settings === 'object' &&
      !Array.isArray(settings.settings)
        ? { ...(settings.settings as Record<string, unknown>) }
        : {};
    const prev =
      bag.posTerminal &&
      typeof bag.posTerminal === 'object' &&
      !Array.isArray(bag.posTerminal)
        ? (bag.posTerminal as Record<string, unknown>)
        : {};
    bag.posTerminal = { ...prev, ...patch };
    await this.prisma.companySettings.upsert({
      where: { companyId },
      create: { companyId, settings: bag as Prisma.InputJsonValue },
      update: { settings: bag as Prisma.InputJsonValue },
    });
  }

  private async checkSupervisorPin(
    companyId: string,
    pin: string | undefined,
  ): Promise<boolean> {
    const trimmed = String(pin ?? '').trim();
    if (!trimmed) return false;
    const posBag = await this.loadPosTerminalBag(companyId);
    const stored = posBag.supervisorPin;
    if (typeof stored !== 'string' || !stored.trim()) return false;
    return stored.trim() === trimmed;
  }

  private async requireSupervisorPin(
    companyId: string,
    pin: string | undefined,
    message: string,
  ) {
    const ok = await this.checkSupervisorPin(companyId, pin);
    if (!ok) throw new ForbiddenException(message);
  }

  private async computeShiftSales(
    companyId: string,
    openedAt: Date,
    pointOfSaleId?: string | null,
  ) {
    const invoices = await this.prisma.salesInvoice.findMany({
      where: {
        companyId,
        status: { in: ['ISSUED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'] },
        createdAt: { gte: openedAt },
        ...(pointOfSaleId ? { pointOfSaleId } : {}),
      },
      select: {
        paymentMethod: true,
        totalAmount: true,
      },
    });

    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;
    for (const inv of invoices) {
      const amount = Number(inv.totalAmount);
      const method = (inv.paymentMethod ?? 'CASH').toUpperCase();
      if (method === 'CARD') cardSales += amount;
      else if (method === 'TRANSFER' || method === 'BANK')
        transferSales += amount;
      else if (method === 'CASH' || method === 'MIXED') cashSales += amount;
      else if (method === 'CREDIT' || method === 'GIFT' || method === 'WALLET') {
        // non-drawer tenders — ignore for cash/card drawer totals
      } else {
        cashSales += amount;
      }
    }

    return {
      cashSales: Number(cashSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      transferSales: Number(transferSales.toFixed(2)),
      invoiceCount: invoices.length,
    };
  }
}
