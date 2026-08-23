/**
 * Demo data for enterprise inventory + CRM ops + governance additions.
 * Idempotent — safe to re-run after migrate deploy.
 */
import type { PrismaClient } from '../src/generated/prisma/client';

const day = (offset: number) => {
  const d = new Date('2026-07-01T08:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

async function ensure<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  return existing ?? create();
}

export type EnterpriseOpsSeedSummary = {
  itemBarcodes: number;
  itemBatches: number;
  stockTransfers: number;
  stockAdjustments: number;
  labelTemplates: number;
  invoicePrintTemplates: number;
  priceLists: number;
  coupons: number;
  bundles: number;
  loyaltyAccounts: number;
  storeCredits: number;
  supportTickets: number;
  customerPos: number;
  sodRules: number;
  approvalThresholds: number;
  industryActivities: number;
  contactsEnriched: number;
};

export async function seedEnterpriseOpsDemoData(
  prisma: PrismaClient,
  params: { companyId: string; adminUserId: string; opsUserId: string },
): Promise<EnterpriseOpsSeedSummary> {
  const { companyId, adminUserId, opsUserId } = params;
  const summary: EnterpriseOpsSeedSummary = {
    itemBarcodes: 0,
    itemBatches: 0,
    stockTransfers: 0,
    stockAdjustments: 0,
    labelTemplates: 0,
    invoicePrintTemplates: 0,
    priceLists: 0,
    coupons: 0,
    bundles: 0,
    loyaltyAccounts: 0,
    storeCredits: 0,
    supportTickets: 0,
    customerPos: 0,
    sodRules: 0,
    approvalThresholds: 0,
    industryActivities: 0,
    contactsEnriched: 0,
  };

  const items = await prisma.item.findMany({
    where: { companyId, parentItemId: null },
    orderBy: { sku: 'asc' },
    take: 10,
  });
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId },
    orderBy: { code: 'asc' },
  });
  const mainWh = warehouses[0];
  const secondWh =
    warehouses.find((w) => w.code !== mainWh?.code) ??
    (mainWh
      ? await ensure(
          () =>
            prisma.warehouse.findFirst({
              where: { companyId, code: 'BRANCH' },
            }),
          () =>
            prisma.warehouse.create({
              data: {
                companyId,
                code: 'BRANCH',
                name: 'Branch Warehouse',
              },
            }),
        )
      : null);

  // ── Item barcodes (ItemBarcode table) ────────────────────────────
  for (let i = 0; i < Math.min(items.length, 8); i++) {
    const item = items[i]!;
    const barcode = item.barcode ?? `62890000000${i}`;
    await ensure(
      () =>
        prisma.itemBarcode.findFirst({
          where: { companyId, barcode },
        }),
      () =>
        prisma.itemBarcode.create({
          data: {
            companyId,
            itemId: item.id,
            barcode,
            barcodeType: i % 3 === 0 ? 'SUPPLIER' : i % 2 === 0 ? 'LOGISTIC' : 'RETAIL',
            isPrimary: true,
          },
        }),
    );
    summary.itemBarcodes += 1;
  }

  // ── Batches for perishable-ish items ─────────────────────────────
  for (let i = 0; i < Math.min(items.length, 4); i++) {
    const item = items[i]!;
    const batchNumber = `BATCH-2026-${String(i + 1).padStart(2, '0')}`;
    await ensure(
      () =>
        prisma.itemBatch.findFirst({
          where: { companyId, itemId: item.id, batchNumber },
        }),
      () =>
        prisma.itemBatch.create({
          data: {
            companyId,
            itemId: item.id,
            batchNumber,
            manufacturedOn: day(i),
            expiresOn: day(90 + i * 10),
            quantity: (20 + i * 5).toFixed(3),
          },
        }),
    );
    summary.itemBatches += 1;
  }

  // ── Stock transfer (DRAFT + RECEIVED samples) ────────────────────
  if (mainWh && secondWh && items[0] && items[1]) {
    const draftNumber = 'TRF-SEED-001';
    await ensure(
      () =>
        prisma.stockTransfer.findFirst({
          where: { companyId, transferNumber: draftNumber },
        }),
      () =>
        prisma.stockTransfer.create({
          data: {
            companyId,
            transferNumber: draftNumber,
            fromWarehouseId: mainWh.id,
            toWarehouseId: secondWh.id,
            status: 'DRAFT',
            requestedById: opsUserId,
            notes: 'Seed draft transfer',
            items: {
              create: [
                {
                  itemId: items[0]!.id,
                  quantity: '5.000',
                },
              ],
            },
          },
        }),
    );
    summary.stockTransfers += 1;

    const doneNumber = 'TRF-SEED-002';
    await ensure(
      () =>
        prisma.stockTransfer.findFirst({
          where: { companyId, transferNumber: doneNumber },
        }),
      () =>
        prisma.stockTransfer.create({
          data: {
            companyId,
            transferNumber: doneNumber,
            fromWarehouseId: mainWh.id,
            toWarehouseId: secondWh.id,
            status: 'RECEIVED',
            requestedById: opsUserId,
            shippedAt: day(5),
            receivedAt: day(6),
            notes: 'Seed completed transfer',
            items: {
              create: [
                {
                  itemId: items[1]!.id,
                  quantity: '3.000',
                  quantityReceived: '3.000',
                },
              ],
            },
          },
        }),
    );
    summary.stockTransfers += 1;
  }

  // ── Stock adjustment (pending + approved) ────────────────────────
  if (mainWh && items[2]) {
    const pendingNo = 'ADJ-SEED-001';
    await ensure(
      () =>
        prisma.stockAdjustment.findFirst({
          where: { companyId, adjustmentNumber: pendingNo },
        }),
      () =>
        prisma.stockAdjustment.create({
          data: {
            companyId,
            warehouseId: mainWh.id,
            adjustmentNumber: pendingNo,
            reasonCode: 'DAMAGE',
            status: 'DRAFT',
            notes: 'Seed pending adjustment',
            requestedById: opsUserId,
            items: {
              create: [
                {
                  itemId: items[2]!.id,
                  quantityDelta: '-2.000',
                  unitCost: items[2]!.cost,
                },
              ],
            },
          },
        }),
    );
    summary.stockAdjustments += 1;

    const approvedNo = 'ADJ-SEED-002';
    await ensure(
      () =>
        prisma.stockAdjustment.findFirst({
          where: { companyId, adjustmentNumber: approvedNo },
        }),
      () =>
        prisma.stockAdjustment.create({
          data: {
            companyId,
            warehouseId: mainWh.id,
            adjustmentNumber: approvedNo,
            reasonCode: 'COUNT',
            status: 'APPROVED',
            notes: 'Seed approved adjustment',
            requestedById: opsUserId,
            approvedById: adminUserId,
            approvedAt: day(8),
            items: {
              create: [
                {
                  itemId: items[3]?.id ?? items[2]!.id,
                  quantityDelta: '1.000',
                  unitCost: (items[3] ?? items[2])!.cost,
                },
              ],
            },
          },
        }),
    );
    summary.stockAdjustments += 1;
  }

  // ── Label + invoice print templates ──────────────────────────────
  for (const tpl of [
    {
      code: 'STD_50x30',
      name: 'Standard 50×30',
      widthMm: 50,
      heightMm: 30,
      isDefault: true,
    },
    {
      code: 'SHELF_70x40',
      name: 'Shelf talker 70×40',
      widthMm: 70,
      heightMm: 40,
      isDefault: false,
    },
  ]) {
    await prisma.labelTemplate.upsert({
      where: { companyId_code: { companyId, code: tpl.code } },
      update: {
        name: tpl.name,
        widthMm: tpl.widthMm,
        heightMm: tpl.heightMm,
        isDefault: tpl.isDefault,
      },
      create: {
        companyId,
        code: tpl.code,
        name: tpl.name,
        widthMm: tpl.widthMm,
        heightMm: tpl.heightMm,
        isDefault: tpl.isDefault,
        industryKey: 'RETAIL',
        layoutJson: {
          fields: ['name', 'barcode', 'price'],
        },
      },
    });
    summary.labelTemplates += 1;
  }

  for (const tpl of [
    {
      code: 'ZATCA_A4',
      name: 'ZATCA A4 Simplified',
      layoutKind: 'A4_SIMPLIFIED',
      isDefault: true,
    },
    {
      code: 'POS_RECEIPT',
      name: 'POS thermal receipt',
      layoutKind: 'THERMAL_80',
      isDefault: false,
    },
  ]) {
    await prisma.invoicePrintTemplate.upsert({
      where: {
        companyId_code: { companyId, code: tpl.code },
      },
      update: {
        name: tpl.name,
        layoutKind: tpl.layoutKind,
        isDefault: tpl.isDefault,
      },
      create: {
        companyId,
        code: tpl.code,
        name: tpl.name,
        layoutKind: tpl.layoutKind,
        isDefault: tpl.isDefault,
        bodyHtml: '<div>{{sellerName}} — {{invoiceNumber}}</div>',
      },
    });
    summary.invoicePrintTemplates += 1;
  }

  // ── CRM: enrich contacts (B2B/B2C + birthdays) ───────────────────
  const contacts = await prisma.crmContact.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i]!;
    const isB2b = i >= 5;
    await prisma.crmContact.update({
      where: { id: c.id },
      data: {
        customerTrack: isB2b ? 'B2B' : 'B2C',
        taxNumber: isB2b ? `3${String(1000000000 + i).slice(0, 10)}` : null,
        companyRegNumber: isB2b ? `CR-${1000 + i}` : null,
        creditLimit: isB2b ? (50000 + i * 5000).toFixed(2) : '0',
        creditTermsDays: isB2b ? 30 : 0,
        dateOfBirth: day(200 + i * 37),
      },
    });
    summary.contactsEnriched += 1;
  }

  // ── Pricing: lists / coupons / bundles ───────────────────────────
  const retailList = await ensure(
    () =>
      prisma.priceList.findFirst({
        where: { companyId, name: 'Retail Standard' },
      }),
    () =>
      prisma.priceList.create({
        data: {
          companyId,
          name: 'Retail Standard',
          listType: 'RETAIL',
          currency: 'SAR',
          isDefault: true,
          isActive: true,
          notes: 'Seed retail price list',
        },
      }),
  );
  const wholesaleList = await ensure(
    () =>
      prisma.priceList.findFirst({
        where: { companyId, name: 'B2B Wholesale' },
      }),
    () =>
      prisma.priceList.create({
        data: {
          companyId,
          name: 'B2B Wholesale',
          listType: 'WHOLESALE',
          currency: 'SAR',
          isDefault: false,
          isActive: true,
        },
      }),
  );
  summary.priceLists = 2;

  for (let i = 0; i < Math.min(items.length, 5); i++) {
    const item = items[i]!;
    const retailPrice = Number(item.salePrice ?? 50);
    await ensure(
      () =>
        prisma.priceListEntry.findFirst({
          where: { priceListId: retailList.id, itemId: item.id },
        }),
      () =>
        prisma.priceListEntry.create({
          data: {
            priceListId: retailList.id,
            itemId: item.id,
            unitPrice: retailPrice.toFixed(2),
            floorPrice: (retailPrice * 0.85).toFixed(2),
          },
        }),
    );
    await ensure(
      () =>
        prisma.priceListEntry.findFirst({
          where: { priceListId: wholesaleList.id, itemId: item.id },
        }),
      () =>
        prisma.priceListEntry.create({
          data: {
            priceListId: wholesaleList.id,
            itemId: item.id,
            unitPrice: (retailPrice * 0.8).toFixed(2),
            minQty: '10.000',
            isVolumeBreak: true,
            floorPrice: (retailPrice * 0.7).toFixed(2),
          },
        }),
    );
  }

  const couponSpecs = [
    { code: 'WELCOME10', type: 'PERCENT', value: '10.00' },
    { code: 'SAVE25', type: 'FIXED', value: '25.00' },
  ] as const;
  for (const c of couponSpecs) {
    await ensure(
      () =>
        prisma.couponCode.findFirst({
          where: { companyId, codeKey: c.code },
        }),
      () =>
        prisma.couponCode.create({
          data: {
            companyId,
            code: c.code,
            codeKey: c.code,
            couponType: c.type,
            discountValue: c.value,
            maxUsages: 100,
            maxUsagePerContact: 2,
            minOrderAmount: '50.00',
            validFrom: day(0),
            validTo: day(180),
            isActive: true,
            createdByUserId: adminUserId,
            notes: 'Seed coupon',
          },
        }),
    );
    summary.coupons += 1;
  }

  if (items[0] && items[1]) {
    const bundle = await ensure(
      () =>
        prisma.productBundle.findFirst({
          where: { companyId, name: 'Starter Combo' },
        }),
      () =>
        prisma.productBundle.create({
          data: {
            companyId,
            name: 'Starter Combo',
            sku: 'BUNDLE-STARTER',
            bundlePrice: '99.00',
            isActive: true,
            items: {
              create: [
                { itemId: items[0]!.id, quantity: '1.000' },
                { itemId: items[1]!.id, quantity: '1.000' },
              ],
            },
          },
        }),
    );
    if (bundle) summary.bundles += 1;
  }

  // ── Loyalty + store credit ───────────────────────────────────────
  for (let i = 0; i < Math.min(contacts.length, 5); i++) {
    const contact = contacts[i]!;
    const account = await ensure(
      () =>
        prisma.loyaltyAccount.findUnique({
          where: { contactId: contact.id },
        }),
      () =>
        prisma.loyaltyAccount.create({
          data: {
            companyId,
            contactId: contact.id,
            pointsBalance: (100 + i * 25).toFixed(2),
            lifetimePoints: (200 + i * 40).toFixed(2),
            tierLevel: i === 0 ? 'GOLD' : 'STANDARD',
          },
        }),
    );
    await ensure(
      () =>
        prisma.loyaltyEvent.findFirst({
          where: {
            companyId,
            loyaltyAccountId: account.id,
            note: 'SEED_EARN',
          },
        }),
      () =>
        prisma.loyaltyEvent.create({
          data: {
            companyId,
            loyaltyAccountId: account.id,
            eventType: 'EARN',
            direction: 'EARN',
            points: '50.00',
            note: 'SEED_EARN',
            createdByUserId: adminUserId,
          },
        }),
    );
    summary.loyaltyAccounts += 1;

    const credit = await ensure(
      () =>
        prisma.customerStoreCredit.findUnique({
          where: { contactId: contact.id },
        }),
      () =>
        prisma.customerStoreCredit.create({
          data: {
            companyId,
            contactId: contact.id,
            balance: (50 + i * 10).toFixed(2),
            currency: 'SAR',
          },
        }),
    );
    await ensure(
      () =>
        prisma.storeCreditEvent.findFirst({
          where: {
            companyId,
            storeCreditId: credit.id,
            note: 'SEED_CREDIT',
          },
        }),
      () =>
        prisma.storeCreditEvent.create({
          data: {
            companyId,
            storeCreditId: credit.id,
            direction: 'CREDIT',
            amount: '50.00',
            note: 'SEED_CREDIT',
            createdByUserId: adminUserId,
          },
        }),
    );
    summary.storeCredits += 1;
  }

  // ── Support tickets ──────────────────────────────────────────────
  if (contacts[0]) {
    for (let i = 0; i < 3; i++) {
      const ticketNumber = `TKT-SEED-${String(i + 1).padStart(3, '0')}`;
      await ensure(
        () =>
          prisma.supportTicket.findFirst({
            where: { companyId, ticketNumber },
          }),
        () =>
          prisma.supportTicket.create({
            data: {
              companyId,
              contactId: contacts[i % contacts.length]!.id,
              ticketNumber,
              subject: `Seed support ticket ${i + 1}`,
              status: i === 0 ? 'OPEN' : i === 1 ? 'IN_PROGRESS' : 'RESOLVED',
              priority: i === 0 ? 'HIGH' : 'NORMAL',
              ticketKind: i === 2 ? 'WARRANTY' : 'SUPPORT',
              itemId: items[i]?.id,
              description: 'Demo ticket for QA',
              createdByUserId: adminUserId,
              assignedToId: opsUserId,
              resolvedAt: i === 2 ? day(12) : null,
            },
          }),
      );
      summary.supportTickets += 1;
    }
  }

  // ── Customer purchase orders ─────────────────────────────────────
  if (contacts[5] && items[0]) {
    const poNumber = 'CPO-SEED-001';
    await ensure(
      () =>
        prisma.customerPurchaseOrder.findFirst({
          where: { companyId, poNumber },
        }),
      () =>
        prisma.customerPurchaseOrder.create({
          data: {
            companyId,
            contactId: contacts[5]!.id,
            poNumber,
            status: 'APPROVED',
            issuedOn: day(10),
            currency: 'SAR',
            notes: 'Seed customer PO',
            items: {
              create: [
                {
                  itemId: items[0]!.id,
                  description: items[0]!.name,
                  quantity: '10.000',
                  unitPrice: Number(items[0]!.salePrice ?? 40).toFixed(2),
                  position: 1,
                },
              ],
            },
          },
        }),
    );
    summary.customerPos += 1;
  }

  // ── CRM ops settings (loyalty / POS / ZATCA placeholders) ────────
  const settingsRow = await prisma.companySettings.findUnique({
    where: { companyId },
  });
  const bag = {
    ...((settingsRow?.settings as Record<string, unknown> | null) ?? {}),
    loyalty: {
      b2cRatePct: 1,
      b2bRatePct: 0.5,
      birthdayBonus: 50,
      otpRequired: true,
    },
    pos: { maxDiscountPct: 5, overrideCode: '2468' },
    zatca: {
      sellerName: 'Demo Company LLC',
      vatNumber: '300000000000003',
    },
  };
  await prisma.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      taxNumber: '300000000000003',
      emailFromName: 'Demo Company LLC',
      settings: bag as object,
    },
    update: {
      taxNumber: '300000000000003',
      emailFromName: 'Demo Company LLC',
      settings: bag as object,
    },
  });

  // ── Governance: SoD + thresholds + industry catalog ──────────────
  const sodPairs: Array<[string, string, string]> = [
    ['inventory.write', 'inventory.approve', 'Requester ≠ approver (inventory)'],
    ['purchasing.write', 'finance.approve', 'PO creator ≠ payment approver'],
    ['sales.discount_override', 'finance.approve', 'Discount override vs finance approve'],
  ];
  for (const [a, b, label] of sodPairs) {
    await ensure(
      () =>
        prisma.sodConflictRule.findFirst({
          where: {
            companyId,
            permissionCodeA: a,
            permissionCodeB: b,
          },
        }),
      () =>
        prisma.sodConflictRule.create({
          data: {
            companyId,
            permissionCodeA: a,
            permissionCodeB: b,
            label,
            isActive: true,
          },
        }),
    );
    summary.sodRules += 1;
  }

  // Platform-default SoD (companyId null) — unique is nullable in MySQL
  await ensure(
    () =>
      prisma.sodConflictRule.findFirst({
        where: {
          companyId: null,
          permissionCodeA: 'finance.write',
          permissionCodeB: 'finance.approve',
        },
      }),
    () =>
      prisma.sodConflictRule.create({
        data: {
          companyId: null,
          permissionCodeA: 'finance.write',
          permissionCodeB: 'finance.approve',
          label: 'Platform default: writer ≠ approver',
          isActive: true,
        },
      }),
  );

  const thresholds: Array<{
    actionType:
      | 'PURCHASE_ORDER'
      | 'EXPENSE'
      | 'DISCOUNT'
      | 'SHIFT_VARIANCE'
      | 'PETTY_CASH';
    maxAmount: string;
    requiredPermission: string;
    escalatePermission?: string;
  }> = [
    {
      actionType: 'PURCHASE_ORDER',
      maxAmount: '5000.00',
      requiredPermission: 'purchasing.write',
      escalatePermission: 'finance.approve',
    },
    {
      actionType: 'EXPENSE',
      maxAmount: '1000.00',
      requiredPermission: 'finance.approve',
      escalatePermission: 'finance.period_lock',
    },
    {
      actionType: 'DISCOUNT',
      maxAmount: '200.00',
      requiredPermission: 'sales.discount_override',
      escalatePermission: 'finance.approve',
    },
    {
      actionType: 'SHIFT_VARIANCE',
      maxAmount: '150.00',
      requiredPermission: 'finance.approve',
    },
  ];
  for (const t of thresholds) {
    await ensure(
      () =>
        prisma.approvalThreshold.findFirst({
          where: {
            companyId,
            actionType: t.actionType,
            requiredPermission: t.requiredPermission,
          },
        }),
      () =>
        prisma.approvalThreshold.create({
          data: {
            companyId,
            actionType: t.actionType,
            maxAmount: t.maxAmount,
            currency: 'SAR',
            requiredPermission: t.requiredPermission,
            escalatePermission: t.escalatePermission,
            isActive: true,
          },
        }),
    );
    summary.approvalThresholds += 1;
  }

  const industries = [
    {
      code: 'RESTAURANT',
      nameEn: 'Restaurant / F&B',
      nameAr: 'مطاعم ومقاهي',
      sortOrder: 10,
    },
    {
      code: 'RETAIL',
      nameEn: 'Retail store',
      nameAr: 'تجزئة',
      sortOrder: 20,
    },
    {
      code: 'PHARMACY',
      nameEn: 'Pharmacy',
      nameAr: 'صيدلية',
      sortOrder: 30,
    },
  ] as const;
  for (const ind of industries) {
    await prisma.industryActivity.upsert({
      where: { code: ind.code },
      update: {
        nameEn: ind.nameEn,
        nameAr: ind.nameAr,
        isActive: true,
        sortOrder: ind.sortOrder,
      },
      create: {
        code: ind.code,
        nameEn: ind.nameEn,
        nameAr: ind.nameAr,
        isActive: true,
        sortOrder: ind.sortOrder,
        description: `Seed industry pack: ${ind.nameEn}`,
      },
    });
    summary.industryActivities += 1;
  }

  const restaurant = await prisma.industryActivity.findUnique({
    where: { code: 'RESTAURANT' },
  });
  if (restaurant) {
    await ensure(
      () =>
        prisma.companyIndustryActivation.findFirst({
          where: {
            companyId,
            industryActivityId: restaurant.id,
          },
        }),
      () =>
        prisma.companyIndustryActivation.create({
          data: {
            companyId,
            industryActivityId: restaurant.id,
            appliedByUserId: adminUserId,
          },
        }),
    );
  }

  return summary;
}
