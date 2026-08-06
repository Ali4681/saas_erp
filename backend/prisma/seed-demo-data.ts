import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client';

type Ctx = {
  prisma: PrismaClient;
  companyId: string;
  adminUserId: string;
};

const day = (offset: number) => {
  const d = new Date('2026-07-01T08:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/** AES-256-GCM blob matching EncryptionService (version + iv + tag + ciphertext). */
function encryptSeedPayload(plaintext: string): {
  ciphertext: Buffer;
  keyVersion: number;
} {
  const raw = process.env.ENCRYPTION_KEYS;
  if (!raw) {
    throw new Error('ENCRYPTION_KEYS is required for demo seed credentials');
  }
  const parsed = JSON.parse(raw) as Record<string, string>;
  const keyVersion = Number(
    process.env.ENCRYPTION_KEY_VERSION ??
      Math.max(...Object.keys(parsed).map(Number)),
  );
  const key = Buffer.from(parsed[String(keyVersion)]!, 'base64');
  if (key.length !== 32) {
    throw new Error(`ENCRYPTION_KEYS version ${keyVersion} must be 32 bytes`);
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const versionBuf = Buffer.alloc(2);
  versionBuf.writeUInt16BE(keyVersion, 0);
  return {
    ciphertext: Buffer.concat([versionBuf, iv, authTag, encrypted]),
    keyVersion,
  };
}

const DEMO_GRANTED_SCOPES = [
  'orders:read',
  'orders:write',
  'catalog:read',
  'catalog:write',
  'outlet:read',
  'outlet:write',
  'account:read',
  'promotions:read',
  'promotions:write',
  'orders.read',
  'orders.write',
  'products.read',
  'products.write',
  'inventory.read',
  'inventory.write',
  'locations.read',
  'customers.read',
  'discounts.read',
  'discounts.write',
  'shipping.read',
  'shipping.write',
  'carts.write',
  'basic',
  'store',
  'menu',
  'order',
  'read',
  'write',
  'read_orders',
  'write_orders',
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_customers',
  'read_discounts',
  'write_discounts',
  'read_fulfillments',
  'write_fulfillments',
  'checkout:write',
  'payments:read',
  'payments:write',
  'disputes:read',
  'disputes:write',
  'checkout',
];

async function ensure<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await find();
  return existing ?? create();
}

/**
 * Idempotent demo dataset for the demo company (~8–10 rows per core table).
 */
export async function seedDemoCompanyData(ctx: Ctx) {
  const { prisma, companyId, adminUserId } = ctx;
  const summary: Record<string, number> = {};

  // ── Users + memberships ──────────────────────────────────────────
  const passwordHash = (
    await prisma.user.findUniqueOrThrow({ where: { id: adminUserId } })
  ).passwordHash;

  const demoUsersSpec = [
    {
      email: 'owner@demo-co.local',
      fullName: 'Sara Alotaibi',
      role: 'COMPANY_OWNER',
    },
    {
      email: 'admin@demo-co.local',
      fullName: 'Omar Alharbi',
      role: 'COMPANY_ADMIN',
    },
    {
      email: 'accountant@demo-co.local',
      fullName: 'Noura Alqahtani',
      role: 'ACCOUNTANT',
    },
    {
      email: 'ops@demo-co.local',
      fullName: 'Faisal Aldosari',
      role: 'OPERATIONS_MANAGER',
    },
    {
      email: 'viewer@demo-co.local',
      fullName: 'Lina Alghamdi',
      role: 'EMPLOYEE_VIEWER',
    },
    {
      email: 'sales@demo-co.local',
      fullName: 'Khalid Almanea',
      role: 'COMPANY_ADMIN',
    },
    {
      email: 'hr@demo-co.local',
      fullName: 'Maha Alshehri',
      role: 'OPERATIONS_MANAGER',
    },
    {
      email: 'warehouse@demo-co.local',
      fullName: 'Yousef Almutairi',
      role: 'OPERATIONS_MANAGER',
    },
    {
      email: 'support@demo-co.local',
      fullName: 'Huda Alzahrani',
      role: 'EMPLOYEE_VIEWER',
    },
    {
      email: 'finance@demo-co.local',
      fullName: 'Turki Alenezi',
      role: 'ACCOUNTANT',
    },
  ] as const;

  const users: Array<{ id: string; email: string; companyUserId: string }> = [];
  for (const spec of demoUsersSpec) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: spec.role } });
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        fullName: spec.fullName,
        passwordHash,
        status: 'ACTIVE',
        isPlatformAdmin: false,
      },
      create: {
        email: spec.email,
        fullName: spec.fullName,
        passwordHash,
        status: 'ACTIVE',
        isPlatformAdmin: false,
      },
    });
    const membership = await prisma.companyUser.upsert({
      where: { companyId_userId: { companyId, userId: user.id } },
      update: { roleId: role.id, status: 'ACTIVE' },
      create: {
        companyId,
        userId: user.id,
        roleId: role.id,
        status: 'ACTIVE',
      },
    });
    users.push({ id: user.id, email: spec.email, companyUserId: membership.id });
  }
  summary.users = users.length;

  const ownerUserId = users[0]!.id;
  const opsUserId = users[3]!.id;
  const accountantUserId = users[2]!.id;

  // ── Branches + departments ───────────────────────────────────────
  const branchSpecs = [
    { code: 'HQ', name: 'Head Office', city: 'Riyadh' },
    { code: 'JED', name: 'Jeddah Branch', city: 'Jeddah' },
    { code: 'DMM', name: 'Dammam Branch', city: 'Dammam' },
    { code: 'MED', name: 'Madinah Branch', city: 'Madinah' },
    { code: 'KHF', name: 'Khobar Branch', city: 'Khobar' },
    { code: 'TAB', name: 'Tabuk Branch', city: 'Tabuk' },
    { code: 'ABH', name: 'Abha Branch', city: 'Abha' },
    { code: 'QAS', name: 'Qassim Branch', city: 'Buraidah' },
    { code: 'YNB', name: 'Yanbu Branch', city: 'Yanbu' },
    { code: 'JIZ', name: 'Jizan Branch', city: 'Jizan' },
  ];
  const branches = [];
  for (const b of branchSpecs) {
    branches.push(
      await ensure(
        () =>
          prisma.companyBranch.findFirst({
            where: { companyId, code: b.code, deletedMarker: '' },
          }),
        () =>
          prisma.companyBranch.create({
            data: {
              companyId,
              code: b.code,
              name: b.name,
              city: b.city,
              phone: `+96611${String(branches.length + 1000000).slice(0, 7)}`,
              addressLine: `${b.name}, Saudi Arabia`,
            },
          }),
      ),
    );
  }
  summary.branches = branches.length;

  const deptNames = [
    'Sales',
    'Finance',
    'Operations',
    'HR',
    'Warehouse',
    'Marketing',
    'Customer Success',
    'IT',
    'Procurement',
    'Quality',
  ];
  const departments = [];
  for (let i = 0; i < deptNames.length; i++) {
    const code = `D${String(i + 1).padStart(2, '0')}`;
    departments.push(
      await ensure(
        () => prisma.companyDepartment.findFirst({ where: { companyId, code } }),
        () =>
          prisma.companyDepartment.create({
            data: {
              companyId,
              branchId: branches[i % branches.length]!.id,
              code,
              name: deptNames[i]!,
            },
          }),
      ),
    );
  }
  summary.departments = departments.length;

  // ── Company settings polish ──────────────────────────────────────
  await prisma.companySettings.upsert({
    where: { companyId },
    update: {
      taxNumber: '300000000000003',
      invoicePrefix: 'INV',
      nextInvoiceNumber: 100n,
      defaultTaxRate: '15.00',
      emailFromName: 'Demo Co Billing',
      emailFromAddress: 'billing@demo-co.local',
      settings: { seedVersion: 'v2-full', locale: 'ar-SA' },
    },
    create: {
      companyId,
      taxNumber: '300000000000003',
      invoicePrefix: 'INV',
      nextInvoiceNumber: 100n,
      defaultTaxRate: '15.00',
      emailFromName: 'Demo Co Billing',
      emailFromAddress: 'billing@demo-co.local',
      settings: { seedVersion: 'v2-full', locale: 'ar-SA' },
    },
  });

  // ── Billing history ──────────────────────────────────────────────
  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { companyId, status: { in: ['ACTIVE', 'TRIALING'] } },
  });
  const invoices = [];
  for (let i = 1; i <= 10; i++) {
    const invoiceNumber = `SUB-INV-2026-${String(i).padStart(3, '0')}`;
    const issuedAt = day(i * 28 - 280);
    const dueAt = day(i * 28 - 270);
    const inv = await ensure(
      () => prisma.subscriptionInvoice.findUnique({ where: { invoiceNumber } }),
      () =>
        prisma.subscriptionInvoice.create({
          data: {
            subscriptionId: subscription.id,
            invoiceNumber,
            status: i <= 8 ? 'PAID' : i === 9 ? 'ISSUED' : 'DRAFT',
            issuedAt,
            dueAt,
            subtotal: '249.00',
            taxAmount: '37.35',
            totalAmount: '286.35',
            currency: 'USD',
          },
        }),
    );
    invoices.push(inv);
    if (i <= 8) {
      await ensure(
        () =>
          prisma.subscriptionPayment.findFirst({
            where: {
              subscriptionInvoiceId: inv.id,
              provider: 'MANUAL',
              externalPaymentId: `pay-sub-${i}`,
            },
          }),
        () =>
          prisma.subscriptionPayment.create({
            data: {
              subscriptionInvoiceId: inv.id,
              provider: 'MANUAL',
              externalPaymentId: `pay-sub-${i}`,
              amount: '286.35',
              currency: 'USD',
              status: 'SUCCEEDED',
              paidAt: dueAt,
            },
          }),
      );
    }
  }
  summary.subscriptionInvoices = invoices.length;

  // ── Expense categories (expand to 10) ────────────────────────────
  const expenseCats = [
    ['OPS', 'Operations'],
    ['MKT', 'Marketing'],
    ['RENT', 'Rent & Utilities'],
    ['SAL', 'Salaries'],
    ['MISC', 'Miscellaneous'],
    ['TRAVEL', 'Travel'],
    ['SOFT', 'Software'],
    ['LOG', 'Logistics'],
    ['MAINT', 'Maintenance'],
    ['TRAIN', 'Training'],
  ] as const;
  const expenseCategoryIds: string[] = [];
  for (const [code, name] of expenseCats) {
    const row = await ensure(
      () =>
        prisma.expenseCategory.findFirst({
          where: { companyId, codeKey: code },
        }),
      () =>
        prisma.expenseCategory.create({
          data: { companyId, code, codeKey: code, name },
        }),
    );
    expenseCategoryIds.push(row.id);
  }
  summary.expenseCategories = expenseCategoryIds.length;

  // ── Bank accounts ────────────────────────────────────────────────
  const bankSpecs = [
    { name: 'Petty Cash', accountType: 'CASH' as const },
    { name: 'AlRajhi Operating', accountType: 'BANK' as const, last4: '4821' },
    { name: 'SNB Payroll', accountType: 'BANK' as const, last4: '1190' },
    { name: 'Riyad Bank AP', accountType: 'BANK' as const, last4: '7733' },
    { name: 'STC Pay Wallet', accountType: 'PAYMENT_GATEWAY' as const },
    { name: 'Mada Gateway', accountType: 'PAYMENT_GATEWAY' as const },
    { name: 'Tabby Settlements', accountType: 'PAYMENT_GATEWAY' as const },
    { name: 'Cash Register HQ', accountType: 'CASH' as const },
    { name: 'Alinma Savings', accountType: 'BANK' as const, last4: '2208' },
    { name: 'HyperPay Gateway', accountType: 'PAYMENT_GATEWAY' as const },
  ];
  const bankAccounts = [];
  for (const spec of bankSpecs) {
    bankAccounts.push(
      await ensure(
        () =>
          prisma.bankAccount.findFirst({
            where: { companyId, name: spec.name },
          }),
        () =>
          prisma.bankAccount.create({
            data: {
              companyId,
              name: spec.name,
              accountType: spec.accountType,
              bankName: spec.accountType === 'BANK' ? spec.name : null,
              ibanLast4: 'last4' in spec ? spec.last4 : null,
              currency: 'SAR',
            },
          }),
      ),
    );
  }
  summary.bankAccounts = bankAccounts.length;

  // ── Payment gateways (Stripe / PayPal) ───────────────────────────
  const stripe = await prisma.paymentGateway.findUniqueOrThrow({
    where: { code: 'STRIPE' },
  });
  const paypal = await prisma.paymentGateway.findUniqueOrThrow({
    where: { code: 'PAYPAL' },
  });
  for (const [gateway, name, credentials] of [
    [
      stripe,
      'Stripe Sandbox',
      { secretKey: 'sk_test_demo_seed', publishableKey: 'pk_test_demo_seed' },
    ],
    [
      paypal,
      'PayPal Sandbox',
      { clientId: 'paypal_client_demo', clientSecret: 'paypal_secret_demo' },
    ],
  ] as const) {
    await ensure(
      () =>
        prisma.companyPaymentMethod.findFirst({
          where: {
            companyId,
            paymentGatewayId: gateway.id,
            name,
          },
        }),
      () =>
        prisma.companyPaymentMethod.create({
          data: {
            companyId,
            paymentGatewayId: gateway.id,
            name,
            status: 'ACTIVE',
            config: { mode: 'sandbox' },
            credentialsCiphertext: Buffer.from(JSON.stringify(credentials)),
            keyVersion: 1,
            createdById: adminUserId,
          },
        }),
    );
  }
  summary.paymentMethods = 2;

  // ── Units + warehouses + categories + items ──────────────────────
  const unitSpecs = [
    ['PCS', 'Pieces', 0],
    ['KG', 'Kilogram', 3],
    ['M', 'Meter', 2],
    ['BOX', 'Box', 0],
    ['L', 'Liter', 3],
    ['SET', 'Set', 0],
    ['PACK', 'Pack', 0],
    ['HR', 'Hour', 2],
    ['DAY', 'Day', 0],
    ['CASE', 'Case', 0],
  ] as const;
  const units = [];
  for (const [code, name, decimalPlaces] of unitSpecs) {
    units.push(
      await ensure(
        () => prisma.unit.findFirst({ where: { companyId, code } }),
        () =>
          prisma.unit.create({
            data: { companyId, code, name, decimalPlaces },
          }),
      ),
    );
  }

  const warehouseSpecs = [
    ['MAIN', 'Main Warehouse'],
    ['JED-WH', 'Jeddah Warehouse'],
    ['DMM-WH', 'Dammam Warehouse'],
    ['COLD', 'Cold Storage'],
    ['SPARE', 'Spare Parts'],
    ['RET', 'Returns Bay'],
    ['STG', 'Staging Area'],
    ['QC', 'QC Hold'],
    ['ECOM', 'E-commerce Fulfillment'],
    ['TRN', 'Transit Buffer'],
  ] as const;
  const warehouses = [];
  for (let i = 0; i < warehouseSpecs.length; i++) {
    const [code, name] = warehouseSpecs[i]!;
    warehouses.push(
      await ensure(
        () => prisma.warehouse.findFirst({ where: { companyId, code } }),
        () =>
          prisma.warehouse.create({
            data: {
              companyId,
              companyBranchId: branches[i % branches.length]!.id,
              code,
              name,
              addressLine: `${name}, Saudi Arabia`,
            },
          }),
      ),
    );
  }
  summary.warehouses = warehouses.length;
  const mainWh = warehouses.find((w) => w.code === 'MAIN') ?? warehouses[0]!;

  const itemCatSpecs = [
    ['FOOD', 'Food'],
    ['BEV', 'Beverages'],
    ['PKG', 'Packaging'],
    ['EQUIP', 'Equipment'],
    ['CLEAN', 'Cleaning'],
    ['RAW', 'Raw Materials'],
    ['MERCH', 'Merchandise'],
    ['SVC', 'Services'],
    ['SPARE', 'Spare Parts'],
    ['OTHER', 'Other'],
  ] as const;
  const itemCategories = [];
  for (const [code, name] of itemCatSpecs) {
    itemCategories.push(
      await ensure(
        () =>
          prisma.itemCategory.findFirst({
            where: { companyId, codeKey: code },
          }),
        () =>
          prisma.itemCategory.create({
            data: { companyId, code, codeKey: code, name },
          }),
      ),
    );
  }

  const itemNames = [
    'Chicken Shawarma Kit',
    'Arabic Coffee Beans 1kg',
    'Paper Bags Large',
    'POS Terminal Stand',
    'Disinfectant 5L',
    'Basmati Rice 10kg',
    'Branded Cap',
    'Delivery Fee Service',
    'Fryer Basket',
    'Gift Card Sleeve',
  ];
  const items = [];
  for (let i = 0; i < 10; i++) {
    const sku = `SKU-${String(i + 1).padStart(3, '0')}`;
    items.push(
      await ensure(
        () => prisma.item.findFirst({ where: { companyId, skuKey: sku } }),
        () =>
          prisma.item.create({
            data: {
              companyId,
              itemCategoryId: itemCategories[i]!.id,
              unitId: units[i % units.length]!.id,
              sku,
              skuKey: sku,
              barcode: `62800000000${i}`,
              barcodeKey: `62800000000${i}`,
              name: itemNames[i]!,
              cost: (20 + i * 7).toFixed(2),
              salePrice: (45 + i * 12).toFixed(2),
              minStock: '5.000',
              taxRate: '15.00',
            },
          }),
      ),
    );
  }
  summary.items = items.length;

  for (let i = 0; i < items.length; i++) {
    const qty = (50 + i * 8).toFixed(3);
    await prisma.stockBalance.upsert({
      where: {
        warehouseId_itemId: {
          warehouseId: mainWh.id,
          itemId: items[i]!.id,
        },
      },
      update: { quantityOnHand: qty },
      create: {
        warehouseId: mainWh.id,
        itemId: items[i]!.id,
        quantityOnHand: qty,
        quantityReserved: '0.000',
      },
    });
    await ensure(
      () =>
        prisma.stockMovement.findFirst({
          where: {
            companyId,
            warehouseId: mainWh.id,
            itemId: items[i]!.id,
            movementType: 'OPENING',
            referenceType: 'SEED',
          },
        }),
      () =>
        prisma.stockMovement.create({
          data: {
            companyId,
            warehouseId: mainWh.id,
            itemId: items[i]!.id,
            movementType: 'OPENING',
            quantity: qty,
            unitCost: items[i]!.cost,
            referenceType: 'SEED',
            occurredAt: day(i),
            createdById: adminUserId,
            notes: 'Opening balance from seed',
          },
        }),
    );
  }

  const stockCount = await ensure(
    () =>
      prisma.stockCount.findFirst({
        where: { companyId, countNumber: 'SC-2026-001' },
      }),
    () =>
      prisma.stockCount.create({
        data: {
          companyId,
          warehouseId: mainWh.id,
          countNumber: 'SC-2026-001',
          status: 'APPROVED',
          startedAt: day(10),
          completedAt: day(11),
          createdById: opsUserId,
          approvedById: adminUserId,
        },
      }),
  );
  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.stockCountItem.findFirst({
          where: { stockCountId: stockCount.id, itemId: items[i]!.id },
        }),
      () =>
        prisma.stockCountItem.create({
          data: {
            stockCountId: stockCount.id,
            itemId: items[i]!.id,
            systemQuantity: (50 + i * 8).toFixed(3),
            countedQuantity: (50 + i * 8).toFixed(3),
            varianceQuantity: '0.000',
          },
        }),
    );
  }

  // Open count on secondary warehouse (MAIN stays free for POST /counts)
  const openWh =
    warehouses.find((w) => w.code === 'JED-WH') ?? warehouses[1] ?? mainWh;
  const openStockCount = await ensure(
    () =>
      prisma.stockCount.findFirst({
        where: { companyId, countNumber: 'SC-AUDIT-OPEN' },
      }),
    () =>
      prisma.stockCount.create({
        data: {
          companyId,
          warehouseId: openWh.id,
          countNumber: 'SC-AUDIT-OPEN',
          status: 'IN_PROGRESS',
          openWarehouseId: openWh.id,
          startedAt: new Date(),
          createdById: opsUserId,
        },
      }),
  );
  // Keep open if a prior run closed it
  if (openStockCount.status !== 'IN_PROGRESS') {
    await prisma.stockCount.update({
      where: { id: openStockCount.id },
      data: {
        status: 'IN_PROGRESS',
        openWarehouseId: openWh.id,
        completedAt: null,
        approvedById: null,
        startedAt: new Date(),
      },
    });
  }
  for (let i = 0; i < items.length; i++) {
    await ensure(
      () =>
        prisma.stockCountItem.findFirst({
          where: { stockCountId: openStockCount.id, itemId: items[i]!.id },
        }),
      () =>
        prisma.stockCountItem.create({
          data: {
            stockCountId: openStockCount.id,
            itemId: items[i]!.id,
            systemQuantity: (20 + i * 2).toFixed(3),
            countedQuantity: null,
            varianceQuantity: null,
          },
        }),
    );
  }
  summary.openStockCounts = 1;

  // ── CRM ──────────────────────────────────────────────────────────
  let pipeline = await prisma.crmPipeline.findFirst({
    where: { companyId, isDefault: true },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
  if (!pipeline) {
    pipeline = await prisma.crmPipeline.create({
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
            { name: 'Negotiation', position: 4, probability: 80 },
            { name: 'Won', position: 5, probability: 100, isClosed: true },
            { name: 'Lost', position: 6, probability: 0, isClosed: true },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }
  // Ensure we have enough stages
  while (pipeline.stages.length < 5) {
    const pos = pipeline.stages.length + 1;
    const stage = await prisma.crmPipelineStage.create({
      data: {
        pipelineId: pipeline.id,
        name: `Stage ${pos}`,
        position: pos,
        probability: Math.min(pos * 15, 100),
      },
    });
    pipeline.stages.push(stage);
  }

  const contactNames = [
    ['LEAD', 'Ahmed Buyer', 'Nova Retail'],
    ['LEAD', 'Reem Prospect', 'Gulf Cafe'],
    ['LEAD', 'Sami Inquiry', 'Desert Grill'],
    ['LEAD', 'Hala Lead', 'Oasis Market'],
    ['LEAD', 'Majed Lead', 'City Kitchen'],
    ['CUSTOMER', 'Fatimah Client', 'Riyadh Foods'],
    ['CUSTOMER', 'Yasser Client', 'Red Sea Catering'],
    ['CUSTOMER', 'Nouf Client', 'Najd Hospitality'],
    ['CUSTOMER', 'Bader Client', 'Eastern Meals'],
    ['CUSTOMER', 'Lama Client', 'Capital Dining'],
  ] as const;
  const contacts = [];
  for (let i = 0; i < contactNames.length; i++) {
    const [contactType, name, companyName] = contactNames[i]!;
    const email = `crm-${String(i + 1).padStart(2, '0')}@demo.local`;
    contacts.push(
      await ensure(
        () => prisma.crmContact.findFirst({ where: { companyId, email } }),
        () =>
          prisma.crmContact.create({
            data: {
              companyId,
              contactType,
              name,
              companyName,
              email,
              phone: `+9665${String(100000000 + i).slice(0, 8)}`,
              source: i % 2 === 0 ? 'Website' : 'Referral',
              ownerUserId: users[i % users.length]!.id,
              notes: `Seed contact ${i + 1}`,
            },
          }),
      ),
    );
  }
  summary.crmContacts = contacts.length;

  const opportunities = [];
  for (let i = 0; i < 10; i++) {
    const title = `Opportunity ${String(i + 1).padStart(2, '0')}`;
    const stage = pipeline.stages[Math.min(i % pipeline.stages.length, pipeline.stages.length - 1)]!;
    opportunities.push(
      await ensure(
        () => prisma.crmOpportunity.findFirst({ where: { companyId, title } }),
        () =>
          prisma.crmOpportunity.create({
            data: {
              companyId,
              contactId: contacts[i]!.id,
              pipelineId: pipeline!.id,
              stageId: stage.id,
              ownerUserId: ownerUserId,
              title,
              estimatedValue: (15000 + i * 3500).toFixed(2),
              currency: 'SAR',
              expectedCloseDate: day(30 + i * 7),
              status: i >= 8 ? 'WON' : i === 7 ? 'LOST' : 'OPEN',
            },
          }),
      ),
    );
  }
  summary.crmOpportunities = opportunities.length;

  const activityTypes = [
    'CALL',
    'MEETING',
    'FOLLOW_UP',
    'TASK',
    'EMAIL',
    'NOTE',
    'CALL',
    'MEETING',
    'FOLLOW_UP',
    'EMAIL',
  ] as const;
  for (let i = 0; i < 10; i++) {
    const subject = `Activity ${String(i + 1).padStart(2, '0')}`;
    await ensure(
      () => prisma.crmActivity.findFirst({ where: { companyId, subject } }),
      () =>
        prisma.crmActivity.create({
          data: {
            companyId,
            contactId: contacts[i]!.id,
            opportunityId: opportunities[i]!.id,
            activityType: activityTypes[i]!,
            subject,
            notes: 'Seeded CRM activity',
            scheduledAt: day(5 + i),
            status: i < 4 ? 'COMPLETED' : 'PLANNED',
            assignedToId: users[i % users.length]!.id,
            createdById: adminUserId,
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    const contractNumber = `CTR-2026-${String(i + 1).padStart(3, '0')}`;
    await ensure(
      () =>
        prisma.crmContract.findFirst({
          where: { companyId, contractNumber },
        }),
      () =>
        prisma.crmContract.create({
          data: {
            companyId,
            contactId: contacts[i]!.id,
            opportunityId: opportunities[i]!.id,
            contractNumber,
            title: `Service Contract ${i + 1}`,
            status: i < 6 ? 'ACTIVE' : i < 8 ? 'DRAFT' : 'EXPIRED',
            startsOn: day(i),
            endsOn: day(365 + i),
            value: (25000 + i * 5000).toFixed(2),
            currency: 'SAR',
          },
        }),
    );
  }

  // ── Sales ────────────────────────────────────────────────────────
  const quotes = [];
  for (let i = 0; i < 10; i++) {
    const quoteNumber = `Q-2026-${String(i + 1).padStart(3, '0')}`;
    const unitPrice = 100 + i * 25;
    const qty = 2 + (i % 3);
    const lineTotal = unitPrice * qty;
    const tax = +(lineTotal * 0.15).toFixed(2);
    const total = +(lineTotal + tax).toFixed(2);
    quotes.push(
      await ensure(
        () =>
          prisma.salesQuote.findFirst({ where: { companyId, quoteNumber } }),
        () =>
          prisma.salesQuote.create({
            data: {
              companyId,
              contactId: contacts[i]!.id,
              quoteNumber,
              status: i < 7 ? 'ACCEPTED' : i < 9 ? 'SENT' : 'DRAFT',
              issuedOn: day(i + 2),
              expiresOn: day(i + 32),
              currency: 'SAR',
              subtotal: lineTotal.toFixed(2),
              taxAmount: tax.toFixed(2),
              totalAmount: total.toFixed(2),
              createdById: adminUserId,
              items: {
                create: [
                  {
                    itemId: items[i]!.id,
                    description: items[i]!.name,
                    quantity: qty.toFixed(3),
                    unitPrice: unitPrice.toFixed(2),
                    taxAmount: tax.toFixed(2),
                    totalAmount: total.toFixed(2),
                    position: 1,
                  },
                ],
              },
            },
          }),
      ),
    );
  }
  summary.salesQuotes = quotes.length;

  const invoicesSales = [];
  for (let i = 0; i < 10; i++) {
    const invoiceNumber = `INV-2026-${String(i + 1).padStart(3, '0')}`;
    const unitPrice = 120 + i * 20;
    const qty = 1 + (i % 4);
    const lineTotal = unitPrice * qty;
    const tax = +(lineTotal * 0.15).toFixed(2);
    const total = +(lineTotal + tax).toFixed(2);
    const paid = i < 6;
    const partial = i === 6;
    const balance = paid ? 0 : partial ? +(total / 2).toFixed(2) : total;
    invoicesSales.push(
      await ensure(
        () =>
          prisma.salesInvoice.findFirst({
            where: { companyId, invoiceNumber },
          }),
        () =>
          prisma.salesInvoice.create({
            data: {
              companyId,
              contactId: contacts[i]!.id,
              salesQuoteId: quotes[i]!.id,
              companyBranchId: branches[i % branches.length]!.id,
              createdById: users[i % users.length]!.id,
              invoiceNumber,
              status: paid
                ? 'PAID'
                : partial
                  ? 'PARTIALLY_PAID'
                  : i === 9
                    ? 'DRAFT'
                    : 'ISSUED',
              issuedOn: day(i + 5),
              dueOn: day(i + 20),
              currency: 'SAR',
              subtotal: lineTotal.toFixed(2),
              taxAmount: tax.toFixed(2),
              totalAmount: total.toFixed(2),
              balanceDue: balance.toFixed(2),
              items: {
                create: [
                  {
                    itemId: items[i]!.id,
                    description: items[i]!.name,
                    quantity: qty.toFixed(3),
                    unitPrice: unitPrice.toFixed(2),
                    taxAmount: tax.toFixed(2),
                    totalAmount: total.toFixed(2),
                    position: 1,
                  },
                ],
              },
            },
          }),
      ),
    );
  }
  // Backfill BI attribution on older seed invoices
  for (let i = 0; i < invoicesSales.length; i++) {
    const inv = invoicesSales[i]!;
    if (!inv.companyBranchId || !inv.createdById) {
      invoicesSales[i] = await prisma.salesInvoice.update({
        where: { id: inv.id },
        data: {
          companyBranchId: inv.companyBranchId ?? branches[i % branches.length]!.id,
          createdById: inv.createdById ?? users[i % users.length]!.id,
        },
      });
    }
  }
  summary.salesInvoices = invoicesSales.length;

  for (let i = 0; i < 10; i++) {
    if (i >= 8) continue;
    const receiptNumber = `RCP-2026-${String(i + 1).padStart(3, '0')}`;
    const inv = invoicesSales[i]!;
    const amount =
      i === 6
        ? (+inv.totalAmount.toString() / 2).toFixed(2)
        : inv.totalAmount.toString();
    await ensure(
      () =>
        prisma.salesPayment.findFirst({
          where: { companyId, receiptNumber },
        }),
      () =>
        prisma.salesPayment.create({
          data: {
            companyId,
            salesInvoiceId: inv.id,
            bankAccountId: bankAccounts[1]!.id,
            receiptNumber,
            method: i % 2 === 0 ? 'BANK_TRANSFER' : 'CARD',
            amount,
            currency: 'SAR',
            status: 'SUCCEEDED',
            paidAt: day(i + 8),
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    const creditNoteNumber = `CN-2026-${String(i + 1).padStart(3, '0')}`;
    await ensure(
      () =>
        prisma.salesCreditNote.findFirst({
          where: { companyId, creditNoteNumber },
        }),
      () =>
        prisma.salesCreditNote.create({
          data: {
            companyId,
            salesInvoiceId: invoicesSales[i]!.id,
            creditNoteNumber,
            status: i < 5 ? 'CLOSED' : 'DRAFT',
            issuedOn: day(i + 12),
            totalAmount: (50 + i * 10).toFixed(2),
            currency: 'SAR',
            items: {
              create: [
                {
                  description: `Credit for ${items[i]!.name}`,
                  quantity: '1.000',
                  amount: (50 + i * 10).toFixed(2),
                },
              ],
            },
          },
        }),
    );
  }

  // ── Purchasing ───────────────────────────────────────────────────
  const suppliers = [];
  for (let i = 1; i <= 10; i++) {
    const code = `SUP-${String(i).padStart(2, '0')}`;
    suppliers.push(
      await ensure(
        () =>
          prisma.supplier.findFirst({ where: { companyId, codeKey: code } }),
        () =>
          prisma.supplier.create({
            data: {
              companyId,
              code,
              codeKey: code,
              name: `Supplier ${i} Trading`,
              taxNumber: `3${String(i).padStart(14, '0')}`,
              email: `supplier${i}@vendors.local`,
              phone: `+96612${String(2000000 + i)}`,
              notes: 'Preferred vendor from seed',
            },
          }),
      ),
    );
  }
  summary.suppliers = suppliers.length;

  const purchaseOrders = [];
  for (let i = 0; i < 10; i++) {
    const orderNumber = `PO-2026-${String(i + 1).padStart(3, '0')}`;
    const unitCost = 30 + i * 5;
    const qty = 10 + i;
    const lineTotal = unitCost * qty;
    const tax = +(lineTotal * 0.15).toFixed(2);
    const total = +(lineTotal + tax).toFixed(2);
    purchaseOrders.push(
      await ensure(
        () =>
          prisma.purchaseOrder.findFirst({
            where: { companyId, orderNumber },
          }),
        () =>
          prisma.purchaseOrder.create({
            data: {
              companyId,
              supplierId: suppliers[i]!.id,
              warehouseId: mainWh.id,
              orderNumber,
              status: i < 6 ? 'RECEIVED' : i < 8 ? 'ORDERED' : 'DRAFT',
              orderedOn: day(i + 3),
              expectedOn: day(i + 10),
              currency: 'SAR',
              subtotal: lineTotal.toFixed(2),
              taxAmount: tax.toFixed(2),
              totalAmount: total.toFixed(2),
              requestedById: opsUserId,
              approvedById: adminUserId,
              items: {
                create: [
                  {
                    itemId: items[i]!.id,
                    description: items[i]!.name,
                    quantity: qty.toFixed(3),
                    unitCost: unitCost.toFixed(2),
                    taxAmount: tax.toFixed(2),
                    totalAmount: total.toFixed(2),
                    position: 1,
                  },
                ],
              },
            },
          }),
      ),
    );
  }

  const bills = [];
  for (let i = 0; i < 10; i++) {
    const billNumber = `BILL-2026-${String(i + 1).padStart(3, '0')}`;
    const unitCost = 35 + i * 4;
    const qty = 8 + i;
    const lineTotal = unitCost * qty;
    const tax = +(lineTotal * 0.15).toFixed(2);
    const total = +(lineTotal + tax).toFixed(2);
    const paid = i < 5;
    // Prefer ISSUED over DRAFT so payment APIs have payable bills
    const status = paid ? 'PAID' : 'ISSUED';
    bills.push(
      await ensure(
        () =>
          prisma.supplierBill.findFirst({
            where: { companyId, supplierId: suppliers[i]!.id, billNumber },
          }),
        () =>
          prisma.supplierBill.create({
            data: {
              companyId,
              supplierId: suppliers[i]!.id,
              purchaseOrderId: purchaseOrders[i]!.id,
              billNumber,
              status,
              issuedOn: day(i + 6),
              dueOn: day(i + 21),
              currency: 'SAR',
              subtotal: lineTotal.toFixed(2),
              taxAmount: tax.toFixed(2),
              totalAmount: total.toFixed(2),
              balanceDue: paid ? '0.00' : total.toFixed(2),
              items: {
                create: [
                  {
                    itemId: items[i]!.id,
                    description: items[i]!.name,
                    quantity: qty.toFixed(3),
                    unitCost: unitCost.toFixed(2),
                    taxAmount: tax.toFixed(2),
                    totalAmount: total.toFixed(2),
                    position: 1,
                  },
                ],
              },
            },
          }),
      ),
    );
  }

  // Newest payable bill so list harvest prefers it over Postman DRAFT samples
  const payableBill = await ensure(
    () =>
      prisma.supplierBill.findFirst({
        where: { companyId, billNumber: 'BILL-AUDIT-PAYABLE' },
      }),
    () =>
      prisma.supplierBill.create({
        data: {
          companyId,
          supplierId: suppliers[0]!.id,
          billNumber: 'BILL-AUDIT-PAYABLE',
          status: 'ISSUED',
          issuedOn: new Date(),
          dueOn: day(40),
          currency: 'SAR',
          subtotal: '200.00',
          taxAmount: '30.00',
          totalAmount: '230.00',
          balanceDue: '230.00',
          items: {
            create: [
              {
                itemId: items[0]!.id,
                description: 'Audit payable line',
                quantity: '1.000',
                unitCost: '200.00',
                taxAmount: '30.00',
                totalAmount: '230.00',
                position: 1,
              },
            ],
          },
        },
      }),
  );
  if (
    payableBill.status === 'DRAFT' ||
    payableBill.status === 'CANCELLED' ||
    Number(payableBill.balanceDue) <= 0
  ) {
    await prisma.supplierBill.update({
      where: { id: payableBill.id },
      data: {
        status: 'ISSUED',
        balanceDue: '230.00',
        issuedOn: new Date(),
      },
    });
  }
  // Promote any leftover DRAFT seed bills to ISSUED for payment tests
  await prisma.supplierBill.updateMany({
    where: { companyId, status: 'DRAFT', billNumber: { startsWith: 'BILL-2026-' } },
    data: { status: 'ISSUED' },
  });
  bills.push(payableBill);

  for (let i = 0; i < 10; i++) {
    if (i >= 5) continue;
    const paymentNumber = `SPAY-2026-${String(i + 1).padStart(3, '0')}`;
    await ensure(
      () =>
        prisma.supplierPayment.findFirst({
          where: { companyId, paymentNumber },
        }),
      () =>
        prisma.supplierPayment.create({
          data: {
            companyId,
            supplierBillId: bills[i]!.id,
            bankAccountId: bankAccounts[2]!.id,
            paymentNumber,
            method: 'BANK_TRANSFER',
            amount: bills[i]!.totalAmount,
            currency: 'SAR',
            status: 'SUCCEEDED',
            paidAt: day(i + 10),
          },
        }),
    );
  }

  // ── Expenses + finance ledger ────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const referenceNumber = `EXP-2026-${String(i + 1).padStart(3, '0')}`;
    const expense = await ensure(
      () =>
        prisma.expense.findFirst({
          where: { companyId, referenceNumber },
        }),
      () =>
        prisma.expense.create({
          data: {
            companyId,
            expenseCategoryId: expenseCategoryIds[i]!,
            bankAccountId: bankAccounts[i % bankAccounts.length]!.id,
            description: `Operating expense ${i + 1}`,
            amount: (250 + i * 75).toFixed(2),
            currency: 'SAR',
            expenseDate: day(i + 1),
            status: i < 7 ? 'PAID' : i < 9 ? 'APPROVED' : 'DRAFT',
            referenceNumber,
            createdById: accountantUserId,
          },
        }),
    );
    await ensure(
      () =>
        prisma.financialTransaction.findFirst({
          where: { companyId, expenseId: expense.id },
        }),
      () =>
        prisma.financialTransaction.create({
          data: {
            companyId,
            transactionType: 'EXPENSE',
            direction: 'OUTFLOW',
            amount: expense.amount,
            currency: 'SAR',
            occurredAt: day(i + 1),
            expenseId: expense.id,
            description: expense.description,
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.financialTransaction.findFirst({
          where: {
            companyId,
            salesInvoiceId: invoicesSales[i]!.id,
            transactionType: 'INTERNAL_SALE',
          },
        }),
      () =>
        prisma.financialTransaction.create({
          data: {
            companyId,
            transactionType: 'INTERNAL_SALE',
            direction: 'INFLOW',
            amount: invoicesSales[i]!.totalAmount,
            currency: 'SAR',
            occurredAt: day(i + 5),
            salesInvoiceId: invoicesSales[i]!.id,
            description: `Sale invoice ${invoicesSales[i]!.invoiceNumber}`,
          },
        }),
    );
  }

  // ── HR ───────────────────────────────────────────────────────────
  const employees = [];
  for (let i = 0; i < 10; i++) {
    const employeeNumber = `EMP-${String(i + 1).padStart(3, '0')}`;
    const linkedUser = users[i];
    employees.push(
      await ensure(
        () =>
          prisma.employee.findFirst({
            where: { companyId, employeeNumber },
          }),
        () =>
          prisma.employee.create({
            data: {
              companyId,
              userId: linkedUser?.id,
              userKey: linkedUser?.id ?? '',
              companyBranchId: branches[i % branches.length]!.id,
              companyDepartmentId: departments[i % departments.length]!.id,
              employeeNumber,
              fullName: linkedUser
                ? demoUsersSpec[i]!.fullName
                : `Employee ${i + 1}`,
              email: linkedUser?.email ?? `emp${i + 1}@demo-co.local`,
              phone: `+9665${String(500000000 + i).slice(0, 8)}`,
              jobTitle: [
                'Owner',
                'Admin',
                'Accountant',
                'Ops Manager',
                'Viewer',
                'Sales Lead',
                'HR Specialist',
                'Warehouse Lead',
                'Support Agent',
                'Finance Analyst',
              ][i]!,
              hireDate: day(-(365 + i * 30)),
              employmentStatus: i === 9 ? 'ON_LEAVE' : 'ACTIVE',
              basicSalary: (5000 + i * 800).toFixed(2),
              currency: 'SAR',
            },
          }),
      ),
    );
  }
  summary.employees = employees.length;

  for (let i = 0; i < 10; i++) {
    const attendanceDate = day(15 + i);
    await ensure(
      () =>
        prisma.attendanceRecord.findFirst({
          where: {
            employeeId: employees[i % employees.length]!.id,
            attendanceDate,
          },
        }),
      () =>
        prisma.attendanceRecord.create({
          data: {
            companyId,
            employeeId: employees[i % employees.length]!.id,
            attendanceDate,
            checkInAt: new Date(attendanceDate.getTime() + 8 * 3600_000),
            checkOutAt: new Date(attendanceDate.getTime() + 17 * 3600_000),
            status: i === 3 ? 'LATE' : i === 7 ? 'REMOTE' : 'PRESENT',
            workedMinutes: 480,
            source: 'SEED',
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.leaveRequest.findFirst({
          where: {
            companyId,
            employeeId: employees[i]!.id,
            leaveType: 'ANNUAL',
            startsOn: day(40 + i * 3),
          },
        }),
      () =>
        prisma.leaveRequest.create({
          data: {
            companyId,
            employeeId: employees[i]!.id,
            leaveType: i % 2 === 0 ? 'ANNUAL' : 'SICK',
            startsOn: day(40 + i * 3),
            endsOn: day(41 + i * 3),
            requestedDays: '2.00',
            status: i < 5 ? 'APPROVED' : i < 8 ? 'PENDING' : 'REJECTED',
            reason: 'Seed leave request',
            approvedById: i < 5 ? adminUserId : null,
            decidedAt: i < 5 ? day(39 + i * 3) : null,
          },
        }),
    );
  }

  // Create 2 payroll runs with items (unique on period)
  for (let r = 0; r < 2; r++) {
    const periodStart = day(r * 30);
    const periodEnd = day(r * 30 + 29);
    const run = await ensure(
      () =>
        prisma.payrollRun.findFirst({
          where: { companyId, periodStart, periodEnd },
        }),
      () =>
        prisma.payrollRun.create({
          data: {
            companyId,
            periodStart,
            periodEnd,
            status: r === 0 ? 'PAID' : 'CALCULATED',
            totalGross: '0',
            totalDeductions: '0',
            totalNet: '0',
            processedAt: r === 0 ? day(r * 30 + 30) : null,
            createdById: accountantUserId,
          },
        }),
    );
    let gross = 0;
    let net = 0;
    for (let i = 0; i < employees.length; i++) {
      const basic = 5000 + i * 800;
      const allowances = 500;
      const deductions = 200;
      const netAmount = basic + allowances - deductions;
      gross += basic + allowances;
      net += netAmount;
      await ensure(
        () =>
          prisma.payrollItem.findFirst({
            where: {
              payrollRunId: run.id,
              employeeId: employees[i]!.id,
            },
          }),
        () =>
          prisma.payrollItem.create({
            data: {
              payrollRunId: run.id,
              employeeId: employees[i]!.id,
              basicSalary: basic.toFixed(2),
              allowances: allowances.toFixed(2),
              deductions: deductions.toFixed(2),
              netAmount: netAmount.toFixed(2),
              status: r === 0 ? 'PAID' : 'APPROVED',
            },
          }),
      );
    }
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalGross: gross.toFixed(2),
        totalDeductions: (employees.length * 200).toFixed(2),
        totalNet: net.toFixed(2),
      },
    });
  }

  // ── Work ─────────────────────────────────────────────────────────
  const workProjects = [];
  for (let i = 0; i < 10; i++) {
    const code = `WP-${String(i + 1).padStart(2, '0')}`;
    workProjects.push(
      await ensure(
        () => prisma.workProject.findFirst({ where: { companyId, code } }),
        () =>
          prisma.workProject.create({
            data: {
              companyId,
              code,
              name: `Work Project ${i + 1}`,
              crmContactId: contacts[i]!.id,
              status: i < 6 ? 'ACTIVE' : i < 8 ? 'PLANNED' : 'COMPLETED',
              startsOn: day(i),
              endsOn: day(60 + i),
              budget: (40000 + i * 5000).toFixed(2),
              currency: 'SAR',
              ownerUserId: ownerUserId,
              progressPercent: (i * 10).toFixed(2),
            },
          }),
      ),
    );
  }
  summary.workProjects = workProjects.length;

  for (const project of workProjects) {
    for (let m = 0; m < 3; m++) {
      const companyUserId = users[m]!.companyUserId;
      await prisma.workProjectMember.upsert({
        where: {
          workProjectId_companyUserId: {
            workProjectId: project.id,
            companyUserId,
          },
        },
        update: {},
        create: {
          workProjectId: project.id,
          companyUserId,
          projectRole: m === 0 ? 'OWNER' : 'MEMBER',
        },
      });
    }
    for (let p = 1; p <= 3; p++) {
      await ensure(
        () =>
          prisma.workProjectPhase.findFirst({
            where: { workProjectId: project.id, position: p },
          }),
        () =>
          prisma.workProjectPhase.create({
            data: {
              workProjectId: project.id,
              name: `Phase ${p}`,
              position: p,
              status: p === 1 ? 'ACTIVE' : 'NOT_STARTED',
              progressPercent: p === 1 ? '40.00' : '0.00',
            },
          }),
      );
    }
  }

  const phases = await prisma.workProjectPhase.findMany({
    where: { workProjectId: { in: workProjects.map((p) => p.id) } },
    orderBy: [{ workProjectId: 'asc' }, { position: 'asc' }],
  });

  const tasks = [];
  for (let i = 0; i < 10; i++) {
    const project = workProjects[i]!;
    const phase = phases.find((p) => p.workProjectId === project.id);
    const title = `Task ${String(i + 1).padStart(2, '0')} — deliverable`;
    tasks.push(
      await ensure(
        () =>
          prisma.workTask.findFirst({
            where: { workProjectId: project.id, title },
          }),
        () =>
          prisma.workTask.create({
            data: {
              workProjectId: project.id,
              workProjectPhaseId: phase?.id,
              assigneeCompanyUserId: users[i % users.length]!.companyUserId,
              title,
              description: 'Seeded work task',
              priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[i % 4]!,
              status: (['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const)[
                i % 4
              ]!,
              dueAt: day(20 + i),
              estimatedHours: (4 + i).toFixed(2),
              progressPercent: (i * 10).toFixed(2),
            },
          }),
      ),
    );
  }
  for (let i = 0; i < tasks.length; i++) {
    await ensure(
      () =>
        prisma.workTaskComment.findFirst({
          where: {
            workTaskId: tasks[i]!.id,
            body: 'Seed comment on task progress',
          },
        }),
      () =>
        prisma.workTaskComment.create({
          data: {
            workTaskId: tasks[i]!.id,
            authorUserId: adminUserId,
            body: 'Seed comment on task progress',
          },
        }),
    );
  }

  // ── Notebook ─────────────────────────────────────────────────────
  const nbCats = [
    ['MGMT', 'Management Notes'],
    ['MEET', 'Meeting Notes'],
    ['DEC', 'Decisions'],
    ['IMP', 'Improvements'],
    ['ISSUE', 'Recurring Issues'],
    ['RISK', 'Risks'],
    ['IDEA', 'Ideas'],
    ['CLIENT', 'Client Notes'],
    ['OPS', 'Ops Notes'],
    ['FIN', 'Finance Notes'],
  ] as const;
  const notebookCategories = [];
  for (const [code, name] of nbCats) {
    notebookCategories.push(
      await ensure(
        () =>
          prisma.notebookCategory.findFirst({
            where: { companyId, codeKey: code },
          }),
        () =>
          prisma.notebookCategory.create({
            data: { companyId, code, codeKey: code, name },
          }),
      ),
    );
  }

  const notes = [];
  for (let i = 0; i < 10; i++) {
    const title = `Business Note ${String(i + 1).padStart(2, '0')}`;
    notes.push(
      await ensure(
        () => prisma.businessNote.findFirst({ where: { companyId, title } }),
        () =>
          prisma.businessNote.create({
            data: {
              companyId,
              categoryId: notebookCategories[i]!.id,
              title,
              body: `Detailed seed note body for item ${i + 1}. Covers decisions, follow-ups, and owners.`,
              status: (['OPEN', 'IN_PROGRESS', 'COMPLETED', 'UNDER_REVIEW'] as const)[
                i % 4
              ]!,
              priority: (['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const)[i % 4]!,
              workProjectId: workProjects[i]!.id,
              crmContactId: contacts[i]!.id,
              employeeId: employees[i]!.id,
              createdById: adminUserId,
            },
          }),
      ),
    );
  }
  for (let i = 0; i < notes.length; i++) {
    await ensure(
      () =>
        prisma.businessNoteComment.findFirst({
          where: { noteId: notes[i]!.id, body: 'Seed note comment' },
        }),
      () =>
        prisma.businessNoteComment.create({
          data: {
            noteId: notes[i]!.id,
            authorUserId: ownerUserId,
            body: 'Seed note comment',
          },
        }),
    );
    await ensure(
      () =>
        prisma.businessNoteRevision.findFirst({
          where: { noteId: notes[i]!.id, title: notes[i]!.title },
        }),
      () =>
        prisma.businessNoteRevision.create({
          data: {
            noteId: notes[i]!.id,
            editedById: adminUserId,
            title: notes[i]!.title,
            body: notes[i]!.body,
            status: notes[i]!.status,
          },
        }),
    );
  }

  // ── Automation / marketing / attachments / AI ────────────────────
  for (let i = 0; i < 10; i++) {
    const name = `Automation Rule ${String(i + 1).padStart(2, '0')}`;
    const rule = await ensure(
      () => prisma.automationRule.findFirst({ where: { companyId, name } }),
      () =>
        prisma.automationRule.create({
          data: {
            companyId,
            name,
            module: ['crm', 'sales', 'inventory', 'hr', 'work'][i % 5]!,
            triggerEvent: [
              'opportunity.won',
              'invoice.paid',
              'stock.low',
              'leave.requested',
              'task.overdue',
            ][i % 5]!,
            conditions: [{ field: 'status', op: 'eq', value: 'ACTIVE' }],
            actions: [{ type: 'notify', channel: 'email' }],
            status: i < 6 ? 'ACTIVE' : 'DRAFT',
            createdById: adminUserId,
          },
        }),
    );
    await ensure(
      () =>
        prisma.automationRun.findFirst({
          where: {
            automationRuleId: rule.id,
            triggerEntityType: 'SEED',
          },
        }),
      () =>
        prisma.automationRun.create({
          data: {
            automationRuleId: rule.id,
            status: i % 2 === 0 ? 'SUCCEEDED' : 'FAILED',
            triggerEntityType: 'SEED',
            triggerEntityId: contacts[i % contacts.length]!.id,
            finishedAt: day(i + 1),
            result: { ok: i % 2 === 0 },
            errorMessage: i % 2 === 0 ? null : 'Simulated failure',
          },
        }),
    );
  }

  const channels = [
    'INTERNAL_DRAFT',
    'FACEBOOK',
    'INSTAGRAM',
    'X',
    'LINKEDIN',
    'TIKTOK',
    'GOOGLE_BUSINESS_PROFILE',
    'OTHER',
    'INSTAGRAM',
    'FACEBOOK',
  ] as const;
  for (let i = 0; i < 10; i++) {
    const title = `Campaign Post ${String(i + 1).padStart(2, '0')}`;
    const post = await ensure(
      () => prisma.marketingPost.findFirst({ where: { companyId, title } }),
      () =>
        prisma.marketingPost.create({
          data: {
            companyId,
            title,
            content: `Seed marketing content #${i + 1} for Demo Co.`,
            channel: channels[i]!,
            status:
              i < 4
                ? 'PUBLISHED'
                : i < 7
                  ? 'SCHEDULED'
                  : i === 9
                    ? 'ARCHIVED'
                    : 'DRAFT',
            scheduledAt: day(i + 14),
            publishedAt: i < 4 ? day(i + 7) : null,
            archivedAt: i === 9 ? day(i) : null,
            createdById: users[5]!.id,
          },
        }),
    );

    if (i % 3 === 0) {
      const mediaKey = `seed/demo-co/marketing/${post.id}-cover.jpg`;
      await ensure(
        () =>
          prisma.marketingPostMedia.findFirst({
            where: { marketingPostId: post.id, storageKey: mediaKey },
          }),
        () =>
          prisma.marketingPostMedia.create({
            data: {
              companyId,
              marketingPostId: post.id,
              mediaType: 'IMAGE',
              fileName: `cover-${i + 1}.jpg`,
              mimeType: 'image/jpeg',
              sizeBytes: BigInt(50_000 + i * 1000),
              storageKey: mediaKey,
              checksumSha256: sha256(mediaKey),
              position: 0,
            },
          }),
      );
    }
  }

  const socialChannels = [
    'FACEBOOK',
    'INSTAGRAM',
    'LINKEDIN',
    'X',
    'TIKTOK',
    'GOOGLE_BUSINESS_PROFILE',
  ] as const;
  for (const channel of socialChannels) {
    const displayName = `Demo ${channel} Page`;
    await ensure(
      () =>
        prisma.marketingPlatformConnection.findFirst({
          where: { companyId, channel, displayName },
        }),
      () =>
        prisma.marketingPlatformConnection.create({
          data: {
            companyId,
            channel,
            displayName,
            externalAccountId: `seed-${channel.toLowerCase()}`,
            status: 'DISCONNECTED',
            createdById: adminUserId,
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    const storageKey = `seed/demo-co/attachments/file-${i + 1}.pdf`;
    await ensure(
      () => prisma.attachment.findUnique({ where: { storageKey } }),
      () =>
        prisma.attachment.create({
          data: {
            companyId,
            uploadedById: adminUserId,
            entityType: i % 2 === 0 ? 'CrmContact' : 'SalesInvoice',
            entityId: i % 2 === 0 ? contacts[i]!.id : invoicesSales[i]!.id,
            fileName: `file-${i + 1}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: BigInt(10_000 + i * 1500),
            storageKey,
            checksumSha256: sha256(storageKey),
          },
        }),
    );
  }

  const aiCount = await prisma.aiUsageLog.count({
    where: { companyId, requestReference: { startsWith: 'seed-ai-' } },
  });
  if (aiCount < 10) {
    for (let i = 0; i < 10; i++) {
      await prisma.aiUsageLog.create({
        data: {
          companyId,
          userId: adminUserId,
          module: ['crm', 'notebook', 'sales', 'hr', 'work'][i % 5]!,
          provider: 'openai',
          model: i % 2 === 0 ? 'gpt-4.1-mini' : 'gpt-4.1',
          inputTokens: 400 + i * 50,
          outputTokens: 120 + i * 20,
          estimatedCost: (0.01 + i * 0.002).toFixed(6),
          requestReference: `seed-ai-${i + 1}`,
        },
      });
    }
  }

  // ── Messaging + integration center ───────────────────────────────
  const msgChannels = [];
  const msgSpecs = [
    ['SMTP', 'Transactional Email'],
    ['SMTP', 'Marketing Email'],
    ['SMS', 'OTP SMS'],
    ['SMS', 'Alerts SMS'],
    ['SMTP', 'Finance Notices'],
    ['SMS', 'HR Alerts'],
    ['SMTP', 'System Digests'],
    ['SMS', 'Ops Alerts'],
    ['SMTP', 'Customer Receipts'],
    ['SMS', 'Delivery Updates'],
  ] as const;
  for (const [provider, name] of msgSpecs) {
    msgChannels.push(
      await ensure(
        () =>
          prisma.messagingChannel.findFirst({
            where: { companyId, provider, name },
          }),
        () =>
          prisma.messagingChannel.create({
            data: {
              companyId,
              provider,
              name,
              config: {
                transport: 'brevo',
                ...(provider === 'SMTP'
                  ? { fromEmail: 'noreply@demo-co.local', fromName: 'Demo Co' }
                  : { smsSender: 'DemoCo' }),
              },
            },
          }),
      ),
    );
  }

  for (let i = 0; i < 10; i++) {
    const code = `TPL-${String(i + 1).padStart(2, '0')}`;
    await ensure(
      () =>
        prisma.messageTemplate.findFirst({ where: { companyId, code } }),
      () =>
        prisma.messageTemplate.create({
          data: {
            companyId,
            messagingChannelId: msgChannels[i]!.id,
            code,
            name: `Template ${i + 1}`,
            bodyTemplate: `Hello {{name}}, this is template ${i + 1}.`,
            subject: providerSubject(msgChannels[i]!.provider, i),
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.messageDelivery.findFirst({
          where: { companyId, providerMessageId: `msg-seed-${i + 1}` },
        }),
      () =>
        prisma.messageDelivery.create({
          data: {
            companyId,
            messagingChannelId: msgChannels[i]!.id,
            recipient: `user${i + 1}@demo.local`,
            body: `Seed delivery message ${i + 1}`,
            status: i % 3 === 0 ? 'FAILED' : 'SENT',
            providerMessageId: `msg-seed-${i + 1}`,
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    const rawKey = `demo_api_key_${i + 1}_saas_erp_local`;
    const keyHash = sha256(rawKey);
    await ensure(
      () => prisma.companyApiKey.findUnique({ where: { keyHash } }),
      () =>
        prisma.companyApiKey.create({
          data: {
            companyId,
            name: `API Key ${i + 1}`,
            keyPrefix: `demo_${i + 1}`,
            keyHash,
            scopes: ['read', 'write'],
            createdById: adminUserId,
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    const name = `Webhook ${i + 1}`;
    const webhook = await ensure(
      () => prisma.companyWebhook.findFirst({ where: { companyId, name } }),
      () =>
        prisma.companyWebhook.create({
          data: {
            companyId,
            name,
            targetUrl: `https://hooks.demo.local/events/${i + 1}`,
            secretHash: sha256(`webhook-secret-${i + 1}`),
            events: ['order.created', 'invoice.paid'],
            createdById: adminUserId,
          },
        }),
    );
    await ensure(
      () =>
        prisma.webhookDelivery.findFirst({
          where: {
            companyWebhookId: webhook.id,
            eventType: 'invoice.paid',
          },
        }),
      () =>
        prisma.webhookDelivery.create({
          data: {
            companyWebhookId: webhook.id,
            eventType: 'invoice.paid',
            payload: { invoice: `INV-2026-${String(i + 1).padStart(3, '0')}` },
            status: i % 2 === 0 ? 'SUCCEEDED' : 'FAILED',
            responseCode: i % 2 === 0 ? 200 : 500,
          },
        }),
    );
  }

  const apiLogCount = await prisma.apiRequestLog.count({
    where: { companyId, path: { startsWith: '/api/v1/resources/' } },
  });
  if (apiLogCount < 10) {
    for (let i = 0; i < 10; i++) {
      await prisma.apiRequestLog.create({
        data: {
          companyId,
          method: i % 2 === 0 ? 'GET' : 'POST',
          path: `/api/v1/resources/${i + 1}`,
          statusCode: i % 4 === 0 ? 400 : 200,
          ipAddress: '127.0.0.1',
          durationMs: 20 + i * 3,
        },
      });
    }
  }

  // ── Connected projects + mirrors ─────────────────────────────────
  const hs = await prisma.platformProvider.findUniqueOrThrow({
    where: { code: 'HUNGERSTATION' },
  });
  const tabby = await prisma.platformProvider.findUniqueOrThrow({
    where: { code: 'TABBY' },
  });
  const zid = await prisma.platformProvider.findUniqueOrThrow({
    where: { code: 'ZID' },
  });

  const projectSpecs = [
    { provider: hs, name: 'HungerStation Riyadh' },
    { provider: hs, name: 'HungerStation Jeddah' },
    { provider: tabby, name: 'Tabby Checkout' },
    { provider: tabby, name: 'Tabby Settlements' },
    { provider: zid, name: 'Zid Store Main' },
    { provider: zid, name: 'Zid Store Outlet' },
    {
      provider: await prisma.platformProvider.findUniqueOrThrow({
        where: { code: 'SALLA' },
      }),
      name: 'Salla Flagship',
    },
    {
      provider: await prisma.platformProvider.findUniqueOrThrow({
        where: { code: 'JAHEZ' },
      }),
      name: 'Jahez Pilot',
    },
    {
      provider: await prisma.platformProvider.findUniqueOrThrow({
        where: { code: 'TAMARA' },
      }),
      name: 'Tamara BNPL',
    },
    {
      provider: await prisma.platformProvider.findUniqueOrThrow({
        where: { code: 'KEETA' },
      }),
      name: 'Keeta Sandbox',
    },
  ];

  const projects = [];
  for (let i = 0; i < projectSpecs.length; i++) {
    const spec = projectSpecs[i]!;
    const desiredStatus = i < 6 ? 'ACTIVE' : 'CONNECTING';
    const project = await ensure(
      () =>
        prisma.connectedProject.findFirst({
          where: {
            companyId,
            providerId: spec.provider.id,
            name: spec.name,
          },
        }),
      () =>
        prisma.connectedProject.create({
          data: {
            companyId,
            categoryId: spec.provider.categoryId,
            providerId: spec.provider.id,
            name: spec.name,
            externalAccountId: `ext-acc-${i + 1}`,
            environment: 'SANDBOX',
            status: desiredStatus,
            defaultCurrency: 'SAR',
            lastSuccessfulSyncAt: desiredStatus === 'ACTIVE' ? day(i) : null,
            createdById: adminUserId,
          },
        }),
    );
    if (project.status !== desiredStatus) {
      await prisma.connectedProject.update({
        where: { id: project.id },
        data: {
          status: desiredStatus,
          lastSuccessfulSyncAt:
            desiredStatus === 'ACTIVE' ? new Date() : project.lastSuccessfulSyncAt,
        },
      });
      project.status = desiredStatus;
    }
    projects.push(project);
  }
  summary.connectedProjects = projects.length;

  for (const project of projects) {
    const encrypted = encryptSeedPayload(
      JSON.stringify({
        apiKey: `seed-key-${project.name}`,
        grantedScopes: DEMO_GRANTED_SCOPES,
      }),
    );
    await prisma.projectCredential.upsert({
      where: { connectedProjectId: project.id },
      create: {
        connectedProjectId: project.id,
        authType: 'API_KEY',
        credentialsCiphertext: encrypted.ciphertext,
        keyVersion: encrypted.keyVersion,
        status: 'ACTIVE',
      },
      update: {
        credentialsCiphertext: encrypted.ciphertext,
        keyVersion: encrypted.keyVersion,
        status: 'ACTIVE',
        authType: 'API_KEY',
      },
    });

    for (let loc = 1; loc <= 2; loc++) {
      await ensure(
        () =>
          prisma.projectLocation.findFirst({
            where: {
              connectedProjectId: project.id,
              externalId: `loc-${loc}`,
            },
          }),
        () =>
          prisma.projectLocation.create({
            data: {
              connectedProjectId: project.id,
              companyBranchId: branches[(loc - 1) % branches.length]!.id,
              externalId: `loc-${loc}`,
              name: `${project.name} Location ${loc}`,
              code: `L${loc}`,
              city: branches[(loc - 1) % branches.length]!.city,
              lastSyncedAt: day(1),
            },
          }),
      );
    }

    for (const entityType of ['orders', 'products', 'customers'] as const) {
      await ensure(
        () =>
          prisma.projectSyncState.findFirst({
            where: {
              connectedProjectId: project.id,
              entityType,
              direction: 'IMPORT',
            },
          }),
        () =>
          prisma.projectSyncState.create({
            data: {
              connectedProjectId: project.id,
              entityType,
              direction: 'IMPORT',
              lastStatus: 'SUCCESS',
              lastSyncedAt: day(1),
            },
          }),
      );
    }
  }

  // Prefer HungerStation Riyadh for audit harvest (ACTIVE + newest sync)
  const hsRiyadh = projects.find((p) => p.name === 'HungerStation Riyadh');
  if (hsRiyadh) {
    await prisma.connectedProject.update({
      where: { id: hsRiyadh.id },
      data: {
        status: 'ACTIVE',
        lastSuccessfulSyncAt: new Date(),
      },
    });
  }

  // Rich mirrors on first HungerStation project
  const mirrorProject = hsRiyadh ?? projects[0]!;
  const mirrorLocation = await prisma.projectLocation.findFirstOrThrow({
    where: { connectedProjectId: mirrorProject.id, externalId: 'loc-1' },
  });

  const extCategories = [];
  for (let i = 1; i <= 10; i++) {
    extCategories.push(
      await ensure(
        () =>
          prisma.externalCategory.findFirst({
            where: {
              connectedProjectId: mirrorProject.id,
              externalId: `cat-${i}`,
            },
          }),
        () =>
          prisma.externalCategory.create({
            data: {
              connectedProjectId: mirrorProject.id,
              projectLocationId: mirrorLocation.id,
              externalId: `cat-${i}`,
              name: `External Category ${i}`,
              sortOrder: i,
              lastSyncedAt: day(1),
            },
          }),
      ),
    );
  }

  const extProducts = [];
  for (let i = 1; i <= 10; i++) {
    extProducts.push(
      await ensure(
        () =>
          prisma.externalProduct.findFirst({
            where: {
              connectedProjectId: mirrorProject.id,
              externalId: `prod-${i}`,
            },
          }),
        () =>
          prisma.externalProduct.create({
            data: {
              connectedProjectId: mirrorProject.id,
              projectLocationId: mirrorLocation.id,
              externalCategoryId: extCategories[i - 1]!.id,
              externalId: `prod-${i}`,
              sku: `EXT-SKU-${i}`,
              name: `External Product ${i}`,
              price: (20 + i).toFixed(2),
              currency: 'SAR',
              lastSyncedAt: day(1),
            },
          }),
      ),
    );
  }

  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.externalProductVariant.findFirst({
          where: {
            externalProductId: extProducts[i]!.id,
            externalId: `var-${i + 1}`,
          },
        }),
      () =>
        prisma.externalProductVariant.create({
          data: {
            externalProductId: extProducts[i]!.id,
            externalId: `var-${i + 1}`,
            name: `Variant ${i + 1}`,
            price: (22 + i).toFixed(2),
            lastSyncedAt: day(1),
          },
        }),
    );
    await ensure(
      () =>
        prisma.externalInventoryLevel.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            projectLocationId: mirrorLocation.id,
            externalProductId: extProducts[i]!.id,
            variantKey: '',
          },
        }),
      () =>
        prisma.externalInventoryLevel.create({
          data: {
            connectedProjectId: mirrorProject.id,
            projectLocationId: mirrorLocation.id,
            externalProductId: extProducts[i]!.id,
            quantityAvailable: (100 - i * 3).toFixed(3),
            lastSyncedAt: day(1),
          },
        }),
    );
  }

  const extCustomers = [];
  for (let i = 1; i <= 10; i++) {
    extCustomers.push(
      await ensure(
        () =>
          prisma.externalCustomer.findFirst({
            where: {
              connectedProjectId: mirrorProject.id,
              externalId: `cust-${i}`,
            },
          }),
        () =>
          prisma.externalCustomer.create({
            data: {
              connectedProjectId: mirrorProject.id,
              externalId: `cust-${i}`,
              displayName: `External Customer ${i}`,
              lastSyncedAt: day(1),
            },
          }),
      ),
    );
  }

  const extOrders = [];
  for (let i = 1; i <= 10; i++) {
    const order = await ensure(
      () =>
        prisma.externalOrder.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            externalId: `ord-${i}`,
          },
        }),
      () =>
        prisma.externalOrder.create({
          data: {
            connectedProjectId: mirrorProject.id,
            projectLocationId: mirrorLocation.id,
            externalCustomerId: extCustomers[i - 1]!.id,
            externalId: `ord-${i}`,
            externalNumber: `HS-${1000 + i}`,
            status: (['CONFIRMED', 'PREPARING', 'IN_DELIVERY', 'DELIVERED', 'COMPLETED'] as const)[
              (i - 1) % 5
            ]!,
            financialStatus: 'PAID',
            fulfillmentStatus: i > 7 ? 'DELIVERED' : 'PROCESSING',
            placedAt: day(i),
            currency: 'SAR',
            subtotal: (80 + i * 5).toFixed(2),
            taxAmount: (12 + i).toFixed(2),
            deliveryFee: '10.00',
            providerFee: '5.00',
            totalAmount: (107 + i * 6).toFixed(2),
            netAmount: (90 + i * 5).toFixed(2),
            lastSyncedAt: day(i),
          },
        }),
    );
    extOrders.push(order);
    await ensure(
      () =>
        prisma.externalOrderItem.findFirst({
          where: {
            externalOrderId: order.id,
            externalIdKey: `line-${i}`,
          },
        }),
      () =>
        prisma.externalOrderItem.create({
          data: {
            externalOrderId: order.id,
            externalId: `line-${i}`,
            externalIdKey: `line-${i}`,
            externalProductId: extProducts[i - 1]!.id,
            name: extProducts[i - 1]!.name,
            quantity: '1.000',
            unitPrice: (80 + i * 5).toFixed(2),
            totalAmount: (80 + i * 5).toFixed(2),
          },
        }),
    );
    await ensure(
      () =>
        prisma.externalOrderStatusHistory.findFirst({
          where: {
            externalOrderId: order.id,
            externalStatus: 'confirmed',
            source: 'POLL',
          },
        }),
      () =>
        prisma.externalOrderStatusHistory.create({
          data: {
            externalOrderId: order.id,
            externalStatus: 'confirmed',
            normalizedStatus: 'CONFIRMED',
            source: 'POLL',
            occurredAt: day(i),
          },
        }),
    );
  }

  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.externalRefund.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            externalId: `ref-${i + 1}`,
          },
        }),
      () =>
        prisma.externalRefund.create({
          data: {
            connectedProjectId: mirrorProject.id,
            externalOrderId: extOrders[i]!.id,
            externalId: `ref-${i + 1}`,
            status: i < 7 ? 'SUCCEEDED' : 'PENDING',
            amount: (10 + i).toFixed(2),
            currency: 'SAR',
            reason: 'Seed refund',
            requestedAt: day(i + 2),
            processedAt: i < 7 ? day(i + 3) : null,
          },
        }),
    );
    await ensure(
      () =>
        prisma.externalFulfillment.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            externalId: `ful-${i + 1}`,
          },
        }),
      () =>
        prisma.externalFulfillment.create({
          data: {
            connectedProjectId: mirrorProject.id,
            externalOrderId: extOrders[i]!.id,
            externalId: `ful-${i + 1}`,
            status: i < 5 ? 'DELIVERED' : 'IN_TRANSIT',
          },
        }),
    );
    await ensure(
      () =>
        prisma.externalPromotion.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            externalId: `promo-${i + 1}`,
          },
        }),
      () =>
        prisma.externalPromotion.create({
          data: {
            connectedProjectId: mirrorProject.id,
            projectLocationId: mirrorLocation.id,
            externalId: `promo-${i + 1}`,
            name: `Promo ${i + 1}`,
            promotionType: 'PERCENT',
          },
        }),
    );
    await ensure(
      () =>
        prisma.externalDriver.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            externalId: `drv-${i + 1}`,
          },
        }),
      () =>
        prisma.externalDriver.create({
          data: {
            connectedProjectId: mirrorProject.id,
            projectLocationId: mirrorLocation.id,
            externalId: `drv-${i + 1}`,
            name: `Driver ${i + 1}`,
            lastSyncedAt: day(1),
          },
        }),
    );
    await ensure(
      () =>
        prisma.externalSettlement.findFirst({
          where: {
            connectedProjectId: mirrorProject.id,
            externalId: `set-${i + 1}`,
          },
        }),
      () =>
        prisma.externalSettlement.create({
          data: {
            connectedProjectId: mirrorProject.id,
            externalId: `set-${i + 1}`,
            periodStart: day(i * 7),
            periodEnd: day(i * 7 + 6),
            status: i < 6 ? 'PAID' : 'PENDING',
            grossSales: (1000 + i * 100).toFixed(2),
            providerFees: (50 + i * 5).toFixed(2),
            netAmount: (950 + i * 95).toFixed(2),
            currency: 'SAR',
          },
        }),
    );
  }

  // Installment mirrors on Tabby project
  const tabbyProject = projects[2]!;
  for (let i = 1; i <= 10; i++) {
    const txn = await ensure(
      () =>
        prisma.installmentTransaction.findFirst({
          where: {
            connectedProjectId: tabbyProject.id,
            externalId: `inst-${i}`,
          },
        }),
      () =>
        prisma.installmentTransaction.create({
          data: {
            connectedProjectId: tabbyProject.id,
            externalId: `inst-${i}`,
            merchantOrderReference: `MO-${1000 + i}`,
            amount: (300 + i * 40).toFixed(2),
            currency: 'SAR',
            status: i < 7 ? 'CAPTURED' : 'AUTHORIZED',
            lastSyncedAt: day(i),
          },
        }),
    );
    await ensure(
      () =>
        prisma.installmentEvent.findFirst({
          where: {
            installmentTransactionId: txn.id,
            externalEventKey: `evt-${i}`,
          },
        }),
      () =>
        prisma.installmentEvent.create({
          data: {
            installmentTransactionId: txn.id,
            eventType: 'status_update',
            externalEventKey: `evt-${i}`,
            occurredAt: day(i),
            status: txn.status,
          },
        }),
    );
    if (i <= 5) {
      await ensure(
        () =>
          prisma.installmentRefund.findFirst({
            where: {
              installmentTransactionId: txn.id,
              externalId: `iref-${i}`,
            },
          }),
        () =>
          prisma.installmentRefund.create({
            data: {
              installmentTransactionId: txn.id,
              externalId: `iref-${i}`,
              status: 'SUCCEEDED',
              amount: '25.00',
              currency: 'SAR',
            },
          }),
      );
    }
    if (i <= 3) {
      await ensure(
        () =>
          prisma.installmentDispute.findFirst({
            where: {
              installmentTransactionId: txn.id,
              externalId: `disp-${i}`,
            },
          }),
        () =>
          prisma.installmentDispute.create({
            data: {
              installmentTransactionId: txn.id,
              externalId: `disp-${i}`,
              status: 'OPEN',
            },
          }),
      );
    }
  }

  // Ops / jobs / errors / webhook events (light but 10)
  const orderReadCap = await prisma.capability.findUniqueOrThrow({
    where: { code: 'ORDER_READ' },
  });
  for (let i = 0; i < 10; i++) {
    const project = projects[i % projects.length]!;
    await ensure(
      () =>
        prisma.providerOperationRequest.findFirst({
          where: {
            connectedProjectId: project.id,
            idempotencyKey: `seed-op-${i + 1}`,
          },
        }),
      () =>
        prisma.providerOperationRequest.create({
          data: {
            connectedProjectId: project.id,
            capabilityId: orderReadCap.id,
            requestedById: adminUserId,
            operationType: 'ORDER_READ',
            idempotencyKey: `seed-op-${i + 1}`,
            status: i % 2 === 0 ? 'SUCCEEDED' : 'FAILED',
            processedAt: day(i),
          },
        }),
    );
    await ensure(
      () =>
        prisma.integrationJob.findFirst({
          where: {
            connectedProjectId: project.id,
            jobType: 'SYNC',
            entityType: `seed-${i + 1}`,
          },
        }),
      () =>
        prisma.integrationJob.create({
          data: {
            connectedProjectId: project.id,
            jobType: 'SYNC',
            entityType: `seed-${i + 1}`,
            scheduledAt: day(i),
            status: i % 2 === 0 ? 'SUCCEEDED' : 'FAILED',
            startedAt: day(i),
            finishedAt: day(i),
          },
        }),
    );
    await ensure(
      () =>
        prisma.integrationError.findFirst({
          where: {
            connectedProjectId: project.id,
            errorCode: `SEED-E${i + 1}`,
          },
        }),
      () =>
        prisma.integrationError.create({
          data: {
            connectedProjectId: project.id,
            message: `Seed integration error ${i + 1}`,
            errorCode: `SEED-E${i + 1}`,
          },
        }),
    );
    await ensure(
      () =>
        prisma.webhookEvent.findFirst({
          where: {
            connectedProjectId: project.id,
            payloadHash: sha256(`seed-webhook-payload-${i + 1}`),
          },
        }),
      () =>
        prisma.webhookEvent.create({
          data: {
            connectedProjectId: project.id,
            eventType: 'order.updated',
            providerEventId: `wh-evt-${i + 1}`,
            payload: { id: i + 1 },
            payloadHash: sha256(`seed-webhook-payload-${i + 1}`),
            status: 'PROCESSED',
          },
        }),
    );
  }

  // ── Notifications + audit ────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    await ensure(
      () =>
        prisma.notification.findFirst({
          where: {
            companyId,
            userId: adminUserId,
            title: `Notification ${i + 1}`,
          },
        }),
      () =>
        prisma.notification.create({
          data: {
            companyId,
            userId: adminUserId,
            type: ['invoice', 'task', 'leave', 'sync', 'system'][i % 5]!,
            title: `Notification ${i + 1}`,
            body: `Seed notification body ${i + 1}`,
            actionUrl: `/app/notifications/${i + 1}`,
            readAt: i < 4 ? day(i) : null,
          },
        }),
    );
    await ensure(
      () =>
        prisma.auditLog.findFirst({
          where: {
            companyId,
            action: 'SEED',
            entityType: 'SeedMarker',
            entityId: `seed-audit-${String(i + 1).padStart(2, '0')}`,
          },
        }),
      () =>
        prisma.auditLog.create({
          data: {
            companyId,
            actorUserId: adminUserId,
            action: 'SEED',
            entityType: 'SeedMarker',
            entityId: `seed-audit-${String(i + 1).padStart(2, '0')}`,
            metadata: { seed: true, index: i + 1 },
          },
        }),
    );
  }

  // ── Sandbox probe tables (API /sandbox smoke tests) ──────────────
  await prisma.sandboxCompany.upsert({
    where: { id: companyId },
    create: { id: companyId, name: 'Demo Co Sandbox Probe' },
    update: { name: 'Demo Co Sandbox Probe', status: 'ACTIVE' },
  });
  await ensure(
    () =>
      prisma.sandboxItem.findFirst({
        where: { companyId, name: 'Seed Probe Item', deletedMarker: '' },
      }),
    () =>
      prisma.sandboxItem.create({
        data: {
          companyId,
          name: 'Seed Probe Item',
          unitPrice: '25.00',
          description: 'Seeded sandbox item for API audits',
        },
      }),
  );
  summary.sandboxItems = 1;

  // Keep MAIN free for POST /inventory/counts (cancel leftover open counts)
  const leftoverOpen = await prisma.stockCount.findMany({
    where: {
      companyId,
      OR: [
        { warehouseId: mainWh.id, status: { in: ['DRAFT', 'IN_PROGRESS'] } },
        { openWarehouseId: mainWh.id },
      ],
      NOT: { countNumber: 'SC-AUDIT-OPEN' },
    },
  });
  for (const row of leftoverOpen) {
    await prisma.stockCount.update({
      where: { id: row.id },
      data: {
        status: 'CANCELLED',
        openWarehouseId: null,
        completedAt: new Date(),
      },
    });
  }

  // Advance document sequences past seed + prior audit collisions (monotonic)
  const settingsRow = await prisma.companySettings.findUnique({
    where: { companyId },
  });
  const bag =
    settingsRow?.settings &&
    typeof settingsRow.settings === 'object' &&
    !Array.isArray(settingsRow.settings)
      ? { ...(settingsRow.settings as Record<string, unknown>) }
      : {};
  const existingSeq =
    bag.docSequences &&
    typeof bag.docSequences === 'object' &&
    !Array.isArray(bag.docSequences)
      ? (bag.docSequences as Record<string, { next?: number }>)
      : {};
  const maxExisting = Math.max(
    1,
    ...Object.values(existingSeq).map((s) => Number(s?.next ?? 1)),
    Number(settingsRow?.nextInvoiceNumber ?? 1n),
  );
  const seqFloor = Math.max(maxExisting + 500, Date.now() % 1_000_000);
  const seqKeys = [
    'quote',
    'receipt',
    'creditNote',
    'contract',
    'purchaseOrder',
    'supplierPayment',
    'stockCount',
  ] as const;
  const nextSeqs: Record<string, { prefix: string; next: number }> = {};
  const prefixes: Record<(typeof seqKeys)[number], string> = {
    quote: 'QT',
    receipt: 'RCP',
    creditNote: 'CN',
    contract: 'CT',
    purchaseOrder: 'PO',
    supplierPayment: 'SP',
    stockCount: 'SC',
  };
  for (const key of seqKeys) {
    nextSeqs[key] = { prefix: prefixes[key], next: seqFloor };
  }
  bag.docSequences = nextSeqs;
  await prisma.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      nextInvoiceNumber: BigInt(seqFloor),
      settings: bag as object,
    },
    update: {
      nextInvoiceNumber: BigInt(seqFloor),
      settings: bag as object,
    },
  });
  summary.docSequences = seqFloor;

  return summary;
}

function providerSubject(
  provider: 'SMTP' | 'WHATSAPP' | 'SMS',
  index: number,
): string | null {
  return provider === 'SMTP' ? `Subject ${index + 1}` : null;
}
