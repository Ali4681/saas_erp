import type { AuthUser } from '../../common/auth/auth.decorators';

/** Granular POS / cashier screen operations (RBAC). */
export const POS_ROLE_OPS = [
  'pos.invoice_create',
  'pos.quick_invoice',
  'pos.quote_create',
  'pos.quote_delete',
  'pos.quote_convert',
  'pos.invoice_send_whatsapp',
  'pos.quote_send_whatsapp',
] as const;

export type PosRoleOp = (typeof POS_ROLE_OPS)[number];

/** Open the POS terminal (catalog / cart). */
export const POS_TERMINAL_ACCESS = [
  'sales.write',
  ...POS_ROLE_OPS,
] as const;

export type PosRoleOpsFlags = {
  invoiceCreate: boolean;
  quickInvoice: boolean;
  quoteCreate: boolean;
  quoteDelete: boolean;
  quoteConvert: boolean;
  invoiceSendWhatsapp: boolean;
  quoteSendWhatsapp: boolean;
};

function has(user: AuthUser, code: string): boolean {
  if (user.isPlatformAdmin) return true;
  return (user.permissions ?? []).includes(code);
}

/** Full sales writers (owner/admin) get every POS operation. */
export function hasFullSalesWrite(user: AuthUser): boolean {
  return has(user, 'sales.write');
}

export function resolvePosRoleOps(user: AuthUser): PosRoleOpsFlags {
  const full = hasFullSalesWrite(user);
  return {
    invoiceCreate: full || has(user, 'pos.invoice_create'),
    quickInvoice: full || has(user, 'pos.quick_invoice'),
    quoteCreate: full || has(user, 'pos.quote_create'),
    quoteDelete: full || has(user, 'pos.quote_delete'),
    quoteConvert: full || has(user, 'pos.quote_convert'),
    invoiceSendWhatsapp: full || has(user, 'pos.invoice_send_whatsapp'),
    quoteSendWhatsapp: full || has(user, 'pos.quote_send_whatsapp'),
  };
}

export function canAccessPosTerminal(user: AuthUser): boolean {
  if (user.isPlatformAdmin) return true;
  if (hasFullSalesWrite(user)) return true;
  return POS_ROLE_OPS.some((code) => has(user, code));
}
