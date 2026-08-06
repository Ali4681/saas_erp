import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import {
  ApiAvailability,
  CapabilityDirection,
  CapabilitySupportStatus,
  PrismaClient,
} from '../src/generated/prisma/client';
import { seedDemoCompanyData } from './seed-demo-data';

const ROLE_CODES = [
  { code: 'PLATFORM_SUPER_ADMIN', name: 'Platform Super Admin', scope: 'PLATFORM' as const },
  { code: 'COMPANY_OWNER', name: 'Company Owner', scope: 'TENANT' as const },
  { code: 'COMPANY_ADMIN', name: 'Company Admin', scope: 'TENANT' as const },
  { code: 'ACCOUNTANT', name: 'Accountant', scope: 'TENANT' as const },
  { code: 'OPERATIONS_MANAGER', name: 'Operations Manager', scope: 'TENANT' as const },
  { code: 'EMPLOYEE_VIEWER', name: 'Employee / Viewer', scope: 'TENANT' as const },
];

const PERMISSIONS = [
  ['companies', 'read'],
  ['companies', 'write'],
  ['users', 'read'],
  ['users', 'write'],
  ['plans', 'read'],
  ['plans', 'write'],
  ['subscriptions', 'read'],
  ['subscriptions', 'write'],
  ['audit', 'read'],
  ['integrations', 'read'],
  ['integrations', 'write'],
  ['finance', 'read'],
  ['finance', 'write'],
  ['crm', 'read'],
  ['crm', 'write'],
  ['sales', 'read'],
  ['sales', 'write'],
  ['purchasing', 'read'],
  ['purchasing', 'write'],
  ['inventory', 'read'],
  ['inventory', 'write'],
  ['hr', 'read'],
  ['hr', 'write'],
  ['work', 'read'],
  ['work', 'write'],
  ['automation', 'read'],
  ['automation', 'write'],
  ['marketing', 'read'],
  ['marketing', 'write'],
  ['attachments', 'read'],
  ['attachments', 'write'],
  ['ai', 'read'],
  ['ai', 'write'],
  ['notebook', 'read'],
  ['notebook', 'write'],
  ['integration_center', 'read'],
  ['integration_center', 'write'],
  ['messaging', 'read'],
  ['messaging', 'write'],
  ['notifications', 'read'],
  ['notifications', 'write'],
  ['reports', 'read'],
  ['retention', 'run'],
] as const;

const PHASE8_READ = [
  'hr.read',
  'work.read',
  'automation.read',
  'marketing.read',
  'attachments.read',
  'ai.read',
] as const;

const PHASE8_WRITE = [
  'hr.write',
  'work.write',
  'automation.write',
  'marketing.write',
  'attachments.write',
  'ai.write',
] as const;

const PHASE9_READ = [
  'notebook.read',
  'integration_center.read',
  'messaging.read',
  'notifications.read',
] as const;

const PHASE9_WRITE = [
  'notebook.write',
  'integration_center.write',
  'messaging.write',
  'notifications.write',
] as const;

const PHASE10_READ = ['reports.read'] as const;
const PHASE10_WRITE = ['retention.run'] as const;

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  PLATFORM_SUPER_ADMIN: PERMISSIONS.map(([module, action]) => `${module}.${action}`),
  COMPANY_OWNER: [
    'companies.read',
    'companies.write',
    'users.read',
    'users.write',
    'plans.read',
    'subscriptions.read',
    'subscriptions.write',
    'audit.read',
    'integrations.read',
    'integrations.write',
    'finance.read',
    'finance.write',
    'crm.read',
    'crm.write',
    'sales.read',
    'sales.write',
    'purchasing.read',
    'purchasing.write',
    'inventory.read',
    'inventory.write',
    ...PHASE8_READ,
    ...PHASE8_WRITE,
    ...PHASE9_READ,
    ...PHASE9_WRITE,
    ...PHASE10_READ,
    ...PHASE10_WRITE,
  ],
  COMPANY_ADMIN: [
    'companies.read',
    'users.read',
    'users.write',
    'plans.read',
    'subscriptions.read',
    'audit.read',
    'integrations.read',
    'integrations.write',
    'finance.read',
    'finance.write',
    'crm.read',
    'crm.write',
    'sales.read',
    'sales.write',
    'purchasing.read',
    'purchasing.write',
    'inventory.read',
    'inventory.write',
    ...PHASE8_READ,
    ...PHASE8_WRITE,
    ...PHASE9_READ,
    ...PHASE9_WRITE,
    ...PHASE10_READ,
  ],
  ACCOUNTANT: [
    'companies.read',
    'plans.read',
    'subscriptions.read',
    'audit.read',
    'integrations.read',
    'finance.read',
    'finance.write',
    'sales.read',
    'sales.write',
    'purchasing.read',
    'purchasing.write',
    'crm.read',
    'hr.read',
    'attachments.read',
    'notebook.read',
    'reports.read',
  ],
  OPERATIONS_MANAGER: [
    'companies.read',
    'users.read',
    'plans.read',
    'integrations.read',
    'integrations.write',
    'finance.read',
    'crm.read',
    'crm.write',
    'sales.read',
    'purchasing.read',
    'purchasing.write',
    'inventory.read',
    'inventory.write',
    'hr.read',
    'hr.write',
    'work.read',
    'work.write',
    'automation.read',
    'automation.write',
    'marketing.read',
    'marketing.write',
    'attachments.read',
    'attachments.write',
    'ai.read',
    'ai.write',
    ...PHASE9_READ,
    ...PHASE9_WRITE,
    ...PHASE10_READ,
  ],
  EMPLOYEE_VIEWER: [
    'companies.read',
    'plans.read',
    'integrations.read',
    'finance.read',
    'crm.read',
    'sales.read',
    'purchasing.read',
    'inventory.read',
    ...PHASE8_READ,
    ...PHASE9_READ,
    'reports.read',
  ],
};

const CAPABILITIES: Array<{
  code: string;
  name: string;
  entityType: string;
  direction: CapabilityDirection;
}> = [
  { code: 'ACCOUNT_READ', name: 'Read account', entityType: 'account', direction: 'READ' },
  { code: 'ACCOUNT_UPDATE', name: 'Update account', entityType: 'account', direction: 'WRITE' },
  { code: 'LOCATION_READ', name: 'Read locations', entityType: 'location', direction: 'READ' },
  { code: 'LOCATION_UPDATE', name: 'Update locations', entityType: 'location', direction: 'WRITE' },
  { code: 'LOCATION_STATUS_UPDATE', name: 'Update location status', entityType: 'location', direction: 'WRITE' },
  { code: 'CATEGORY_READ', name: 'Read categories', entityType: 'category', direction: 'READ' },
  { code: 'CATEGORY_WRITE', name: 'Write categories', entityType: 'category', direction: 'WRITE' },
  { code: 'PRODUCT_READ', name: 'Read products', entityType: 'product', direction: 'READ' },
  { code: 'PRODUCT_CREATE', name: 'Create products', entityType: 'product', direction: 'WRITE' },
  { code: 'PRODUCT_UPDATE', name: 'Update products', entityType: 'product', direction: 'WRITE' },
  { code: 'INVENTORY_READ', name: 'Read inventory', entityType: 'inventory', direction: 'READ' },
  { code: 'INVENTORY_UPDATE', name: 'Update inventory', entityType: 'inventory', direction: 'WRITE' },
  { code: 'ORDER_READ', name: 'Read orders', entityType: 'order', direction: 'READ' },
  { code: 'ORDER_ACCEPT', name: 'Accept orders', entityType: 'order', direction: 'WRITE' },
  { code: 'ORDER_UPDATE', name: 'Update orders', entityType: 'order', direction: 'WRITE' },
  { code: 'ORDER_CANCEL', name: 'Cancel orders', entityType: 'order', direction: 'WRITE' },
  { code: 'ORDER_STATUS_UPDATE', name: 'Update order status', entityType: 'order', direction: 'WRITE' },
  { code: 'FULFILLMENT_READ', name: 'Read fulfillments', entityType: 'fulfillment', direction: 'READ' },
  { code: 'FULFILLMENT_UPDATE', name: 'Update fulfillments', entityType: 'fulfillment', direction: 'WRITE' },
  { code: 'DRIVER_READ', name: 'Read drivers', entityType: 'driver', direction: 'READ' },
  { code: 'DRIVER_CREATE', name: 'Create drivers', entityType: 'driver', direction: 'WRITE' },
  { code: 'DRIVER_UPDATE', name: 'Update drivers', entityType: 'driver', direction: 'WRITE' },
  { code: 'TRACKING_READ', name: 'Read tracking', entityType: 'tracking', direction: 'READ' },
  { code: 'PROMOTION_READ', name: 'Read promotions', entityType: 'promotion', direction: 'READ' },
  { code: 'PROMOTION_WRITE', name: 'Write promotions', entityType: 'promotion', direction: 'WRITE' },
  { code: 'REPORT_READ', name: 'Read reports', entityType: 'report', direction: 'READ' },
  { code: 'SETTLEMENT_READ', name: 'Read settlements', entityType: 'settlement', direction: 'READ' },
  { code: 'CHECKOUT_CREATE', name: 'Create checkout', entityType: 'checkout', direction: 'WRITE' },
  { code: 'PAYMENT_READ', name: 'Read payments', entityType: 'payment', direction: 'READ' },
  { code: 'PAYMENT_AUTHORIZE', name: 'Authorize payment', entityType: 'payment', direction: 'WRITE' },
  { code: 'PAYMENT_CAPTURE', name: 'Capture payment', entityType: 'payment', direction: 'WRITE' },
  { code: 'PAYMENT_CANCEL', name: 'Cancel payment', entityType: 'payment', direction: 'WRITE' },
  { code: 'PAYMENT_CLOSE', name: 'Close payment', entityType: 'payment', direction: 'WRITE' },
  { code: 'PAYMENT_REFUND', name: 'Refund payment', entityType: 'payment', direction: 'WRITE' },
  { code: 'DISPUTE_READ', name: 'Read disputes', entityType: 'dispute', direction: 'READ' },
  { code: 'DISPUTE_RESPOND', name: 'Respond to disputes', entityType: 'dispute', direction: 'WRITE' },
  { code: 'CUSTOMER_READ', name: 'Read customers', entityType: 'customer', direction: 'READ' },
  { code: 'WEBHOOK_REGISTER', name: 'Register webhooks', entityType: 'webhook', direction: 'WRITE' },
  { code: 'WEBHOOK_RECEIVE', name: 'Receive webhooks', entityType: 'webhook', direction: 'EVENT' },
  { code: 'BULK_SYNC', name: 'Bulk sync', entityType: 'sync', direction: 'BOTH' },
];

type ProviderSeed = {
  code: string;
  name: string;
  category: string;
  apiAvailability: ApiAvailability;
  officialDocsUrl?: string;
  requiresApproval?: boolean;
  caps: Array<{
    code: string;
    status: CapabilitySupportStatus;
    requiredScope?: string;
    sourceUrl?: string;
    notes?: string;
  }>;
};

const V = 'VERIFIED' as const;
const U = 'UNVERIFIED' as const;
const N = 'NOT_SUPPORTED' as const;
const P = 'PARTNER_ENABLED' as const;

const PROVIDERS: ProviderSeed[] = [
  {
    code: 'HUNGERSTATION',
    name: 'HungerStation',
    category: 'DELIVERY',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    officialDocsUrl: 'https://developer.hungerstation.com/api-specifications',
    caps: [
      { code: 'ACCOUNT_READ', status: V, notes: 'Session validate + catalogs summary' },
      { code: 'ORDER_READ', status: V, notes: 'GraphQL ListOrders / order detail' },
      { code: 'PRODUCT_READ', status: V, notes: 'Vendor catalog (often needs extension)' },
      { code: 'CATEGORY_READ', status: V },
      { code: 'BULK_SYNC', status: V },
      { code: 'WEBHOOK_REGISTER', status: V },
      { code: 'WEBHOOK_RECEIVE', status: V },
      { code: 'ORDER_ACCEPT', status: V, notes: 'Partner API PUT → READY_FOR_PICKUP / DISPATCHED' },
      { code: 'ORDER_UPDATE', status: V, notes: 'Partner API PUT UPDATE_CART' },
      { code: 'ORDER_CANCEL', status: V, notes: 'Partner API PUT CANCELLED' },
      { code: 'ORDER_STATUS_UPDATE', status: V, notes: 'Partner API PUT status (needs clientId/secret/chainId)' },
      { code: 'LOCATION_READ', status: V, notes: 'GET opening_times_global.data' },
      { code: 'LOCATION_UPDATE', status: V, notes: 'PUT opening_times_global' },
      { code: 'LOCATION_STATUS_UPDATE', status: V, notes: 'PUT /availability open|closed' },
      { code: 'PRODUCT_CREATE', status: V, notes: 'POST catalogs/products + command poll' },
      { code: 'PRODUCT_UPDATE', status: V, notes: 'PUT/PATCH/DELETE product, availability, image, translate' },
      { code: 'CATEGORY_WRITE', status: V, notes: 'Create/update/delete catalog categories' },
      { code: 'REPORT_READ', status: V, notes: 'Performance + GraphQL sales/ops/reviews' },
      { code: 'SETTLEMENT_READ', status: V, notes: 'GraphQL ListPayouts' },
      { code: 'PROMOTION_READ', status: U },
      { code: 'PROMOTION_WRITE', status: U },
      { code: 'DRIVER_CREATE', status: N },
      { code: 'DRIVER_UPDATE', status: N },
      { code: 'DRIVER_READ', status: N },
    ],
  },
  {
    code: 'THE_CHEFZ',
    name: 'The Chefz',
    category: 'DELIVERY',
    apiAvailability: 'UNVERIFIED_PUBLICLY',
    caps: [
      { code: 'ACCOUNT_READ', status: U, notes: 'Awaiting official API package' },
      { code: 'LOCATION_READ', status: U },
      { code: 'ORDER_READ', status: U },
    ],
  },
  {
    code: 'TOYOU',
    name: 'ToYou',
    category: 'DELIVERY',
    apiAvailability: 'UNVERIFIED_PUBLICLY',
    caps: [
      { code: 'ORDER_READ', status: V, notes: 'Merchant JWT /delivery/v1/merchant/orders' },
      { code: 'PRODUCT_READ', status: V },
      { code: 'CATEGORY_READ', status: V, notes: 'Mapped from merchant groups' },
      { code: 'BULK_SYNC', status: V },
      { code: 'WEBHOOK_RECEIVE', status: U },
      { code: 'ACCOUNT_READ', status: U },
    ],
  },
  {
    code: 'MRSOOL',
    name: 'Mrsool',
    category: 'DELIVERY',
    apiAvailability: 'PRIVATE_CONFIRMED',
    caps: [
      { code: 'ORDER_READ', status: P, notes: 'Via extension bridge mrsool_rest' },
      { code: 'PRODUCT_READ', status: P },
      { code: 'PRODUCT_UPDATE', status: P, notes: 'enable/disable menu item' },
      { code: 'CATEGORY_READ', status: P },
      { code: 'BULK_SYNC', status: P },
      { code: 'LOCATION_READ', status: U },
      { code: 'DRIVER_CREATE', status: U },
    ],
  },
  {
    code: 'NINJA',
    name: 'Ninja',
    category: 'DELIVERY',
    apiAvailability: 'PARTNER_PORTAL',
    caps: [
      { code: 'ORDER_READ', status: V },
      { code: 'PRODUCT_READ', status: V },
      { code: 'CATEGORY_READ', status: V },
      { code: 'BULK_SYNC', status: V },
      { code: 'PRODUCT_UPDATE', status: U, notes: 'Branch availability ops deferred' },
      { code: 'LOCATION_READ', status: U },
      { code: 'DRIVER_CREATE', status: N },
      { code: 'DRIVER_READ', status: U },
      { code: 'DRIVER_UPDATE', status: N },
    ],
  },
  {
    code: 'JAHEZ',
    name: 'Jahez',
    category: 'DELIVERY',
    apiAvailability: 'PARTNER_PORTAL',
    requiresApproval: true,
    caps: [
      { code: 'ACCOUNT_READ', status: P, notes: 'Activate after Jahez onboarding' },
      { code: 'LOCATION_READ', status: P },
      { code: 'PRODUCT_READ', status: P },
      { code: 'ORDER_READ', status: P },
      { code: 'ORDER_ACCEPT', status: P },
      { code: 'WEBHOOK_RECEIVE', status: P },
      { code: 'BULK_SYNC', status: P },
    ],
  },
  {
    code: 'KEETA',
    name: 'Keeta',
    category: 'DELIVERY',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    requiresApproval: true,
    caps: [
      { code: 'ACCOUNT_READ', status: P, notes: 'Scaffold only until OAuth/SIT credentials' },
      { code: 'LOCATION_READ', status: P },
      { code: 'LOCATION_UPDATE', status: P },
      { code: 'LOCATION_STATUS_UPDATE', status: P },
      { code: 'PRODUCT_READ', status: P },
      { code: 'PRODUCT_UPDATE', status: P },
      { code: 'CATEGORY_READ', status: P },
      { code: 'ORDER_READ', status: P },
      { code: 'ORDER_CANCEL', status: P },
      { code: 'ORDER_STATUS_UPDATE', status: P },
      { code: 'WEBHOOK_REGISTER', status: P },
      { code: 'WEBHOOK_RECEIVE', status: P },
      { code: 'BULK_SYNC', status: P },
      { code: 'DRIVER_CREATE', status: N },
    ],
  },
  {
    code: 'SHGARDI',
    name: 'Shgardi',
    category: 'DELIVERY',
    apiAvailability: 'UNVERIFIED_PUBLICLY',
    caps: [
      { code: 'TRACKING_READ', status: U, notes: 'Partner-app evidence only, not API' },
      { code: 'DRIVER_READ', status: U },
      { code: 'FULFILLMENT_READ', status: U },
    ],
  },
  {
    code: 'TABBY',
    name: 'Tabby',
    category: 'INSTALLMENT',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    caps: [
      { code: 'PAYMENT_READ', status: V, notes: 'List payments sync' },
      { code: 'PAYMENT_CAPTURE', status: V },
      { code: 'PAYMENT_REFUND', status: V },
      { code: 'PAYMENT_CLOSE', status: V },
      { code: 'BULK_SYNC', status: V },
      { code: 'WEBHOOK_REGISTER', status: V },
      { code: 'WEBHOOK_RECEIVE', status: V },
      { code: 'CHECKOUT_CREATE', status: U, notes: 'Not exposed as adapter op yet' },
      { code: 'DISPUTE_READ', status: U },
      { code: 'DISPUTE_RESPOND', status: U },
    ],
  },
  {
    code: 'TAMARA',
    name: 'Tamara',
    category: 'INSTALLMENT',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    caps: [
      { code: 'PAYMENT_AUTHORIZE', status: V },
      { code: 'PAYMENT_CAPTURE', status: V },
      { code: 'PAYMENT_CANCEL', status: V },
      { code: 'PAYMENT_READ', status: V, notes: 'Webhook-driven; list sync returns empty' },
      { code: 'PAYMENT_REFUND', status: V },
      { code: 'WEBHOOK_REGISTER', status: V },
      { code: 'WEBHOOK_RECEIVE', status: V },
      { code: 'CHECKOUT_CREATE', status: U },
      { code: 'DISPUTE_READ', status: U },
      { code: 'SETTLEMENT_READ', status: U },
      { code: 'BULK_SYNC', status: U, notes: 'No list-all; webhook primary' },
    ],
  },
  {
    code: 'MADFU',
    name: 'Madfu',
    category: 'INSTALLMENT',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    caps: [
      {
        code: 'CHECKOUT_CREATE',
        status: V,
        notes: 'shareOrder operation',
      },
      { code: 'PAYMENT_READ', status: V, notes: 'OrderGet_OnlinePayment status poll' },
      { code: 'PAYMENT_CANCEL', status: V },
      { code: 'PAYMENT_REFUND', status: V },
      { code: 'WEBHOOK_RECEIVE', status: V },
      { code: 'BULK_SYNC', status: V, notes: 'Refreshes known installment mirrors only' },
    ],
  },
  {
    code: 'MIS_PAY',
    name: 'MIS Pay',
    category: 'INSTALLMENT',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    caps: [
      { code: 'CHECKOUT_CREATE', status: U, notes: 'Docs exist; connector not ported' },
      { code: 'PAYMENT_READ', status: U },
      { code: 'TRACKING_READ', status: U },
      { code: 'PAYMENT_REFUND', status: U },
      { code: 'DISPUTE_READ', status: U },
      { code: 'SETTLEMENT_READ', status: U },
    ],
  },
  {
    code: 'EMKAN',
    name: 'Emkan',
    category: 'INSTALLMENT',
    apiAvailability: 'PARTNER_PORTAL',
    requiresApproval: true,
    caps: [
      { code: 'CHECKOUT_CREATE', status: P, notes: 'Account-gated developer tools' },
      { code: 'PAYMENT_READ', status: P },
      { code: 'WEBHOOK_RECEIVE', status: P },
    ],
  },
  {
    code: 'ZID',
    name: 'Zid',
    category: 'ECOMMERCE',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    caps: [
      { code: 'ORDER_READ', status: V },
      { code: 'ORDER_UPDATE', status: V },
      { code: 'ORDER_STATUS_UPDATE', status: V },
      { code: 'PRODUCT_READ', status: V },
      { code: 'PRODUCT_UPDATE', status: V },
      { code: 'CATEGORY_READ', status: V },
      { code: 'BULK_SYNC', status: V },
      { code: 'WEBHOOK_REGISTER', status: V },
      { code: 'WEBHOOK_RECEIVE', status: V },
      { code: 'PRODUCT_CREATE', status: U },
      { code: 'INVENTORY_READ', status: U },
      { code: 'INVENTORY_UPDATE', status: U },
      { code: 'LOCATION_READ', status: U },
      { code: 'CUSTOMER_READ', status: U },
      { code: 'PROMOTION_READ', status: U },
      { code: 'PROMOTION_WRITE', status: U },
      { code: 'FULFILLMENT_READ', status: U },
      { code: 'FULFILLMENT_UPDATE', status: U },
    ],
  },
  {
    code: 'SALLA',
    name: 'Salla',
    category: 'ECOMMERCE',
    apiAvailability: 'PUBLIC_DOCUMENTED',
    caps: [
      { code: 'PRODUCT_READ', status: V },
      { code: 'PRODUCT_UPDATE', status: V },
      { code: 'BULK_SYNC', status: V },
      { code: 'WEBHOOK_REGISTER', status: V },
      { code: 'WEBHOOK_RECEIVE', status: V },
      { code: 'ORDER_READ', status: U, notes: 'Order sync not implemented yet' },
      { code: 'ORDER_UPDATE', status: U },
      { code: 'INVENTORY_READ', status: U },
      { code: 'CUSTOMER_READ', status: U },
      { code: 'PROMOTION_READ', status: U },
      { code: 'FULFILLMENT_READ', status: U },
      { code: 'FULFILLMENT_UPDATE', status: U },
      { code: 'CHECKOUT_CREATE', status: U },
    ],
  },
];

async function seedIntegrationCatalog(prisma: PrismaClient) {
  const categories = [
    { code: 'DELIVERY', name: 'التوصيل' },
    { code: 'INSTALLMENT', name: 'التقسيط' },
    { code: 'ECOMMERCE', name: 'التجارة الإلكترونية' },
  ];

  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.platformCategory.upsert({
      where: { code: category.code },
      update: { name: category.name, isActive: true },
      create: category,
    });
    categoryIds.set(category.code, saved.id);
  }

  const capabilityIds = new Map<string, string>();
  for (const cap of CAPABILITIES) {
    const saved = await prisma.capability.upsert({
      where: { code: cap.code },
      update: {
        name: cap.name,
        entityType: cap.entityType,
        direction: cap.direction,
      },
      create: cap,
    });
    capabilityIds.set(cap.code, saved.id);
  }

  for (const provider of PROVIDERS) {
    const categoryId = categoryIds.get(provider.category);
    if (!categoryId) {
      throw new Error(`Missing category ${provider.category}`);
    }

    const saved = await prisma.platformProvider.upsert({
      where: { code: provider.code },
      update: {
        name: provider.name,
        categoryId,
        apiAvailability: provider.apiAvailability,
        officialDocsUrl: provider.officialDocsUrl ?? null,
        requiresApproval: provider.requiresApproval ?? false,
        isActive: true,
      },
      create: {
        code: provider.code,
        name: provider.name,
        categoryId,
        apiAvailability: provider.apiAvailability,
        officialDocsUrl: provider.officialDocsUrl,
        requiresApproval: provider.requiresApproval ?? false,
      },
    });

    for (const cap of provider.caps) {
      const capabilityId = capabilityIds.get(cap.code);
      if (!capabilityId) {
        throw new Error(`Missing capability ${cap.code}`);
      }
      await prisma.providerCapability.upsert({
        where: {
          providerId_capabilityId: {
            providerId: saved.id,
            capabilityId,
          },
        },
        update: {
          supportStatus: cap.status,
          requiredScope: cap.requiredScope ?? null,
          notes: cap.notes ?? null,
          sourceUrl: cap.sourceUrl ?? null,
          verifiedAt:
            cap.status === 'VERIFIED' || cap.status === 'PARTNER_ENABLED'
              ? new Date('2026-07-25')
              : null,
        },
        create: {
          providerId: saved.id,
          capabilityId,
          supportStatus: cap.status,
          requiredScope: cap.requiredScope,
          notes: cap.notes,
          sourceUrl: cap.sourceUrl,
          verifiedAt:
            cap.status === 'VERIFIED' || cap.status === 'PARTNER_ENABLED'
              ? new Date('2026-07-25')
              : null,
        },
      });
    }
  }

  const activeCodes = new Set(PROVIDERS.map((provider) => provider.code));
  await prisma.platformProvider.updateMany({
    where: { code: { notIn: [...activeCodes] } },
    data: { isActive: false },
  });
}

async function seedPaymentGateways(prisma: PrismaClient) {
  const gateways = [
    {
      code: 'STRIPE',
      name: 'Stripe',
      providerType: 'GLOBAL' as const,
      countryCodes: ['*'],
      supportsCurrencies: ['USD', 'EUR', 'SAR', 'AED', 'GBP'],
      docsUrl: 'https://docs.stripe.com/payments',
      sortOrder: 1,
    },
    {
      code: 'PAYPAL',
      name: 'PayPal',
      providerType: 'GLOBAL' as const,
      countryCodes: ['*'],
      supportsCurrencies: ['USD', 'EUR', 'SAR', 'AED', 'GBP'],
      docsUrl: 'https://developer.paypal.com/docs/checkout/',
      sortOrder: 2,
    },
  ];

  for (const gateway of gateways) {
    await prisma.paymentGateway.upsert({
      where: { code: gateway.code },
      update: {
        name: gateway.name,
        providerType: gateway.providerType,
        countryCodes: gateway.countryCodes,
        supportsCurrencies: gateway.supportsCurrencies,
        docsUrl: gateway.docsUrl,
        isActive: true,
        sortOrder: gateway.sortOrder,
      },
      create: gateway,
    });
  }
}

async function main() {
  const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST!,
    port: Number(process.env.DATABASE_PORT ?? 3307),
    user: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    database: process.env.DATABASE_NAME!,
  });
  const prisma = new PrismaClient({ adapter });

  for (const role of ROLE_CODES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, scope: role.scope, isSystem: true },
      create: role,
    });
  }

  for (const [module, action] of PERMISSIONS) {
    const code = `${module}.${action}`;
    await prisma.permission.upsert({
      where: { code },
      update: { module, action },
      create: { code, module, action, description: `${action} ${module}` },
    });
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    for (const permissionCode of permissionCodes) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { code: permissionCode },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const plans = [
    {
      code: 'BASIC',
      name: 'Basic',
      billingInterval: 'MONTHLY' as const,
      price: '99.00',
      currency: 'USD',
      sortOrder: 1,
      features: [
        { featureCode: 'USER_LIMIT', isEnabled: true, limitValue: 5 },
        { featureCode: 'PROJECT_LIMIT', isEnabled: true, limitValue: 2 },
        { featureCode: 'AI_ASSISTANT', isEnabled: false, limitValue: null },
      ],
    },
    {
      code: 'BUSINESS',
      name: 'Business',
      billingInterval: 'MONTHLY' as const,
      price: '249.00',
      currency: 'USD',
      sortOrder: 2,
      features: [
        { featureCode: 'USER_LIMIT', isEnabled: true, limitValue: 25 },
        { featureCode: 'PROJECT_LIMIT', isEnabled: true, limitValue: 20 },
        { featureCode: 'AI_ASSISTANT', isEnabled: false, limitValue: null },
      ],
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      billingInterval: 'YEARLY' as const,
      price: '0.00',
      currency: 'USD',
      sortOrder: 3,
      features: [
        { featureCode: 'USER_LIMIT', isEnabled: true, limitValue: 500 },
        { featureCode: 'PROJECT_LIMIT', isEnabled: true, limitValue: 1000 },
        { featureCode: 'AI_ASSISTANT', isEnabled: true, limitValue: null },
      ],
    },
  ];

  for (const plan of plans) {
    const saved = await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        billingInterval: plan.billingInterval,
        price: plan.price,
        currency: plan.currency,
        isActive: true,
        sortOrder: plan.sortOrder,
      },
      create: {
        code: plan.code,
        name: plan.name,
        billingInterval: plan.billingInterval,
        price: plan.price,
        currency: plan.currency,
        sortOrder: plan.sortOrder,
      },
    });

    for (const feature of plan.features) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureCode: {
            planId: saved.id,
            featureCode: feature.featureCode,
          },
        },
        update: {
          isEnabled: feature.isEnabled,
          limitValue: feature.limitValue,
        },
        create: {
          planId: saved.id,
          featureCode: feature.featureCode,
          isEnabled: feature.isEnabled,
          limitValue: feature.limitValue,
        },
      });
    }
  }

  await seedIntegrationCatalog(prisma);
  await seedPaymentGateways(prisma);

  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@saas-erp.local' },
    update: {
      fullName: 'Platform Admin',
      passwordHash,
      isPlatformAdmin: true,
      status: 'ACTIVE',
    },
    create: {
      fullName: 'Platform Admin',
      email: 'admin@saas-erp.local',
      passwordHash,
      isPlatformAdmin: true,
      status: 'ACTIVE',
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: 'demo-co' },
    update: {
      legalName: 'Demo Company LLC',
      displayName: 'Demo Co',
      status: 'ACTIVE',
      businessCategory: 'ECOMMERCE',
    },
    create: {
      legalName: 'Demo Company LLC',
      displayName: 'Demo Co',
      slug: 'demo-co',
      businessCategory: 'ECOMMERCE',
      defaultCurrency: 'SAR',
      timezone: 'Asia/Riyadh',
      countryCode: 'SA',
      settings: { create: {} },
    },
  });

  const enterprisePlan = await prisma.plan.findUniqueOrThrow({
    where: { code: 'ENTERPRISE' },
  });
  const existingSub = await prisma.subscription.findFirst({
    where: { companyId: company.id, status: { in: ['ACTIVE', 'TRIALING'] } },
  });
  if (!existingSub) {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setFullYear(endsAt.getFullYear() + 1);
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: enterprisePlan.id,
        status: 'ACTIVE',
        startsAt,
        endsAt,
        activeCompanyId: company.id,
      },
    });
  } else if (existingSub.planId !== enterprisePlan.id) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { planId: enterprisePlan.id },
    });
  }

  const defaultExpenseCategories = [
    { code: 'OPS', name: 'Operations' },
    { code: 'MKT', name: 'Marketing' },
    { code: 'RENT', name: 'Rent & Utilities' },
    { code: 'SAL', name: 'Salaries' },
    { code: 'MISC', name: 'Miscellaneous' },
  ];
  for (const category of defaultExpenseCategories) {
    const existing = await prisma.expenseCategory.findFirst({
      where: { companyId: company.id, codeKey: category.code },
    });
    if (!existing) {
      await prisma.expenseCategory.create({
        data: {
          companyId: company.id,
          code: category.code,
          codeKey: category.code,
          name: category.name,
        },
      });
    }
  }

  const defaultUnits = [
    { code: 'PCS', name: 'Pieces', decimalPlaces: 0 },
    { code: 'KG', name: 'Kilogram', decimalPlaces: 3 },
    { code: 'M', name: 'Meter', decimalPlaces: 2 },
  ];
  for (const unit of defaultUnits) {
    const existing = await prisma.unit.findFirst({
      where: { companyId: company.id, code: unit.code },
    });
    if (!existing) {
      await prisma.unit.create({
        data: {
          companyId: company.id,
          code: unit.code,
          name: unit.name,
          decimalPlaces: unit.decimalPlaces,
        },
      });
    }
  }

  let defaultPipeline = await prisma.crmPipeline.findFirst({
    where: { companyId: company.id, isDefault: true },
  });
  if (!defaultPipeline) {
    defaultPipeline = await prisma.crmPipeline.create({
      data: {
        companyId: company.id,
        name: 'Default Pipeline',
        isDefault: true,
        defaultCompanyId: company.id,
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
    });
  }

  const mainWarehouse = await prisma.warehouse.findFirst({
    where: { companyId: company.id, code: 'MAIN' },
  });
  if (!mainWarehouse) {
    await prisma.warehouse.create({
      data: {
        companyId: company.id,
        code: 'MAIN',
        name: 'Main Warehouse',
      },
    });
  }

  const demoSummary = await seedDemoCompanyData({
    prisma,
    companyId: company.id,
    adminUserId: admin.id,
  });

  console.log('Seed complete');
  console.log('  admin email: admin@saas-erp.local');
  console.log('  admin password: Admin123!');
  console.log('  demo company:', company.id);
  console.log('  demo plan: ENTERPRISE');
  console.log('  providers:', PROVIDERS.length);
  console.log('  demo summary:', demoSummary);
  console.log('  demo users password: Admin123! (owner@demo-co.local, etc.)');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
