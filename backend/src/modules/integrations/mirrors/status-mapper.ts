import {
  FinancialStatus,
  FulfillmentStatus,
  InstallmentStatus,
  NormalizedOrderStatus,
  RecordStatus,
  RefundStatus,
  SettlementStatus,
  DisputeStatus,
} from '../../../generated/prisma/client';

const ORDER_STATUSES = new Set<string>(Object.values(NormalizedOrderStatus));
const FINANCIAL_STATUSES = new Set<string>(Object.values(FinancialStatus));
const FULFILLMENT_STATUSES = new Set<string>(Object.values(FulfillmentStatus));
const REFUND_STATUSES = new Set<string>(Object.values(RefundStatus));
const SETTLEMENT_STATUSES = new Set<string>(Object.values(SettlementStatus));
const INSTALLMENT_STATUSES = new Set<string>(Object.values(InstallmentStatus));
const DISPUTE_STATUSES = new Set<string>(Object.values(DisputeStatus));
const RECORD_STATUSES = new Set<string>(Object.values(RecordStatus));

function normalizeKey(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function mapOrderStatus(
  raw: string | null | undefined,
): NormalizedOrderStatus {
  if (!raw) return NormalizedOrderStatus.UNKNOWN;
  const key = normalizeKey(raw);
  if (ORDER_STATUSES.has(key)) {
    return key as NormalizedOrderStatus;
  }

  // Provider-native aliases → ERP normalized enum
  const aliases: Record<string, NormalizedOrderStatus> = {
    RECEIVED: NormalizedOrderStatus.PENDING,
    READY_FOR_PICKUP: NormalizedOrderStatus.READY,
    DISPATCHED: NormalizedOrderStatus.IN_DELIVERY,
    CANCELED: NormalizedOrderStatus.CANCELLED,
    CANCELLED: NormalizedOrderStatus.CANCELLED,
    ACCEPTED: NormalizedOrderStatus.CONFIRMED,
    NEW: NormalizedOrderStatus.PENDING,
    DELIVERING: NormalizedOrderStatus.IN_DELIVERY,
  };
  return aliases[key] ?? NormalizedOrderStatus.UNKNOWN;
}

export function mapFinancialStatus(
  raw: string | null | undefined,
): FinancialStatus | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  return FINANCIAL_STATUSES.has(key)
    ? (key as FinancialStatus)
    : FinancialStatus.UNKNOWN;
}

export function mapFulfillmentStatus(
  raw: string | null | undefined,
): FulfillmentStatus | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  return FULFILLMENT_STATUSES.has(key)
    ? (key as FulfillmentStatus)
    : FulfillmentStatus.UNKNOWN;
}

export function mapRefundStatus(raw: string | null | undefined): RefundStatus {
  if (!raw) return RefundStatus.PENDING;
  const key = normalizeKey(raw);
  return REFUND_STATUSES.has(key)
    ? (key as RefundStatus)
    : RefundStatus.PENDING;
}

export function mapSettlementStatus(
  raw: string | null | undefined,
): SettlementStatus {
  if (!raw) return SettlementStatus.PENDING;
  const key = normalizeKey(raw);
  return SETTLEMENT_STATUSES.has(key)
    ? (key as SettlementStatus)
    : SettlementStatus.PENDING;
}

export function mapInstallmentStatus(
  raw: string | null | undefined,
): InstallmentStatus {
  if (!raw) return InstallmentStatus.UNKNOWN;
  const key = normalizeKey(raw);
  return INSTALLMENT_STATUSES.has(key)
    ? (key as InstallmentStatus)
    : InstallmentStatus.UNKNOWN;
}

export function mapDisputeStatus(
  raw: string | null | undefined,
): DisputeStatus {
  if (!raw) return DisputeStatus.OPEN;
  const key = normalizeKey(raw);
  return DISPUTE_STATUSES.has(key)
    ? (key as DisputeStatus)
    : DisputeStatus.OPEN;
}

export function mapRecordStatus(raw: string | null | undefined): RecordStatus {
  if (!raw) return RecordStatus.ACTIVE;
  const key = normalizeKey(raw);
  return RECORD_STATUSES.has(key) ? (key as RecordStatus) : RecordStatus.ACTIVE;
}
