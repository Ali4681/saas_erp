import type { AuthUser } from "@/lib/types/auth";

export const POS_ROLE_OPS = [
  "pos.invoice_create",
  "pos.quick_invoice",
  "pos.quote_create",
  "pos.quote_delete",
  "pos.quote_convert",
  "pos.invoice_send_whatsapp",
  "pos.quote_send_whatsapp",
] as const;

export type PosRoleOp = (typeof POS_ROLE_OPS)[number];

export type PosRoleOpsFlags = {
  invoiceCreate: boolean;
  quickInvoice: boolean;
  quoteCreate: boolean;
  quoteDelete: boolean;
  quoteConvert: boolean;
  invoiceSendWhatsapp: boolean;
  quoteSendWhatsapp: boolean;
};

/** Roles that use the employee portal + POS only (not full ERP). */
export const POS_PORTAL_ROLE_CODES = [
  "CASHIER",
  "SALES_REP",
  "POS_MARKETER",
] as const;

function userCan(user: AuthUser | null | undefined, code: string): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  return (user.permissions ?? []).includes(code);
}

function userCanAny(
  user: AuthUser | null | undefined,
  ...codes: string[]
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  const set = new Set(user.permissions ?? []);
  return codes.some((c) => set.has(c));
}

export function isPosPortalRoleCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const upper = code.toUpperCase();
  if ((POS_PORTAL_ROLE_CODES as readonly string[]).includes(upper)) {
    return true;
  }
  return POS_PORTAL_ROLE_CODES.some(
    (r) => upper.endsWith(`_${r}`) || upper === r,
  );
}

export function canAccessPos(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  return userCan(user, "sales.write") || userCanAny(user, ...POS_ROLE_OPS);
}

export function resolvePosRoleOps(
  user: AuthUser | null | undefined,
  fromBoot?: Partial<PosRoleOpsFlags> | null,
): PosRoleOpsFlags {
  if (fromBoot) {
    return {
      invoiceCreate: !!fromBoot.invoiceCreate,
      quickInvoice: !!fromBoot.quickInvoice,
      quoteCreate: !!fromBoot.quoteCreate,
      quoteDelete: !!fromBoot.quoteDelete,
      quoteConvert: !!fromBoot.quoteConvert,
      invoiceSendWhatsapp: !!fromBoot.invoiceSendWhatsapp,
      quoteSendWhatsapp: !!fromBoot.quoteSendWhatsapp,
    };
  }
  const full = userCan(user, "sales.write");
  return {
    invoiceCreate: full || userCan(user, "pos.invoice_create"),
    quickInvoice: full || userCan(user, "pos.quick_invoice"),
    quoteCreate: full || userCan(user, "pos.quote_create"),
    quoteDelete: full || userCan(user, "pos.quote_delete"),
    quoteConvert: full || userCan(user, "pos.quote_convert"),
    invoiceSendWhatsapp: full || userCan(user, "pos.invoice_send_whatsapp"),
    quoteSendWhatsapp: full || userCan(user, "pos.quote_send_whatsapp"),
  };
}
