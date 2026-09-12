/** Cashier capability matrix for POS terminal (stored on PosCashier / company defaults). */

export type PosCashierPermissions = {
  priceOverride: boolean;
  priceOverrideMaxPct: number;
  discounts: boolean;
  discountMaxPct: number;
  voidBeforeSave: boolean;
  returns: boolean;
  creditSales: boolean;
  giftCards: boolean;
  openCashDrawer: boolean;
  holdRetrieve: boolean;
  holdSeeOthers: boolean;
  shiftClose: boolean;
  reprint: boolean;
  customerAssign: boolean;
  multiCurrency: boolean;
};

export const DEFAULT_POS_CASHIER_PERMISSIONS: PosCashierPermissions = {
  priceOverride: false,
  priceOverrideMaxPct: 0,
  discounts: false,
  discountMaxPct: 5,
  voidBeforeSave: true,
  returns: false,
  creditSales: false,
  giftCards: false,
  openCashDrawer: false,
  holdRetrieve: true,
  holdSeeOthers: false,
  shiftClose: false,
  reprint: true,
  customerAssign: true,
  multiCurrency: false,
};

/** Supervisor defaults — broader operational control. */
export const SUPERVISOR_POS_PERMISSIONS: PosCashierPermissions = {
  ...DEFAULT_POS_CASHIER_PERMISSIONS,
  priceOverride: true,
  priceOverrideMaxPct: 20,
  discounts: true,
  discountMaxPct: 25,
  returns: true,
  creditSales: true,
  giftCards: true,
  openCashDrawer: true,
  holdSeeOthers: true,
  shiftClose: true,
};

export function mergePosPermissions(
  raw: unknown,
  base: PosCashierPermissions = DEFAULT_POS_CASHIER_PERMISSIONS,
): PosCashierPermissions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...base };
  }
  const bag = raw as Record<string, unknown>;
  const out: PosCashierPermissions = { ...base };
  for (const key of Object.keys(base) as Array<keyof PosCashierPermissions>) {
    if (!(key in bag)) continue;
    const val = bag[key];
    if (typeof base[key] === 'boolean' && typeof val === 'boolean') {
      out[key] = val as never;
    } else if (typeof base[key] === 'number' && typeof val === 'number') {
      out[key] = val as never;
    }
  }
  return out;
}
