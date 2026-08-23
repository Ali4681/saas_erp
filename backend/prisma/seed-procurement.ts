/**
 * Demo data for the procure-to-pay + general ledger extensions:
 * supplier classification, item reorder policy, purchase requisitions,
 * goods receipts, three-way matched bills and posted GL journals.
 *
 * Idempotent: safe to re-run on an already seeded demo company.
 * See docs/CHART_OF_ACCOUNTS_AND_PURCHASING.md
 */
import type { PrismaClient } from '../src/generated/prisma/client';

const day = (offset: number) => {
  const d = new Date('2026-07-01T08:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

const money = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

type JournalLineSpec = { code: string; debit: number; credit: number; memo: string };

export type ProcurementSeedSummary = {
  suppliersClassified: number;
  itemsWithReorderPolicy: number;
  purchaseOrdersClassified: number;
  requisitions: number;
  goodsReceipts: number;
  billsMatched: number;
  journalEntries: number;
};

export async function seedProcurementDemoData(
  prisma: PrismaClient,
  params: { companyId: string; requesterId: string; approverId: string },
): Promise<ProcurementSeedSummary> {
  const { companyId, requesterId, approverId } = params;
  const summary: ProcurementSeedSummary = {
    suppliersClassified: 0,
    itemsWithReorderPolicy: 0,
    purchaseOrdersClassified: 0,
    requisitions: 0,
    goodsReceipts: 0,
    billsMatched: 0,
    journalEntries: 0,
  };

  const mapping =
    (await prisma.companyAccountMapping.findUnique({ where: { companyId } })) ??
    (await prisma.companyAccountMapping.create({ data: { companyId } }));

  const accountRows = await prisma.glAccount.findMany({
    where: { companyId, isPostable: true, isActive: true },
    select: { id: true, code: true },
  });
  const accountIdByCode = new Map(accountRows.map((a) => [a.code, a.id]));
  if (accountIdByCode.size === 0) {
    // Chart of accounts not seeded yet — nothing to attach postings to.
    return summary;
  }

  /** Posts a balanced journal once per source document. */
  async function postJournalOnce(input: {
    entryType: 'SALES' | 'PURCHASE' | 'INVENTORY_ADJUSTMENT';
    entryDate: Date;
    currency: string;
    memo: string;
    sourceType: string;
    sourceId: string;
    lines: JournalLineSpec[];
  }) {
    const existing = await prisma.journalEntry.findFirst({
      where: {
        companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
      select: { id: true },
    });
    if (existing) return false;

    const lines = input.lines.filter((l) => l.debit > 0 || l.credit > 0);
    const totalDebit = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100);
    const totalCredit = Math.round(
      lines.reduce((s, l) => s + l.credit, 0) * 100,
    );
    if (lines.length === 0 || totalDebit !== totalCredit) {
      throw new Error(
        `Unbalanced demo journal for ${input.sourceType} ${input.sourceId}: ${totalDebit} != ${totalCredit}`,
      );
    }
    const resolved = lines.map((l) => {
      const glAccountId = accountIdByCode.get(l.code);
      if (!glAccountId) {
        throw new Error(`Missing postable GL account ${l.code}`);
      }
      return {
        glAccountId,
        debit: money(l.debit),
        credit: money(l.credit),
        memo: l.memo,
      };
    });

    const entry = await prisma.journalEntry.create({
      data: {
        companyId,
        entryType: input.entryType,
        status: 'POSTED',
        entryDate: input.entryDate,
        memo: input.memo,
        currency: input.currency,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdByUserId: requesterId,
        postedAt: new Date(),
        postedByUserId: approverId,
      },
    });
    await prisma.journalLine.createMany({
      data: resolved.map((l) => ({
        companyId,
        journalEntryId: entry.id,
        glAccountId: l.glAccountId,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo,
      })),
    });
    summary.journalEntries += 1;
    return true;
  }

  // ── Supplier classification (local vs import) ────────────────────
  const suppliers = await prisma.supplier.findMany({
    where: { companyId, codeKey: { startsWith: 'SUP-' } },
    orderBy: { codeKey: 'asc' },
  });
  const importProfiles = [
    { currency: 'USD', country: 'United States', originCountry: 'United States' },
    { currency: 'CNY', country: 'China', originCountry: 'China' },
  ];
  for (let i = 0; i < suppliers.length; i++) {
    const isImport = i >= suppliers.length - importProfiles.length;
    const profile = importProfiles[i - (suppliers.length - importProfiles.length)];
    await prisma.supplier.update({
      where: { id: suppliers[i]!.id },
      data: isImport
        ? {
            supplierType: 'INTERNATIONAL',
            currency: profile!.currency,
            paymentTermsDays: 60,
            country: profile!.country,
            originCountry: profile!.originCountry,
          }
        : {
            supplierType: 'LOCAL',
            currency: 'SAR',
            paymentTermsDays: [0, 15, 30, 45][i % 4]!,
            country: 'Saudi Arabia',
            originCountry: 'Saudi Arabia',
          },
    });
    summary.suppliersClassified += 1;
  }
  const importSuppliers = suppliers.slice(suppliers.length - importProfiles.length);

  // ── Item reorder policy + inventory account ──────────────────────
  const items = await prisma.item.findMany({
    where: { companyId, skuKey: { startsWith: 'SKU-' }, parentItemId: null },
    orderBy: { skuKey: 'asc' },
  });
  const inventoryAccountId = accountIdByCode.get(mapping.inventoryGoodsCode);
  for (let i = 0; i < items.length; i++) {
    const isImported = i >= items.length - 2;
    await prisma.item.update({
      where: { id: items[i]!.id },
      data: {
        reorderQty: (20 + i * 5).toFixed(3),
        supplySource: isImported ? 'INTERNATIONAL' : i % 4 === 3 ? 'EITHER' : 'LOCAL',
        preferredSupplierId: suppliers[i % Math.max(suppliers.length, 1)]?.id ?? null,
        inventoryAccountId: inventoryAccountId ?? null,
      },
    });
    summary.itemsWithReorderPolicy += 1;
  }

  // ── Purchase requisitions (full status coverage) ─────────────────
  const requisitionSpecs = [
    {
      requisitionNumber: 'PR-2026-001',
      status: 'CONVERTED' as const,
      demandSource: 'REORDER_POINT' as const,
      notes: 'Auto-generated from reorder point breach',
      approved: true,
      neededBy: day(12),
    },
    {
      requisitionNumber: 'PR-2026-002',
      status: 'APPROVED' as const,
      demandSource: 'BRANCH_REQUISITION' as const,
      notes: 'Jeddah branch weekly replenishment',
      approved: true,
      neededBy: day(16),
    },
    {
      requisitionNumber: 'PR-2026-003',
      status: 'SUBMITTED' as const,
      demandSource: 'MANAGEMENT_PLAN' as const,
      notes: 'Seasonal campaign stock build-up',
      approved: false,
      neededBy: day(24),
    },
    {
      requisitionNumber: 'PR-2026-004',
      status: 'DRAFT' as const,
      demandSource: 'OTHER' as const,
      notes: 'Spare parts wish list — pending review',
      approved: false,
      neededBy: day(30),
    },
  ];

  const branch = await prisma.companyBranch.findFirst({
    where: { companyId },
    orderBy: { code: 'asc' },
  });

  const requisitions: Array<{ id: string; requisitionNumber: string }> = [];
  for (let i = 0; i < requisitionSpecs.length; i++) {
    const spec = requisitionSpecs[i]!;
    let requisition = await prisma.purchaseRequisition.findFirst({
      where: { companyId, requisitionNumber: spec.requisitionNumber },
    });
    if (!requisition) {
      requisition = await prisma.purchaseRequisition.create({
        data: {
          companyId,
          requisitionNumber: spec.requisitionNumber,
          status: spec.status,
          demandSource: spec.demandSource,
          companyBranchId: branch?.id ?? null,
          requestedById: requesterId,
          approvedById: spec.approved ? approverId : null,
          notes: spec.notes,
          neededBy: spec.neededBy,
          items: {
            create: items.slice(i, i + 2).map((item, position) => ({
              itemId: item.id,
              description: item.name,
              quantity: (10 + position * 5).toFixed(3),
              estimatedUnitCost: Number(item.cost ?? 25).toFixed(2),
              position: position + 1,
            })),
          },
        },
      });
    }
    requisitions.push(requisition);
    summary.requisitions += 1;
  }

  // ── Purchase order classification + import landing costs ─────────
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { companyId, orderNumber: { startsWith: 'PO-2026-' } },
    orderBy: { orderNumber: 'asc' },
    include: { items: true },
  });
  const demandSources = [
    'REORDER_POINT',
    'BRANCH_REQUISITION',
    'MANAGEMENT_PLAN',
  ] as const;

  for (let i = 0; i < purchaseOrders.length; i++) {
    const po = purchaseOrders[i]!;
    const isImport = importSuppliers.some((s) => s.id === po.supplierId);
    const subtotal = Number(po.subtotal);
    const freight = isImport ? Math.round(subtotal * 0.08 * 100) / 100 : 0;
    const insurance = isImport ? Math.round(subtotal * 0.02 * 100) / 100 : 0;
    const customs = isImport ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
    const portFees = isImport ? 350 : 0;

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        purchaseType: isImport ? 'INTERNATIONAL' : 'LOCAL',
        demandSource: demandSources[i % demandSources.length]!,
        requisitionId: i === 0 ? (requisitions[0]?.id ?? null) : po.requisitionId,
        freightAmount: money(freight),
        insuranceAmount: money(insurance),
        customsAmount: money(customs),
        portFeesAmount: money(portFees),
        customsDeclarationNumber: isImport
          ? `CD-2026-${String(i + 1).padStart(5, '0')}`
          : null,
        originCountry: isImport
          ? (importSuppliers.find((s) => s.id === po.supplierId)?.originCountry ??
            null)
          : 'Saudi Arabia',
        inTransit: isImport && po.status !== 'RECEIVED',
      },
    });
    summary.purchaseOrdersClassified += 1;

    // In-transit import stock is recognised before physical receipt.
    if (isImport && po.status !== 'RECEIVED' && subtotal > 0) {
      await postJournalOnce({
        entryType: 'INVENTORY_ADJUSTMENT',
        entryDate: po.orderedOn ?? day(i + 3),
        currency: 'SAR',
        memo: `In-transit inventory for PO ${po.orderNumber}`,
        sourceType: 'PURCHASE_ORDER',
        sourceId: po.id,
        lines: [
          {
            code: mapping.inventoryInTransitCode,
            debit: subtotal,
            credit: 0,
            memo: 'Goods in transit (import)',
          },
          {
            code: mapping.apInternationalCode,
            debit: 0,
            credit: subtotal,
            memo: 'AP — international supplier',
          },
        ],
      });
    }
  }

  // ── Goods receipts against received POs ──────────────────────────
  const receivedPos = purchaseOrders.filter((po) => po.status === 'RECEIVED');
  const grnTargets = receivedPos.slice(0, 3);
  const receiptByPoId = new Map<string, string>();

  for (let i = 0; i < grnTargets.length; i++) {
    const po = grnTargets[i]!;
    if (!po.warehouseId || po.items.length === 0) continue;
    const receiptNumber = `GRN-2026-${String(i + 1).padStart(3, '0')}`;
    // The last receipt is deliberately partial to exercise 3-way mismatch.
    const partial = i === grnTargets.length - 1;

    let receipt = await prisma.goodsReceipt.findFirst({
      where: { companyId, receiptNumber },
    });
    if (!receipt) {
      receipt = await prisma.goodsReceipt.create({
        data: {
          companyId,
          purchaseOrderId: po.id,
          warehouseId: po.warehouseId,
          receiptNumber,
          status: 'POSTED',
          receivedOn: day(i + 8),
          receivedById: requesterId,
          notes: partial
            ? 'Partial delivery — remaining quantity backordered'
            : 'Full delivery matched against the purchase order',
          items: {
            create: po.items.map((line, position) => {
              const ordered = Number(line.quantity);
              return {
                purchaseOrderItemId: line.id,
                itemId: line.itemId!,
                quantityOrdered: ordered.toFixed(3),
                quantityReceived: (partial ? ordered * 0.8 : ordered).toFixed(3),
                unitCost: Number(line.unitCost).toFixed(2),
                position: position + 1,
              };
            }),
          },
        },
      });
    }
    receiptByPoId.set(po.id, receipt.id);
    summary.goodsReceipts += 1;
  }

  // ── Three-way matching + purchase postings on bills ──────────────
  const bills = await prisma.supplierBill.findMany({
    where: { companyId, billNumber: { startsWith: 'BILL-2026-' } },
    orderBy: { billNumber: 'asc' },
    include: { supplier: { select: { supplierType: true } } },
  });

  for (const bill of bills) {
    const receiptId = bill.purchaseOrderId
      ? receiptByPoId.get(bill.purchaseOrderId)
      : undefined;
    if (receiptId) {
      const receipt = await prisma.goodsReceipt.findUniqueOrThrow({
        where: { id: receiptId },
        include: { items: true },
      });
      const fullyReceived = receipt.items.every(
        (line) => Number(line.quantityReceived) >= Number(line.quantityOrdered),
      );
      await prisma.supplierBill.update({
        where: { id: bill.id },
        data: { goodsReceiptId: receiptId, threeWayMatched: fullyReceived },
      });
      summary.billsMatched += 1;
    }

    if (bill.status === 'DRAFT' || bill.status === 'CANCELLED') continue;

    const subtotal = Number(bill.subtotal);
    const tax = Number(bill.taxAmount);
    const isImport = bill.supplier.supplierType === 'INTERNATIONAL';
    await postJournalOnce({
      entryType: 'PURCHASE',
      entryDate: bill.issuedOn ?? day(10),
      currency: bill.currency,
      memo: `Supplier bill ${bill.billNumber}`,
      sourceType: 'SUPPLIER_BILL',
      sourceId: bill.id,
      lines: [
        {
          code: mapping.inventoryGoodsCode,
          debit: subtotal,
          credit: 0,
          memo: 'Inventory — goods received / billed',
        },
        {
          code: mapping.salesVatPayableCode,
          debit: tax,
          credit: 0,
          memo: 'Input VAT on purchase',
        },
        {
          code: isImport ? mapping.apInternationalCode : mapping.apLocalCode,
          debit: 0,
          credit: subtotal + tax,
          memo: isImport ? 'AP — international supplier' : 'AP — local supplier',
        },
      ],
    });
  }

  // ── Sales postings so the financial statements are not empty ─────
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      companyId,
      invoiceNumber: { startsWith: 'INV-2026-' },
      status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
    },
    orderBy: { invoiceNumber: 'asc' },
  });

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i]!;
    const total = Number(invoice.totalAmount);
    const tax = Number(invoice.taxAmount);
    if (total <= 0) continue;
    const cashSale = i % 2 === 0;
    await postJournalOnce({
      entryType: 'SALES',
      entryDate: invoice.issuedOn ?? day(i + 5),
      currency: invoice.currency,
      memo: `Sales invoice ${invoice.invoiceNumber}`,
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      lines: [
        {
          code: cashSale ? mapping.salesCashPosCode : mapping.salesCardBankCode,
          debit: total,
          credit: 0,
          memo: cashSale ? 'POS cash / sales receipt' : 'Card / network sales receipt',
        },
        {
          code: mapping.salesRevenueCode,
          debit: 0,
          credit: Math.round((total - tax) * 100) / 100,
          memo: 'Sales revenue (net)',
        },
        {
          code: mapping.salesVatPayableCode,
          debit: 0,
          credit: tax,
          memo: 'Output VAT payable',
        },
      ],
    });
  }

  return summary;
}
