import type { CredentialPayload } from '../../effective-capability.service';
import type {
  MirrorCategoryInput,
  MirrorCustomerInput,
  MirrorInstallmentInput,
  MirrorOrderInput,
  MirrorProductInput,
  MirrorPromotionInput,
  MirrorSettlementInput,
} from '../../mirrors/mirror-upsert.service';

export type AdapterAuthContext = {
  connectedProjectId: string;
  providerCode: string;
  credentials: CredentialPayload;
  environment: string;
};

export type AdapterSyncContext = AdapterAuthContext & {
  entityType: string;
  cursor: string | null;
  fullSync: boolean;
};

export type AdapterSyncItem = {
  externalId: string;
  name?: string;
  code?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  city?: string | null;
  addressLine?: string | null;
  timezone?: string | null;
  rawPayload: Record<string, unknown>;
};

export type AdapterSyncResult = {
  items: AdapterSyncItem[];
  categories?: MirrorCategoryInput[];
  products?: MirrorProductInput[];
  customers?: MirrorCustomerInput[];
  orders?: MirrorOrderInput[];
  promotions?: MirrorPromotionInput[];
  settlements?: MirrorSettlementInput[];
  installments?: MirrorInstallmentInput[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type AdapterOperationContext = AdapterAuthContext & {
  capabilityCode: string;
  operationType: string;
  externalTargetId: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
};

export type AdapterOperationResult = {
  responseExternalId?: string | null;
  rawResponse?: Record<string, unknown>;
};

export type AdapterWebhookContext = AdapterAuthContext & {
  eventType: string;
  payload: Record<string, unknown>;
  providerEventId: string | null;
};

export type AdapterWebhookResult = {
  entityType?: string;
  items?: AdapterSyncItem[];
  categories?: MirrorCategoryInput[];
  products?: MirrorProductInput[];
  customers?: MirrorCustomerInput[];
  orders?: MirrorOrderInput[];
  promotions?: MirrorPromotionInput[];
  settlements?: MirrorSettlementInput[];
  installments?: MirrorInstallmentInput[];
  ignored?: boolean;
  reason?: string;
};

export interface ProviderAdapter {
  readonly providerCode: string;
  testAuth(ctx: AdapterAuthContext): Promise<boolean>;
  syncEntity(ctx: AdapterSyncContext): Promise<AdapterSyncResult>;
  executeOperation(
    ctx: AdapterOperationContext,
  ): Promise<AdapterOperationResult>;
  processWebhook(ctx: AdapterWebhookContext): Promise<AdapterWebhookResult>;
  verifyWebhookSignature?(input: {
    rawBody: string;
    signatureHeader: string | undefined;
    credentials: CredentialPayload;
  }): boolean;
}
