"use server";

import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";

export type PosTerminalLayout = {
  accentColor?: string | null;
  categoryOrder: string[];
  pinnedItemIds: string[];
};

export type PosBootstrap = {
  assignment: {
    pointOfSale: {
      id: string;
      code: string;
      name: string;
      templateCode?: string | null;
      layoutJson?: unknown;
    };
    cashier: {
      id: string;
      displayName: string | null;
      employeeId: string;
    } | null;
  } | null;
  myAssignments: Array<{
    cashierId: string;
    pointOfSale: { id: string; code: string; name: string };
  }>;
  permissions: Record<string, boolean | number>;
  categories: Array<{
    id: string;
    name: string;
    parentId: string | null;
    code: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    categoryId: string | null;
    price: number;
    imageAttachmentId: string | null;
    taxRate: number;
  }>;
  walkInContact: { id: string; name: string };
  heldInvoices: Array<{
    id: string;
    invoiceNumber: string;
    totalAmount: string | number;
    createdAt: string;
    contact: { id: string; name: string };
    items: Array<{
      id: string;
      description: string;
      quantity: string | number;
      unitPrice: string | number;
      totalAmount: string | number;
      itemId: string | null;
    }>;
  }>;
  openShift: { id: string; openedAt: string } | null;
  layout?: PosTerminalLayout | null;
  templates: Array<{
    code: string;
    nameAr: string;
    nameEn: string;
    descriptionAr: string;
    descriptionEn: string;
    accentColor: string;
  }>;
  templateCode: string | null;
  exchangeRates?: Record<string, number>;
  allowedCurrencies?: string[];
  hasSupervisorPin?: boolean;
  paymentProvider?: { mode: string; message: string };
  companyDefaults: { taxRate: number; currency: string };
  roleOps?: {
    invoiceCreate?: boolean;
    quickInvoice?: boolean;
    quoteCreate?: boolean;
    quoteDelete?: boolean;
    quoteConvert?: boolean;
    invoiceSendWhatsapp?: boolean;
    quoteSendWhatsapp?: boolean;
  };
};

export type PosLookupInvoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: string | number;
  contact: { id: string; name: string };
  items: Array<{
    id: string;
    itemId: string | null;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    taxAmount: string | number;
    totalAmount: string | number;
  }>;
};

export type PosShiftSummary = {
  openShift: { id: string; openedAt: string } | null;
  sales: {
    cashSales: number;
    cardSales: number;
    transferSales: number;
    invoiceCount: number;
  };
};

export type PosPermissionTemplates = {
  cashier: Record<string, boolean | number>;
  supervisor: Record<string, boolean | number>;
};

type ActionResult<T = unknown> = { data?: T; error?: string };

function fail(error: unknown, fallback: string): ActionResult<never> {
  return {
    error: error instanceof ApiError ? error.message : fallback,
  };
}

export async function posTerminalBootstrap(
  companyId: string,
  pointOfSaleId?: string,
): Promise<ActionResult<PosBootstrap>> {
  try {
    const q = pointOfSaleId
      ? `?pointOfSaleId=${encodeURIComponent(pointOfSaleId)}`
      : "";
    const data = await apiServer<PosBootstrap>(
      `/companies/${companyId}/sales/pos/terminal/bootstrap${q}`,
      { companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to load POS terminal");
  }
}

export async function posTerminalCheckout(
  companyId: string,
  body: Record<string, unknown>,
): Promise<
  ActionResult<{ id: string; invoiceNumber: string; totalAmount: string }>
> {
  try {
    const data = await apiServer<{
      id: string;
      invoiceNumber: string;
      totalAmount: string;
    }>(`/companies/${companyId}/sales/pos/terminal/checkout`, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Checkout failed");
  }
}

export async function posTerminalQuickCheckout(
  companyId: string,
  body: {
    pointOfSaleId?: string;
    contactId?: string;
    customerName?: string;
    customerPhone?: string;
    paymentMethod: "CASH" | "CARD" | "MIXED";
    paymentSplits?: Array<{ method: string; amount: number }>;
    lines: Array<{
      itemId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxAmount?: number;
    }>;
    notes?: string;
  },
): Promise<
  ActionResult<{ id: string; invoiceNumber: string; totalAmount: string }>
> {
  try {
    const data = await apiServer<{
      id: string;
      invoiceNumber: string;
      totalAmount: string;
    }>(`/companies/${companyId}/sales/pos/terminal/quick-checkout`, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Quick invoice failed");
  }
}

export async function posTerminalCheckoutQuote(
  companyId: string,
  body: Record<string, unknown>,
): Promise<
  ActionResult<{
    id: string;
    quoteNumber: string;
    totalAmount: string | number;
    contact?: { id: string; name: string; phone?: string | null } | null;
  }>
> {
  try {
    const data = await apiServer<{
      id: string;
      quoteNumber: string;
      totalAmount: string | number;
      contact?: { id: string; name: string; phone?: string | null } | null;
    }>(`/companies/${companyId}/sales/pos/terminal/quote`, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Quote create failed");
  }
}

export type PosRecentQuote = {
  id: string;
  quoteNumber: string;
  totalAmount: string | number;
  status: string;
  createdAt: string;
  contact: { id: string; name: string; phone?: string | null };
};

export async function posTerminalListQuotes(
  companyId: string,
): Promise<ActionResult<PosRecentQuote[]>> {
  try {
    const data = await apiServer<PosRecentQuote[]>(
      `/companies/${companyId}/sales/pos/terminal/quotes`,
      { companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to load quotes");
  }
}

export type PosDocumentRow = {
  id: string;
  number: string;
  status: string;
  totalAmount: string | number;
  currency: string;
  createdAt: string;
  issuedOn?: string | null;
  contact: { id: string; name: string; phone?: string | null };
  paymentMethod?: string | null;
  cashierName?: string | null;
};

export async function posTerminalListDocuments(
  companyId: string,
): Promise<
  ActionResult<{ quotes: PosDocumentRow[]; invoices: PosDocumentRow[] }>
> {
  try {
    const data = await apiServer<{
      quotes: PosDocumentRow[];
      invoices: PosDocumentRow[];
    }>(`/companies/${companyId}/sales/pos/terminal/documents`, {
      companyId,
    });
    return { data };
  } catch (error) {
    return fail(error, "Failed to load documents");
  }
}

export async function posTerminalCancelQuote(
  companyId: string,
  quoteId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const data = await apiServer<{ id: string }>(
      `/companies/${companyId}/sales/pos/terminal/quotes/${quoteId}/cancel`,
      { method: "POST", companyId, body: "{}" },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to delete quote");
  }
}

export async function posTerminalConvertQuote(
  companyId: string,
  quoteId: string,
): Promise<
  ActionResult<{
    id: string;
    invoiceNumber?: string;
    totalAmount?: string | number;
    contact?: { id: string; name: string; phone?: string | null } | null;
  }>
> {
  try {
    const data = await apiServer<{
      id: string;
      invoiceNumber?: string;
      totalAmount?: string | number;
      contact?: { id: string; name: string; phone?: string | null } | null;
    }>(`/companies/${companyId}/sales/pos/terminal/quotes/${quoteId}/convert`, {
      method: "POST",
      companyId,
      body: "{}",
    });
    return { data };
  } catch (error) {
    return fail(error, "Failed to convert quote");
  }
}

export type PosQuoteDetail = {
  id: string;
  quoteNumber: string;
  totalAmount: string | number;
  status: string;
  contact: { id: string; name: string; phone?: string | null };
  items: Array<{
    id: string;
    itemId: string | null;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    taxAmount: string | number;
    totalAmount: string | number;
  }>;
};

export async function posTerminalGetQuote(
  companyId: string,
  quoteId: string,
): Promise<ActionResult<PosQuoteDetail>> {
  try {
    const data = await apiServer<PosQuoteDetail>(
      `/companies/${companyId}/sales/pos/terminal/quotes/${quoteId}`,
      { companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to load quote");
  }
}

export async function posTerminalUpdateQuote(
  companyId: string,
  quoteId: string,
  body: Record<string, unknown>,
): Promise<
  ActionResult<{
    id: string;
    quoteNumber: string;
    totalAmount: string | number;
  }>
> {
  try {
    const data = await apiServer<{
      id: string;
      quoteNumber: string;
      totalAmount: string | number;
    }>(`/companies/${companyId}/sales/pos/terminal/quotes/${quoteId}`, {
      method: "PATCH",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Failed to update quote");
  }
}

export async function posValidateCoupon(
  companyId: string,
  body: {
    code: string;
    orderAmount?: number;
    contactId?: string;
    pointOfSaleId?: string;
  },
): Promise<
  ActionResult<{
    code: string;
    couponType: string;
    discountValue: number;
    discountAmount: number;
    maxUsages: number | null;
    usageCount: number;
  }>
> {
  try {
    const data = await apiServer<{
      code: string;
      couponType: string;
      discountValue: number;
      discountAmount: number;
      maxUsages: number | null;
      usageCount: number;
    }>(`/companies/${companyId}/sales/pos/terminal/coupons/validate`, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Invalid coupon");
  }
}

export async function posQuickCustomer(
  companyId: string,
  body: { name: string; phone?: string; pointOfSaleId?: string },
): Promise<ActionResult<{ id: string; name: string; phone: string | null }>> {
  try {
    const data = await apiServer<{
      id: string;
      name: string;
      phone: string | null;
    }>(`/companies/${companyId}/sales/pos/terminal/customers/quick`, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Failed to save customer");
  }
}

export async function posTerminalIssueHeld(
  companyId: string,
  invoiceId: string,
  body: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/held/${invoiceId}/issue`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify(body),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Issue held failed");
  }
}

export async function posTerminalVoidHeld(
  companyId: string,
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/held/${invoiceId}/void`,
      { method: "POST", companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Void failed");
  }
}

export async function posApplyTemplate(
  companyId: string,
  body: { templateCode: string; pointOfSaleId?: string },
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/templates/apply`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({ ...body, seedCategories: true }),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Apply template failed");
  }
}

export async function posOpenDrawer(
  companyId: string,
  reason: string,
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/drawer/open`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({ reason }),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Drawer open denied");
  }
}

export async function posSaveLayout(
  companyId: string,
  body: {
    pointOfSaleId: string;
    layoutJson?: PosTerminalLayout | null;
    templateCode?: string | null;
  },
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/layout`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify(body),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Save layout failed");
  }
}

export async function posVerifyPin(
  companyId: string,
  pin: string,
): Promise<ActionResult<{ ok: true }>> {
  try {
    const data = await apiServer<{ ok: true }>(
      `/companies/${companyId}/sales/pos/terminal/verify-pin`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({ pin }),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Invalid supervisor PIN");
  }
}

export async function posLookupInvoice(
  companyId: string,
  q: string,
): Promise<ActionResult<PosLookupInvoice>> {
  try {
    const data = await apiServer<PosLookupInvoice>(
      `/companies/${companyId}/sales/pos/terminal/invoices/lookup?q=${encodeURIComponent(q)}`,
      { companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Invoice not found");
  }
}

export async function posCreateReturn(
  companyId: string,
  body: {
    invoiceId?: string;
    invoiceNumber?: string;
    reason?: string;
    overridePin?: string;
    items: Array<{
      salesInvoiceItemId: string;
      quantity: number;
      amount?: number;
    }>;
  },
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/returns`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify(body),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Return failed");
  }
}

export async function posShiftSummary(
  companyId: string,
  pointOfSaleId?: string,
): Promise<ActionResult<PosShiftSummary>> {
  try {
    const q = pointOfSaleId
      ? `?pointOfSaleId=${encodeURIComponent(pointOfSaleId)}`
      : "";
    const data = await apiServer<PosShiftSummary>(
      `/companies/${companyId}/sales/pos/terminal/shift/summary${q}`,
      { companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to load shift");
  }
}

export async function posOpenShift(
  companyId: string,
  body: { openingFloat?: number; pointOfSaleId?: string },
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/shift/open`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify(body),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Open shift failed");
  }
}

export async function posCloseShift(
  companyId: string,
  body: {
    denominations: Array<{ value: number; count: number }>;
    pettyExpenses?: number;
    notes?: string;
    overridePin?: string;
    pointOfSaleId?: string;
  },
): Promise<
  ActionResult<{
    id?: string;
    journalEntryId?: string | null;
    zReportNumber?: string | null;
    [key: string]: unknown;
  }>
> {
  try {
    const data = await apiServer<{
      id?: string;
      journalEntryId?: string | null;
      zReportNumber?: string | null;
      [key: string]: unknown;
    }>(`/companies/${companyId}/sales/pos/terminal/shift/close`, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    return fail(error, "Close shift failed");
  }
}

export async function posPermissionTemplates(
  companyId: string,
): Promise<ActionResult<PosPermissionTemplates>> {
  try {
    const data = await apiServer<PosPermissionTemplates>(
      `/companies/${companyId}/sales/pos/terminal/permission-templates`,
      { companyId },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to load permission templates");
  }
}

export async function posSetSupervisorPin(
  companyId: string,
  pin: string,
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/settings/supervisor-pin`,
      {
        method: "POST",
        companyId,
        body: JSON.stringify({ pin }),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to set supervisor PIN");
  }
}

export async function posGetExchangeRates(
  companyId: string,
): Promise<
  ActionResult<{
    exchangeRates: Record<string, number>;
    allowedCurrencies: string[];
    baseCurrency: string;
  }>
> {
  try {
    const data = await apiServer<{
      exchangeRates: Record<string, number>;
      allowedCurrencies: string[];
      baseCurrency: string;
    }>(`/companies/${companyId}/sales/pos/terminal/exchange-rates`, {
      companyId,
    });
    return { data };
  } catch (error) {
    return fail(error, "Failed to load exchange rates");
  }
}

export async function posPatchExchangeRates(
  companyId: string,
  rates: Record<string, number>,
): Promise<ActionResult> {
  try {
    const data = await apiServer(
      `/companies/${companyId}/sales/pos/terminal/exchange-rates`,
      {
        method: "PATCH",
        companyId,
        body: JSON.stringify({ exchangeRates: rates }),
      },
    );
    return { data };
  } catch (error) {
    return fail(error, "Failed to update exchange rates");
  }
}
