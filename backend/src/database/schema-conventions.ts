/**
 * Locked schema conventions for the SaaS ERP MySQL schema.
 */
export const SCHEMA_CONVENTIONS = {
  primaryKey: {
    type: 'Char(36)',
    default: 'uuid(7)',
    reason: 'UUIDv7 is time-ordered; safer for InnoDB clustered PK inserts than UUIDv4',
  },
  naming: {
    prismaFields: 'camelCase',
    databaseColumns: 'snake_case via @map / @@map',
  },
  timestamps: {
    type: 'DateTime(3)',
    timezone: 'UTC stored; company timezone is presentation-only',
  },
  money: {
    type: 'Decimal(18, 2)',
    never: 'Float / Double',
  },
  enums: {
    style: 'native MySQL ENUM via Prisma enum',
  },
  softDelete: {
    pattern: 'deletedAt + deletedMarker',
    uniqueKey: 'include deletedMarker so soft-deleted rows release business codes',
  },
  appendOnly: {
    pattern: '@@id([id, createdAt])',
    reason: 'MySQL requires partition key in every unique key for RANGE partitioning',
  },
  checkConstraints:
    'Hand-written migration SQL survives prisma migrate dev; also validate in app',
  fulltextIndexes:
    'Must use @@fulltext in Prisma schema — raw FULLTEXT is dropped on next migrate',
} as const;

/** Prisma model names that require company_id tenant scoping. */
export const TENANT_OWNED_MODELS = new Set<string>([
  'SandboxItem',
  'CompanyBranch',
  'CompanyDepartment',
  'CompanyUser',
  'CompanySettings',
  'Subscription',
  'Notification',
  'UserPushDevice',
  'ConnectedProject',
  'BankAccount',
  'ExpenseCategory',
  'Expense',
  'FinancialTransaction',
  'CrmContact',
  'CrmPipeline',
  'CrmOpportunity',
  'CrmActivity',
  'CrmContract',
  'SalesQuote',
  'SalesInvoice',
  'SalesPayment',
  'SalesCreditNote',
  'Supplier',
  'PurchaseOrder',
  'SupplierBill',
  'SupplierPayment',
  'ItemCategory',
  'Unit',
  'Item',
  'Warehouse',
  'StockMovement',
  'StockCount',
  'Employee',
  'AttendanceRecord',
  'LeaveRequest',
  'PayrollRun',
  'WorkProject',
  'AutomationRule',
  'MarketingPost',
  'MarketingPostMedia',
  'MarketingPlatformConnection',
  'Attachment',
  'AiUsageLog',
  'NotebookCategory',
  'BusinessNote',
  'CompanyApiKey',
  'ApiRequestLog',
  'CompanyWebhook',
  'MessagingChannel',
  'MessageTemplate',
  'MessageDelivery',
  'CompanyPaymentMethod',
]);

/** Prisma model names that must never be updated or deleted. */
export const APPEND_ONLY_MODELS = new Set<string>([
  'SandboxAuditLog',
  'AuditLog',
  'ExternalOrderStatusHistory',
  'InstallmentEvent',
  'StockMovement',
  'AutomationRun',
  'AiUsageLog',
  'BusinessNoteRevision',
  'ApiRequestLog',
  'WebhookDelivery',
  'MessageDelivery',
]);
