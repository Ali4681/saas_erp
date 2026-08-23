import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import {
  GlAccountType,
  JournalEntryType,
  Prisma,
} from '../../generated/prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { STANDARD_COA, coaLevel } from './coa-catalog';

type Money = number | string | Prisma.Decimal;

export type JournalLineInput = {
  glAccountId?: string;
  code?: string;
  debit?: Money;
  credit?: Money;
  memo?: string;
};

export type PostJournalInput = {
  companyId: string;
  userId: string;
  entryType: JournalEntryType;
  entryDate: Date | string;
  currency: string;
  memo?: string;
  sourceType?: string;
  sourceId?: string;
  cashierShiftSessionId?: string;
  lines: JournalLineInput[];
};

export type SalesInvoicePostInput = {
  id: string;
  totalAmount: Money;
  taxAmount: Money;
  discountAmount?: Money;
  currency: string;
  issuedOn: Date | string;
};

export type PurchaseBillPostInput = {
  id: string;
  subtotal: Money;
  taxAmount: Money;
  totalAmount: Money;
  currency: string;
  issuedOn: Date | string;
  freightAmount?: Money;
  insuranceAmount?: Money;
  customsAmount?: Money;
  portFeesAmount?: Money;
};

export type PurchaseOrderTransitInput = {
  id: string;
  purchaseType: 'LOCAL' | 'INTERNATIONAL';
  inTransit: boolean;
  subtotal: Money;
  currency: string;
  orderedOn?: Date | string | null;
  orderNumber?: string;
};

function money(value: Money | undefined | null): number {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new BadRequestException(`Invalid amount: ${String(value)}`);
  }
  return Math.round(n * 100) / 100;
}

function moneyStr(value: number): string {
  return value.toFixed(2);
}

function asDate(value: Date | string): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid date: ${String(value)}`);
  }
  return d;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

@Injectable()
export class GlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async ensureChartOfAccounts(companyId: string) {
    this.tenant.setCompanyId(companyId);

    const sorted = [...STANDARD_COA].sort((a, b) => {
      const levelDiff = coaLevel(a.code) - coaLevel(b.code);
      if (levelDiff !== 0) return levelDiff;
      const lenDiff = a.code.length - b.code.length;
      if (lenDiff !== 0) return lenDiff;
      return a.code.localeCompare(b.code);
    });

    const codeToId = new Map<string, string>();
    const existing = await this.prisma.glAccount.findMany({
      where: { companyId },
      select: { id: true, code: true },
    });
    for (const row of existing) {
      codeToId.set(row.code, row.id);
    }

    for (const def of sorted) {
      const parentId = def.parentCode
        ? (codeToId.get(def.parentCode) ?? null)
        : null;
      if (def.parentCode && !parentId) {
        throw new BadRequestException(
          `Missing parent GL account ${def.parentCode} for ${def.code}`,
        );
      }

      const level = coaLevel(def.code);
      const data = {
        nameAr: def.nameAr,
        nameEn: def.nameEn,
        accountType: def.type as GlAccountType,
        normalBalance: (def.normalBalance ?? 'DEBIT') as 'DEBIT' | 'CREDIT',
        parentId,
        level,
        isPostable: def.isPostable,
        isContra: def.isContra ?? false,
        isActive: true,
        sortOrder: Number(def.code) || 0,
      };

      const currentId = codeToId.get(def.code);
      if (currentId) {
        await this.prisma.glAccount.update({
          where: { id: currentId },
          data,
        });
      } else {
        const created = await this.prisma.glAccount.create({
          data: {
            companyId,
            code: def.code,
            ...data,
          },
        });
        codeToId.set(def.code, created.id);
      }
    }

    const mapping = await this.prisma.companyAccountMapping.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });

    const accounts = await this.listAccounts(companyId);
    return { accounts, mapping, accountCount: accounts.length };
  }

  listAccounts(
    companyId: string,
    opts?: { postableOnly?: boolean },
  ) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.glAccount.findMany({
      where: {
        companyId,
        isActive: true,
        ...(opts?.postableOnly ? { isPostable: true } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async getMapping(companyId: string) {
    this.tenant.setCompanyId(companyId);
    const mapping = await this.prisma.companyAccountMapping.findUnique({
      where: { companyId },
    });
    if (!mapping) {
      return this.prisma.companyAccountMapping.create({
        data: { companyId },
      });
    }
    return mapping;
  }

  async upsertMapping(
    companyId: string,
    data: Partial<{
      salesRevenueCode: string;
      salesVatPayableCode: string;
      salesCashPosCode: string;
      salesCardBankCode: string;
      inventoryGoodsCode: string;
      inventoryInTransitCode: string;
      inventoryShrinkageCode: string;
      apLocalCode: string;
      apInternationalCode: string;
      importLandingCostCode: string;
      cogsCode: string;
      corporateWalletCode: string;
      employeeAdvanceCode: string;
      pettyCashExpenseCode: string;
      mainTreasuryCode: string;
    }>,
  ) {
    this.tenant.setCompanyId(companyId);
    const cleaned = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined),
    );
    return this.prisma.companyAccountMapping.upsert({
      where: { companyId },
      create: { companyId, ...cleaned },
      update: cleaned,
    });
  }

  async resolveAccountId(companyId: string, code: string): Promise<string> {
    this.tenant.setCompanyId(companyId);
    const account = await this.prisma.glAccount.findUnique({
      where: { companyId_code: { companyId, code } },
      select: { id: true, isPostable: true, isActive: true, code: true },
    });
    if (!account || !account.isActive) {
      throw new BadRequestException(`GL account not found: ${code}`);
    }
    if (!account.isPostable) {
      throw new BadRequestException(`GL account is not postable: ${code}`);
    }
    return account.id;
  }

  async postJournal(input: PostJournalInput) {
    this.tenant.setCompanyId(input.companyId);
    if (!input.lines?.length) {
      throw new BadRequestException('Journal requires at least one line');
    }

    let totalDebit = 0;
    let totalCredit = 0;
    const resolvedLines: Array<{
      glAccountId: string;
      debit: string;
      credit: string;
      memo?: string;
    }> = [];

    for (const line of input.lines) {
      const debit = money(line.debit);
      const credit = money(line.credit);
      if (debit < 0 || credit < 0) {
        throw new BadRequestException('Debit/credit cannot be negative');
      }
      if (debit > 0 && credit > 0) {
        throw new BadRequestException(
          'A journal line cannot have both debit and credit',
        );
      }
      if (debit === 0 && credit === 0) {
        continue;
      }

      let glAccountId = line.glAccountId;
      if (!glAccountId && line.code) {
        glAccountId = await this.resolveAccountId(input.companyId, line.code);
      }
      if (!glAccountId) {
        throw new BadRequestException(
          'Journal line requires glAccountId or code',
        );
      }

      const account = await this.prisma.glAccount.findFirst({
        where: { id: glAccountId, companyId: input.companyId },
        select: { id: true, isPostable: true, isActive: true, code: true },
      });
      if (!account || !account.isActive) {
        throw new BadRequestException(
          `GL account missing: ${line.code ?? glAccountId}`,
        );
      }
      if (!account.isPostable) {
        throw new BadRequestException(
          `GL account is not postable: ${account.code}`,
        );
      }

      totalDebit += debit;
      totalCredit += credit;
      resolvedLines.push({
        glAccountId: account.id,
        debit: moneyStr(debit),
        credit: moneyStr(credit),
        memo: line.memo,
      });
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    if (resolvedLines.length === 0) {
      throw new BadRequestException('Journal has no non-zero lines');
    }
    if (totalDebit !== totalCredit) {
      throw new BadRequestException(
        `Unbalanced journal: debit ${moneyStr(totalDebit)} != credit ${moneyStr(totalCredit)}`,
      );
    }

    const entryDate = asDate(input.entryDate);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          companyId: input.companyId,
          entryType: input.entryType,
          status: 'POSTED',
          entryDate,
          memo: input.memo,
          currency: input.currency,
          cashierShiftSessionId: input.cashierShiftSessionId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          createdByUserId: input.userId,
          postedAt: now,
          postedByUserId: input.userId,
        },
      });

      await tx.journalLine.createMany({
        data: resolvedLines.map((l) => ({
          companyId: input.companyId,
          journalEntryId: entry.id,
          glAccountId: l.glAccountId,
          debit: l.debit,
          credit: l.credit,
          memo: l.memo,
        })),
      });

      return tx.journalEntry.findUniqueOrThrow({
        where: { id: entry.id },
        include: {
          lines: {
            include: {
              glAccount: {
                select: {
                  id: true,
                  code: true,
                  nameEn: true,
                  nameAr: true,
                  accountType: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async postSalesInvoice(
    companyId: string,
    userId: string,
    invoice: SalesInvoicePostInput,
    paymentKind: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT' | 'BNPL',
  ) {
    this.tenant.setCompanyId(companyId);
    await this.ensureChartOfAccounts(companyId);
    const mapping = await this.getMapping(companyId);

    const total = money(invoice.totalAmount);
    const tax = money(invoice.taxAmount);
    const discount = money(invoice.discountAmount ?? 0);
    const revenue = Math.round((total - tax + discount) * 100) / 100;
    if (total <= 0) {
      throw new BadRequestException('Invoice total must be positive');
    }
    if (tax < 0 || tax > total) {
      throw new BadRequestException('Invalid invoice tax amount');
    }

    const lines: JournalLineInput[] = [];
    if (paymentKind === 'CASH') {
      lines.push({
        code: mapping.salesCashPosCode,
        debit: total,
        credit: 0,
        memo: 'POS cash / sales receipt',
      });
    } else if (paymentKind === 'CARD') {
      lines.push({
        code: mapping.salesCardBankCode,
        debit: total,
        credit: 0,
        memo: 'Card / network sales receipt',
      });
    } else if (paymentKind === 'BNPL') {
      lines.push({
        code: mapping.bnplReceivableCode,
        debit: total,
        credit: 0,
        memo: 'BNPL provider receivable',
      });
    } else {
      const cashShare = Math.round((total / 2) * 100) / 100;
      const cardShare = Math.round((total - cashShare) * 100) / 100;
      lines.push({
        code: mapping.salesCashPosCode,
        debit: cashShare,
        credit: 0,
        memo: 'Mixed tender — cash share',
      });
      lines.push({
        code: mapping.salesCardBankCode,
        debit: cardShare,
        credit: 0,
        memo: 'Mixed tender — card share',
      });
    }

    if (paymentKind === 'CREDIT') {
      // For B2B credit terms sales we post AR instead of cash/bank.
      lines.length = 0;
      lines.push({
        code: mapping.salesArLocalCode,
        debit: total,
        credit: 0,
        memo: 'B2B credit sales — Accounts Receivable',
      });
    }

    lines.push({
      code: mapping.salesRevenueCode,
      debit: 0,
      credit: revenue,
      memo: 'Sales revenue (net)',
    });
    if (tax > 0) {
      lines.push({
        code: mapping.salesVatPayableCode,
        debit: 0,
        credit: tax,
        memo: 'Output VAT payable',
      });
    }
    if (discount > 0) {
      lines.push({
        code: mapping.salesDiscountCode,
        debit: discount,
        credit: 0,
        memo: 'Sales discounts granted',
      });
    }

    return this.postJournal({
      companyId,
      userId,
      entryType: 'SALES',
      entryDate: invoice.issuedOn,
      currency: invoice.currency,
      memo: `Sales invoice ${invoice.id}`,
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      lines,
    });
  }

  async postPurchaseBill(
    companyId: string,
    userId: string,
    bill: PurchaseBillPostInput,
    supplierType: 'LOCAL' | 'INTERNATIONAL',
  ) {
    this.tenant.setCompanyId(companyId);
    await this.ensureChartOfAccounts(companyId);
    const mapping = await this.getMapping(companyId);

    const subtotal = money(bill.subtotal);
    const tax = money(bill.taxAmount);
    const total = money(bill.totalAmount);
    const landing =
      supplierType === 'INTERNATIONAL'
        ? money(bill.freightAmount) +
          money(bill.insuranceAmount) +
          money(bill.customsAmount) +
          money(bill.portFeesAmount)
        : 0;

    if (subtotal < 0 || tax < 0 || total < 0) {
      throw new BadRequestException('Bill amounts cannot be negative');
    }

    const apCode =
      supplierType === 'INTERNATIONAL'
        ? mapping.apInternationalCode
        : mapping.apLocalCode;
    const apAmount = Math.round((subtotal + tax + landing) * 100) / 100;

    const lines: JournalLineInput[] = [
      {
        code: mapping.inventoryGoodsCode,
        debit: subtotal,
        credit: 0,
        memo: 'Inventory — goods received / billed',
      },
    ];
    if (landing > 0) {
      lines.push({
        code: mapping.importLandingCostCode,
        debit: landing,
        credit: 0,
        memo: 'Import landing costs',
      });
    }
    // Input VAT is debited (asset / offset to VAT payable). Keeps the entry balanced.
    if (tax > 0) {
      lines.push({
        code: mapping.salesVatPayableCode,
        debit: tax,
        credit: 0,
        memo: 'Input VAT on purchase',
      });
    }
    lines.push({
      code: apCode,
      debit: 0,
      credit: apAmount,
      memo:
        supplierType === 'INTERNATIONAL'
          ? 'AP — international supplier'
          : 'AP — local supplier',
    });

    // Prefer bill.totalAmount when no landing was added
    if (landing === 0 && Math.abs(apAmount - total) > 0.009) {
      throw new BadRequestException(
        `Bill totals inconsistent: subtotal+tax ${moneyStr(apAmount)} != total ${moneyStr(total)}`,
      );
    }

    return this.postJournal({
      companyId,
      userId,
      entryType: 'PURCHASE',
      entryDate: bill.issuedOn,
      currency: bill.currency,
      memo: `Supplier bill ${bill.id}`,
      sourceType: 'SUPPLIER_BILL',
      sourceId: bill.id,
      lines,
    });
  }

  async postGoodsReceiptFromTransit(
    companyId: string,
    userId: string,
    po: PurchaseOrderTransitInput,
  ) {
    this.tenant.setCompanyId(companyId);
    if (po.purchaseType !== 'INTERNATIONAL' || !po.inTransit) {
      return null;
    }

    await this.ensureChartOfAccounts(companyId);
    const mapping = await this.getMapping(companyId);
    const amount = money(po.subtotal);
    if (amount <= 0) {
      throw new BadRequestException('PO subtotal must be positive');
    }

    return this.postJournal({
      companyId,
      userId,
      entryType: 'INVENTORY_ADJUSTMENT',
      entryDate: po.orderedOn ?? new Date(),
      currency: po.currency,
      memo: `Goods receipt from in-transit PO ${po.id}`,
      sourceType: 'PURCHASE_ORDER',
      sourceId: po.id,
      lines: [
        {
          code: mapping.inventoryGoodsCode,
          debit: amount,
          credit: 0,
          memo: 'Inventory goods on receipt',
        },
        {
          code: mapping.inventoryInTransitCode,
          debit: 0,
          credit: amount,
          memo: 'Clear in-transit inventory',
        },
      ],
    });
  }

  listJournals(companyId: string) {
    this.tenant.setCompanyId(companyId);
    return this.prisma.journalEntry.findMany({
      where: { companyId },
      include: {
        lines: {
          include: {
            glAccount: {
              select: {
                id: true,
                code: true,
                nameEn: true,
                nameAr: true,
                accountType: true,
              },
            },
          },
        },
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async trialBalance(companyId: string, asOf?: string) {
    this.tenant.setCompanyId(companyId);
    const asOfDate = asOf ? endOfDay(asDate(asOf)) : undefined;
    const rows = await this.aggregatePostedLines(companyId, {
      to: asOfDate,
    });

    const accounts = rows.map((r) => {
      const debit = r.debit;
      const credit = r.credit;
      const net = Math.round((debit - credit) * 100) / 100;
      return {
        glAccountId: r.glAccountId,
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        accountType: r.accountType,
        debit: moneyStr(debit),
        credit: moneyStr(credit),
        net: moneyStr(net),
      };
    });

    const totals = accounts.reduce(
      (acc, a) => {
        acc.debit += Number(a.debit);
        acc.credit += Number(a.credit);
        return acc;
      },
      { debit: 0, credit: 0 },
    );

    return {
      asOf: asOf ?? null,
      accounts,
      totals: {
        debit: moneyStr(totals.debit),
        credit: moneyStr(totals.credit),
      },
    };
  }

  async incomeStatement(companyId: string, from: string, to: string) {
    this.tenant.setCompanyId(companyId);
    if (!from || !to) {
      throw new BadRequestException('from and to are required');
    }
    const fromDate = asDate(from);
    const toDate = endOfDay(asDate(to));
    const rows = await this.aggregatePostedLines(companyId, {
      from: fromDate,
      to: toDate,
      types: ['REVENUE', 'EXPENSE'],
    });

    const revenue = rows
      .filter((r) => r.accountType === 'REVENUE')
      .map((r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        amount: moneyStr(r.credit - r.debit),
      }));
    const expenses = rows
      .filter((r) => r.accountType === 'EXPENSE')
      .map((r) => ({
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        amount: moneyStr(r.debit - r.credit),
      }));

    const totalRevenue = revenue.reduce((s, r) => s + Number(r.amount), 0);
    const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0);

    return {
      from,
      to,
      revenue,
      expenses,
      totalRevenue: moneyStr(totalRevenue),
      totalExpenses: moneyStr(totalExpenses),
      netIncome: moneyStr(totalRevenue - totalExpenses),
    };
  }

  async balanceSheet(companyId: string, asOf: string) {
    this.tenant.setCompanyId(companyId);
    if (!asOf) {
      throw new BadRequestException('asOf is required');
    }
    const asOfDate = endOfDay(asDate(asOf));
    const rows = await this.aggregatePostedLines(companyId, {
      to: asOfDate,
      types: ['ASSET', 'LIABILITY', 'EQUITY'],
    });

    const section = (type: GlAccountType, invert: boolean) =>
      rows
        .filter((r) => r.accountType === type)
        .map((r) => {
          const raw = invert ? r.credit - r.debit : r.debit - r.credit;
          return {
            code: r.code,
            nameEn: r.nameEn,
            nameAr: r.nameAr,
            amount: moneyStr(raw),
          };
        });

    const assets = section('ASSET', false);
    const liabilities = section('LIABILITY', true);
    const equity = section('EQUITY', true);

    // Revenue and expenses stay open until a closing entry moves them to
    // retained earnings, so surface them as a computed equity line.
    const resultRows = await this.aggregatePostedLines(companyId, {
      to: asOfDate,
      types: ['REVENUE', 'EXPENSE'],
    });
    const currentPeriodEarnings = resultRows.reduce(
      (sum, r) =>
        r.accountType === 'REVENUE'
          ? sum + (r.credit - r.debit)
          : sum - (r.debit - r.credit),
      0,
    );
    if (Math.abs(currentPeriodEarnings) > 0.009) {
      const CURRENT_YEAR_PL_CODE = '324000';
      const existing = equity.find((e) => e.code === CURRENT_YEAR_PL_CODE);
      if (existing) {
        existing.amount = moneyStr(
          Number(existing.amount) + currentPeriodEarnings,
        );
      } else {
        equity.push({
          code: CURRENT_YEAR_PL_CODE,
          nameEn: 'Current Year P&L',
          nameAr: 'أرباح / خسائر السنة المالية الحالية',
          amount: moneyStr(currentPeriodEarnings),
        });
      }
    }

    const totalAssets = assets.reduce((s, a) => s + Number(a.amount), 0);
    const totalLiabilities = liabilities.reduce(
      (s, a) => s + Number(a.amount),
      0,
    );
    const totalEquity = equity.reduce((s, a) => s + Number(a.amount), 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      asOf,
      assets,
      liabilities,
      equity,
      totalAssets: moneyStr(totalAssets),
      totalLiabilities: moneyStr(totalLiabilities),
      totalEquity: moneyStr(totalEquity),
      totalLiabilitiesAndEquity: moneyStr(totalLiabilitiesAndEquity),
      balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  private async aggregatePostedLines(
    companyId: string,
    opts: {
      from?: Date;
      to?: Date;
      types?: GlAccountType[];
    },
  ) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        companyId,
        glAccountId: { not: null },
        journalEntry: {
          companyId,
          status: 'POSTED',
          ...(opts.from || opts.to
            ? {
                entryDate: {
                  ...(opts.from ? { gte: opts.from } : {}),
                  ...(opts.to ? { lte: opts.to } : {}),
                },
              }
            : {}),
        },
        ...(opts.types
          ? { glAccount: { accountType: { in: opts.types } } }
          : {}),
      },
      select: {
        debit: true,
        credit: true,
        glAccountId: true,
        glAccount: {
          select: {
            code: true,
            nameEn: true,
            nameAr: true,
            accountType: true,
          },
        },
      },
    });

    const map = new Map<
      string,
      {
        glAccountId: string;
        code: string;
        nameEn: string;
        nameAr: string;
        accountType: GlAccountType;
        debit: number;
        credit: number;
      }
    >();

    for (const line of lines) {
      if (!line.glAccountId || !line.glAccount) continue;
      const key = line.glAccountId;
      const cur = map.get(key) ?? {
        glAccountId: line.glAccountId,
        code: line.glAccount.code,
        nameEn: line.glAccount.nameEn,
        nameAr: line.glAccount.nameAr,
        accountType: line.glAccount.accountType,
        debit: 0,
        credit: 0,
      };
      cur.debit += Number(line.debit);
      cur.credit += Number(line.credit);
      map.set(key, cur);
    }

    return [...map.values()]
      .map((r) => ({
        ...r,
        debit: Math.round(r.debit * 100) / 100,
        credit: Math.round(r.credit * 100) / 100,
      }))
      .filter((r) => r.debit !== 0 || r.credit !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }
}
