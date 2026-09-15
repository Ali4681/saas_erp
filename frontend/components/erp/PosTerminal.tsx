"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Minus,
  Monitor,
  Pause,
  Pin,
  PinOff,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  CreditCard,
  Banknote,
  Split,
  RotateCcw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { localizedCategoryName } from "@/lib/erp/category-labels";
import {
  posApplyTemplate,
  posCloseShift,
  posCreateReturn,
  posLookupInvoice,
  posOpenDrawer,
  posOpenShift,
  posQuickCustomer,
  posSaveLayout,
  posTerminalBootstrap,
  posTerminalCancelQuote,
  posTerminalCheckout,
  posTerminalCheckoutQuote,
  posTerminalConvertQuote,
  posTerminalGetQuote,
  posTerminalIssueHeld,
  posTerminalListQuotes,
  posTerminalUpdateQuote,
  posTerminalVoidHeld,
  posValidateCoupon,
  posVerifyPin,
  type PosBootstrap,
  type PosLookupInvoice,
  type PosRecentQuote,
  type PosTerminalLayout,
} from "@/app/c/[companyId]/me/pos/actions";
import { buildWhatsAppUrl } from "@/lib/phone";
import { resolvePosRoleOps } from "@/lib/pos-permissions";

type CartLine = {
  key: string;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  taxRate: number;
  note: string;
};

type CartBroadcast = {
  companyId: string;
  currency: string;
  lastItem: CartLine | null;
  lines: CartLine[];
  totals: { subtotal: number; tax: number; discount: number; total: number };
};

const SAR_DENOMS = [0.25, 0.5, 1, 5, 10, 20, 50, 100, 200, 500] as const;

function money(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function roundMoney2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Clamp one split side to [0, total] and return the complementary amount. */
function balanceSplitAmount(
  raw: string,
  total: number,
): { primary: string; rest: string } | null {
  if (raw.trim() === "") return { primary: "", rest: "" };
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const cap = roundMoney2(Math.max(0, total));
  if (n > cap) {
    return { primary: String(cap), rest: "0" };
  }
  if (n < 0) {
    return { primary: "0", rest: String(cap) };
  }
  return {
    primary: raw,
    rest: String(roundMoney2(Math.max(0, cap - n))),
  };
}

function productImageUrl(
  companyId: string,
  imageAttachmentId: string | null | undefined,
) {
  if (!imageAttachmentId) return null;
  return `/api/attachments/${imageAttachmentId}?companyId=${encodeURIComponent(companyId)}&inline=1`;
}

function promptSupervisorPin(message: string): string | null {
  if (typeof window === "undefined") return null;
  const pin = window.prompt(message);
  const trimmed = pin?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function printThermalReceipt(opts: {
  companyName: string;
  logoUrl?: string | null;
  invoiceNumber: string;
  paymentMethod: string;
  currency: string;
  cashierName?: string | null;
  customerName?: string | null;
  lines: CartLine[];
  totals: { subtotal: number; tax: number; discount: number; total: number };
  autoPrint: boolean;
}) {
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}${l.note ? `<br/><small>${escapeHtml(l.note)}</small>` : ""}</td><td class="qty">${l.quantity}</td><td class="amt">${money(l.unitPrice * l.quantity)}</td></tr>`,
    )
    .join("");

  // Absolute logo URL — relative paths break inside blob: documents
  let logoSrc = "";
  if (opts.logoUrl) {
    try {
      logoSrc = new URL(opts.logoUrl, window.location.origin).href;
    } catch {
      logoSrc = opts.logoUrl;
    }
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(opts.invoiceNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: ui-monospace, Menlo, Consolas, monospace; width: 72mm; margin: 0 auto; padding: 8px; color: #111; font-size: 12px; background: #fff; }
    .center { text-align: center; }
    img.logo { max-width: 48mm; max-height: 20mm; object-fit: contain; margin: 0 auto 6px; display: block; }
    h1 { font-size: 14px; margin: 0 0 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td { vertical-align: top; padding: 2px 0; }
    td.qty { width: 2.2em; text-align: center; }
    td.amt { width: 5em; text-align: end; white-space: nowrap; }
    .totals { margin-top: 8px; border-top: 1px dashed #333; padding-top: 6px; }
    .totals div { display: flex; justify-content: space-between; gap: 8px; }
    .total { font-weight: 700; font-size: 13px; margin-top: 4px; }
    .meta { margin-top: 6px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="center">
    ${logoSrc ? `<img class="logo" src="${escapeHtml(logoSrc)}" alt="" />` : ""}
    <h1>${escapeHtml(opts.companyName)}</h1>
    <div>${escapeHtml(opts.invoiceNumber)}</div>
  </div>
  <div class="meta">
    ${opts.cashierName ? `<div>Cashier: ${escapeHtml(opts.cashierName)}</div>` : ""}
    ${opts.customerName ? `<div>Customer: ${escapeHtml(opts.customerName)}</div>` : ""}
  </div>
  <table>${rows}</table>
  <div class="totals">
    <div><span>Subtotal</span><span>${money(opts.totals.subtotal)}</span></div>
    <div><span>Tax</span><span>${money(opts.totals.tax)}</span></div>
    ${opts.totals.discount > 0 ? `<div><span>Discount</span><span>-${money(opts.totals.discount)}</span></div>` : ""}
    <div class="total"><span>Total</span><span>${money(opts.totals.total)} ${escapeHtml(opts.currency)}</span></div>
    <div><span>Pay</span><span>${escapeHtml(opts.paymentMethod)}</span></div>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () {
        ${opts.autoPrint ? "window.focus(); window.print();" : ""}
      }, 300);
    };
  </script>
</body>
</html>`;

  // Blob URL keeps a real document; window.open(..., "noopener") returns null
  // and leaves a blank about:blank tab if we try document.write on it.
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=420,height=720");
  if (!w) {
    URL.revokeObjectURL(url);
    // Popup blocked — try same-tab fallback via iframe print
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        if (opts.autoPrint) iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          URL.revokeObjectURL(url);
          iframe.remove();
        }, 1000);
      }
    };
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ProductThumb({
  companyId,
  name,
  imageAttachmentId,
  accent,
}: {
  companyId: string;
  name: string;
  imageAttachmentId: string | null;
  accent: string;
}) {
  const baseSrc = productImageUrl(companyId, imageAttachmentId);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const src =
    baseSrc && retry > 0 ? `${baseSrc}&_r=${retry}` : baseSrc;

  useEffect(() => {
    setFailed(false);
    setRetry(0);
    setAspectRatio(null);
  }, [baseSrc]);

  if (src && !failed) {
    return (
      <div
        className="w-full shrink-0 border-b border-[var(--border)]/60 p-2.5"
        style={{
          background: `linear-gradient(160deg, ${accent}18, var(--muted) 55%, color-mix(in oklab, var(--muted) 70%, white))`,
        }}
      >
        <div
          className="relative mx-auto w-full overflow-hidden rounded-xl bg-[var(--card)] shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--border)_70%,transparent)]"
          style={{
            aspectRatio: aspectRatio ?? 4 / 3,
            maxHeight: "10.5rem",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-center p-1.5"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setAspectRatio(naturalWidth / naturalHeight);
              }
            }}
            onError={() => {
              // One silent retry (permission / cold Nest restart), then fallback letter.
              if (retry < 1) {
                setRetry(1);
                return;
              }
              setFailed(true);
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex h-28 w-full shrink-0 items-center justify-center border-b border-[var(--border)]/60 text-2xl font-bold text-white/90"
      style={{
        background: `linear-gradient(135deg, ${accent}cc, ${accent}66)`,
      }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

export function PosTerminal({
  companyId,
  companyName,
  companyLogoUrl,
  initialDocMode = "invoice",
  browseOnly = false,
  lockDocMode = false,
  initialEditQuoteId = null,
}: {
  companyId: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  initialDocMode?: "invoice" | "quote";
  browseOnly?: boolean;
  lockDocMode?: boolean;
  initialEditQuoteId?: string | null;
}) {
  const t = useTranslations("pos");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [boot, setBoot] = useState<PosBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [customerMode, setCustomerMode] = useState<"walkin" | "named">(
    "walkin",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    name: string;
    phone: string | null;
  } | null>(null);
  const [payMode, setPayMode] = useState<"CASH" | "CARD" | "MIXED">("CASH");
  const [docMode, setDocMode] = useState<"invoice" | "quote">(initialDocMode);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [recentQuotes, setRecentQuotes] = useState<PosRecentQuote[]>([]);
  const [splitCash, setSplitCash] = useState("");
  const [splitCard, setSplitCard] = useState("");
  const [showHeld, setShowHeld] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showShift, setShowShift] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [autoPrint, setAutoPrint] = useState(true);
  const [tenderCurrency, setTenderCurrency] = useState("SAR");
  const [layoutDraft, setLayoutDraft] = useState<PosTerminalLayout | null>(null);
  const [pinSearch, setPinSearch] = useState("");
  const [returnQ, setReturnQ] = useState("");
  const [returnInvoice, setReturnInvoice] = useState<PosLookupInvoice | null>(
    null,
  );
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState("");
  const [openingFloat, setOpeningFloat] = useState("0");
  const [denomCounts, setDenomCounts] = useState<Record<string, string>>({});
  const [shiftNotes, setShiftNotes] = useState("");
  const [zReport, setZReport] = useState<{
    zReportNumber?: string | null;
    journalEntryId?: string | null;
  } | null>(null);
  const lastItemRef = useRef<CartLine | null>(null);

  function reload(pointOfSaleId?: string) {
    startTransition(async () => {
      try {
        // Must use Server Action (cookies → Nest Bearer). Browser fetch to
        // `/api/companies/...` hits Nest directly behind Nginx and returns 401.
        const result = await posTerminalBootstrap(companyId, pointOfSaleId);
        if (result.error || !result.data) {
          const msg = result.error || "Failed to load POS terminal";
          setError(msg);
          toast.error(msg);
          return;
        }
        const data = result.data;
        setBoot(data);
        setError(null);
        if (data?.layout) {
          setLayoutDraft({
            accentColor: data.layout.accentColor ?? null,
            categoryOrder: [...(data.layout.categoryOrder ?? [])],
            pinnedItemIds: [...(data.layout.pinnedItemIds ?? [])],
          });
        } else {
          setLayoutDraft({
            accentColor: null,
            categoryOrder: [],
            pinnedItemIds: [],
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to load POS terminal";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    searchRef.current?.focus();
  }, [boot?.assignment?.pointOfSale.id]);

  const layout = boot?.layout ?? layoutDraft;
  const pinnedSet = useMemo(
    () => new Set(layout?.pinnedItemIds ?? []),
    [layout?.pinnedItemIds],
  );

  const rootCategories = useMemo(() => {
    if (!boot) return [];
    const roots = boot.categories.filter((c) => !c.parentId);
    const order = layout?.categoryOrder ?? [];
    if (!order.length) return roots;
    const rank = new Map(order.map((id, i) => [id, i]));
    return [...roots].sort((a, b) => {
      const ra = rank.has(a.id) ? (rank.get(a.id) as number) : 9999;
      const rb = rank.has(b.id) ? (rank.get(b.id) as number) : 9999;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [boot, layout?.categoryOrder]);

  const childIds = useMemo(() => {
    if (!boot || categoryId === "all") return null;
    const ids = new Set<string>([categoryId]);
    for (const c of boot.categories) {
      if (c.parentId && ids.has(c.parentId)) ids.add(c.id);
    }
    for (const c of boot.categories) {
      if (c.parentId && ids.has(c.parentId)) ids.add(c.id);
    }
    return ids;
  }, [boot, categoryId]);

  const products = useMemo(() => {
    if (!boot) return [];
    const q = query.trim().toLowerCase();
    const filtered = boot.products.filter((p) => {
      if (childIds && (!p.categoryId || !childIds.has(p.categoryId))) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => {
      const ap = pinnedSet.has(a.id) ? 0 : 1;
      const bp = pinnedSet.has(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  }, [boot, childIds, query, pinnedSet]);

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const line of cart) {
      subtotal += line.unitPrice * line.quantity;
    }
    const pctDiscount = subtotal * (discountPct / 100);
    const couponDiscount = appliedCoupon?.discountAmount ?? 0;
    const discount = Math.min(pctDiscount + couponDiscount, Math.max(0, subtotal));
    // Discount on net first, then VAT on the reduced taxable base.
    let tax = 0;
    for (const line of cart) {
      const lineNet = line.unitPrice * line.quantity;
      const share = subtotal > 0 ? lineNet / subtotal : 0;
      const lineTaxable = Math.max(0, lineNet - discount * share);
      tax += lineTaxable * (line.taxRate / 100);
    }
    const taxable = Math.max(0, subtotal - discount);
    const total = Math.max(0, taxable + tax);
    return { subtotal, tax, discount, total };
  }, [cart, discountPct, appliedCoupon]);

  // Keep split tender balanced when the cart total changes.
  useEffect(() => {
    if (payMode !== "MIXED") return;
    if (splitCash.trim() === "" && splitCard.trim() === "") return;
    if (splitCash.trim() !== "") {
      const balanced = balanceSplitAmount(splitCash, totals.total);
      if (!balanced) return;
      setSplitCash(balanced.primary);
      setSplitCard(balanced.rest);
      return;
    }
    const balanced = balanceSplitAmount(splitCard, totals.total);
    if (!balanced) return;
    setSplitCard(balanced.primary);
    setSplitCash(balanced.rest);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only rebalance on total/mode
  }, [totals.total, payMode]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }
    const channel = new BroadcastChannel(`pos-cart-${companyId}`);
    const payload: CartBroadcast = {
      companyId,
      currency: boot?.companyDefaults.currency ?? "SAR",
      lastItem: lastItemRef.current,
      lines: cart,
      totals,
    };
    channel.postMessage(payload);
    channel.close();
  }, [cart, totals, companyId, boot?.companyDefaults.currency]);

  useEffect(() => {
    setAppliedCoupon(null);
  }, [cart]);

  useEffect(() => {
    setDocMode(initialDocMode);
  }, [initialDocMode]);

  function addProduct(p: PosBootstrap["products"][number]) {
    if (browseOnly) {
      toast.info(t("browseOnlyHint"));
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === p.id && !l.note);
      let next: CartLine[];
      if (existing) {
        next = prev.map((l) =>
          l.key === existing.key
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
        lastItemRef.current =
          next.find((l) => l.key === existing.key) ?? existing;
      } else {
        const line: CartLine = {
          key: `${p.id}-${Date.now()}`,
          itemId: p.id,
          name: p.name,
          unitPrice: p.price,
          quantity: 1,
          taxRate: p.taxRate || boot?.companyDefaults.taxRate || 15,
          note: "",
        };
        next = [...prev, line];
        lastItemRef.current = line;
      }
      return next;
    });
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function applyNote(key: string) {
    const note = (noteDraft[key] ?? "").trim();
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, note } : l)),
    );
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!boot) return;
    const q = query.trim();
    if (!q) return;
    const exact = boot.products.find(
      (p) => (p.barcode ?? "").toLowerCase() === q.toLowerCase(),
    );
    if (exact) {
      addProduct(exact);
      setQuery("");
      return;
    }
    toast.error(t("barcodeUnknown"));
  }

  async function ensureOverridePin(needPin: boolean): Promise<string | null> {
    if (!needPin) return null;
    const pin = promptSupervisorPin(t("supervisorPinPrompt"));
    if (!pin) {
      toast.error(t("supervisorPinRequired"));
      return null;
    }
    const res = await posVerifyPin(companyId, pin);
    if (res.error) {
      toast.error(res.error);
      return null;
    }
    return pin;
  }

  function resetCustomerAndCoupon() {
    setCustomerMode("walkin");
    setCustomerName("");
    setCustomerPhone("");
    setSelectedContact(null);
    setCouponInput("");
    setAppliedCoupon(null);
    setDiscountPct(0);
    setEditingQuoteId(null);
  }

  async function saveNamedCustomer(): Promise<{
    id: string;
    name: string;
    phone: string | null;
  } | null> {
    const name = customerName.trim();
    if (name.length < 2) {
      toast.error(t("customerNameRequired"));
      return null;
    }
    const res = await posQuickCustomer(companyId, {
      name,
      phone: customerPhone.trim() || undefined,
      pointOfSaleId: boot?.assignment?.pointOfSale.id,
    });
    if (res.error || !res.data) {
      toast.error(res.error || t("customerNameRequired"));
      return null;
    }
    setSelectedContact(res.data);
    setCustomerName(res.data.name);
    setCustomerPhone(res.data.phone ?? "");
    toast.success(t("customerSaved"));
    return res.data;
  }

  async function applyCouponCode() {
    if (!boot) return;
    const code = couponInput.trim();
    if (!code) return;

    // Named customer is optional — coupons work for walk-in too.
    let contactId: string | undefined;
    if (customerMode === "named") {
      let contact = selectedContact;
      if (!contact) {
        contact = await saveNamedCustomer();
        if (!contact) return;
      }
      contactId = contact.id;
    }

    let subtotal = 0;
    for (const line of cart) {
      subtotal += line.unitPrice * line.quantity;
    }

    const res = await posValidateCoupon(companyId, {
      code,
      orderAmount: subtotal,
      contactId,
      pointOfSaleId: boot.assignment?.pointOfSale.id,
    });
    if (res.error || !res.data) {
      toast.error(res.error || t("couponInvalid"));
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon({
      code: res.data.code,
      discountAmount: res.data.discountAmount,
    });
    setCouponInput(res.data.code);
    toast.success(
      t("couponApplied", {
        code: res.data.code,
        amount: money(res.data.discountAmount),
      }),
    );
  }

  function checkout(
    status: "ISSUED" | "ON_HOLD",
    methodOverride?: "CASH" | "CARD" | "MIXED",
  ) {
    if (!boot || cart.length === 0) {
      toast.error(t("cartEmpty"));
      return;
    }
    const roleOps = boot.roleOps
      ? resolvePosRoleOps(null, boot.roleOps)
      : {
          invoiceCreate: true,
          quickInvoice: true,
          quoteCreate: true,
          quoteDelete: true,
          quoteConvert: true,
          invoiceSendWhatsapp: true,
          quoteSendWhatsapp: true,
        };
    if (docMode === "quote" && status === "ISSUED") {
      if (!roleOps.quoteCreate) {
        toast.error(t("permDenied"));
        return;
      }
    } else if (status === "ISSUED" && !roleOps.invoiceCreate) {
      toast.error(t("permDenied"));
      return;
    }
    const method = methodOverride ?? payMode;
    const perms = boot.permissions;
    if (status === "ON_HOLD" && !perms.holdRetrieve) {
      toast.error(t("permDenied"));
      return;
    }
    if (docMode === "quote" && status === "ON_HOLD") {
      toast.error(t("quoteNoHold"));
      return;
    }
    const maxDisc = Number(perms.discountMaxPct) || 0;
    const needsDiscountOverride =
      discountPct > 0 && (!perms.discounts || discountPct > maxDisc);

    if (discountPct > 0 && !perms.discounts && !boot.hasSupervisorPin) {
      toast.error(t("permDenied"));
      return;
    }

    let paymentSplits: Array<{ method: string; amount: number }> | undefined;
    if (docMode === "invoice" && method === "MIXED") {
      const cash = Number(splitCash) || 0;
      const card = Number(splitCard) || 0;
      if (Math.abs(cash + card - totals.total) > 0.05) {
        toast.error(t("splitMismatch"));
        return;
      }
      paymentSplits = [
        { method: "CASH", amount: cash },
        { method: "CARD", amount: card },
      ];
    }

    const cartSnapshot = [...cart];
    const totalsSnapshot = { ...totals };
    const paySnapshot = method;
    const cashierName =
      boot.assignment?.cashier?.displayName?.trim() || null;
    const couponSnapshot = appliedCoupon;
    const phoneForWa = customerPhone.trim() || selectedContact?.phone || "";

    startTransition(async () => {
      let contactId = boot.walkInContact.id;
      let receiptCustomer: string | null = null;

      if (customerMode === "named") {
        let contact = selectedContact;
        if (!contact) {
          contact = await saveNamedCustomer();
          if (!contact) return;
        }
        contactId = contact.id;
        receiptCustomer = contact.name;
      }

      const lines = cartSnapshot.map((l) => ({
        itemId: l.itemId,
        description: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        note: l.note || undefined,
        taxAmount: (l.unitPrice * l.quantity * l.taxRate) / 100,
      }));

      if (docMode === "quote") {
        const quoteBody = {
          pointOfSaleId: boot.assignment?.pointOfSale.id,
          contactId,
          lines,
        };
        const res = editingQuoteId
          ? await posTerminalUpdateQuote(companyId, editingQuoteId, quoteBody)
          : await posTerminalCheckoutQuote(companyId, quoteBody);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        const number = res.data?.quoteNumber ?? "";
        toast.success(
          editingQuoteId
            ? t("quoteUpdatedOk", { number })
            : t("quoteOk", { number }),
        );
        if (roleOps.quoteSendWhatsapp && phoneForWa) {
          const url = buildWhatsAppUrl(
            phoneForWa,
            t("whatsappQuoteText", {
              number,
              total: money(totalsSnapshot.total),
              currency: boot.companyDefaults.currency,
            }),
          );
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }
        setCart([]);
        lastItemRef.current = null;
        resetCustomerAndCoupon();
        reload(boot.assignment?.pointOfSale.id);
        return;
      }

      const pin = await ensureOverridePin(needsDiscountOverride);
      if (needsDiscountOverride && !pin) return;

      const tenderNote =
        tenderCurrency !== "SAR" && boot.exchangeRates?.[tenderCurrency]
          ? `Tender ${tenderCurrency} @ ${boot.exchangeRates[tenderCurrency]} (SAR billed)`
          : undefined;

      const res = await posTerminalCheckout(companyId, {
        pointOfSaleId: boot.assignment?.pointOfSale.id,
        contactId,
        paymentMethod: method,
        paymentSplits,
        extraDiscountPct: discountPct || undefined,
        couponCode: couponSnapshot?.code || undefined,
        status,
        // Checkout DTO accepts overrideCode only (supervisor PIN for discount).
        overrideCode: pin ?? undefined,
        notes: tenderNote,
        lines,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        status === "ON_HOLD"
          ? t("heldOk")
          : t("checkoutOk", { number: res.data?.invoiceNumber ?? "" }),
      );
      if (status === "ISSUED" && res.data) {
        printThermalReceipt({
          companyName: companyName || boot.assignment?.pointOfSale.name || "POS",
          logoUrl: companyLogoUrl,
          invoiceNumber: res.data.invoiceNumber,
          paymentMethod: paySnapshot,
          currency: boot.companyDefaults.currency,
          cashierName,
          customerName: receiptCustomer,
          lines: cartSnapshot,
          totals: totalsSnapshot,
          autoPrint,
        });
        if (roleOps.invoiceSendWhatsapp && phoneForWa) {
          const url = buildWhatsAppUrl(
            phoneForWa,
            t("whatsappInvoiceText", {
              number: res.data.invoiceNumber,
              total: money(totalsSnapshot.total),
              currency: boot.companyDefaults.currency,
            }),
          );
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }
      }
      setCart([]);
      lastItemRef.current = null;
      setSplitCash("");
      setSplitCard("");
      resetCustomerAndCoupon();
      reload(boot.assignment?.pointOfSale.id);
    });
  }

  function selectOrCharge(mode: "CASH" | "CARD" | "MIXED") {
    setPayMode(mode);
    if (docMode !== "invoice") return;
    if (mode === "MIXED") {
      // Start empty; typing one side fills the other to match the total.
      setSplitCash("");
      setSplitCard("");
      return;
    }
    if (mode === "CASH" || mode === "CARD") {
      if (cart.length === 0) {
        toast.error(t("cartEmpty"));
        return;
      }
      if (pending) return;
      checkout("ISSUED", mode);
    }
  }

  async function loadQuotesPanel() {
    setQuotesOpen(true);
    const res = await posTerminalListQuotes(companyId);
    if (res.error) {
      toast.error(res.error);
      setRecentQuotes([]);
      return;
    }
    setRecentQuotes(res.data ?? []);
  }

  async function loadQuoteForEdit(quoteId: string) {
    const res = await posTerminalGetQuote(companyId, quoteId);
    if (res.error || !res.data) {
      toast.error(res.error || t("permDenied"));
      return;
    }
    const q = res.data;
    const lines: CartLine[] = [];
    for (const item of q.items) {
      if (!item.itemId) continue;
      const qty = Number(item.quantity) || 0;
      const unit = Number(item.unitPrice) || 0;
      const taxAmt = Number(item.taxAmount) || 0;
      const taxRate =
        qty > 0 && unit > 0 ? (taxAmt / (unit * qty)) * 100 : 15;
      lines.push({
        key: `${item.itemId}-${item.id}`,
        itemId: item.itemId,
        name: item.description,
        unitPrice: unit,
        quantity: qty,
        taxRate,
        note: "",
      });
    }
    if (!lines.length) {
      toast.error(t("retrieveToCartNoItems"));
      return;
    }
    setCart(lines);
    setDocMode("quote");
    setEditingQuoteId(q.id);
    setCustomerMode("named");
    setCustomerName(q.contact.name);
    setCustomerPhone(q.contact.phone ?? "");
    setSelectedContact({
      id: q.contact.id,
      name: q.contact.name,
      phone: q.contact.phone ?? null,
    });
    setQuotesOpen(false);
    toast.success(t("quoteLoadedOk"));
  }

  useEffect(() => {
    if (!boot || !initialEditQuoteId || browseOnly) return;
    void loadQuoteForEdit(initialEditQuoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when terminal opens with quote id
  }, [boot?.assignment?.pointOfSale.id, initialEditQuoteId]);

  function moveCategory(id: string, dir: -1 | 1) {
    setLayoutDraft((prev) => {
      const base = prev ?? {
        accentColor: null,
        categoryOrder: rootCategories.map((c) => c.id),
        pinnedItemIds: [],
      };
      const order =
        base.categoryOrder.length > 0
          ? [...base.categoryOrder]
          : rootCategories.map((c) => c.id);
      for (const c of rootCategories) {
        if (!order.includes(c.id)) order.push(c.id);
      }
      const idx = order.indexOf(id);
      if (idx < 0) return base;
      const next = idx + dir;
      if (next < 0 || next >= order.length) return base;
      const copy = [...order];
      const tmp = copy[idx]!;
      copy[idx] = copy[next]!;
      copy[next] = tmp;
      return { ...base, categoryOrder: copy };
    });
  }

  function togglePin(itemId: string) {
    setLayoutDraft((prev) => {
      const base = prev ?? {
        accentColor: null,
        categoryOrder: [],
        pinnedItemIds: [],
      };
      const set = new Set(base.pinnedItemIds);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      return { ...base, pinnedItemIds: [...set] };
    });
  }

  const exchangeRates = boot?.exchangeRates ?? {};
  const tenderRate =
    tenderCurrency === "SAR" ? 1 : Number(exchangeRates[tenderCurrency]) || 0;
  const tenderEquivalent =
    tenderCurrency === "SAR" || !tenderRate
      ? null
      : totals.total / tenderRate;

  if (error && !boot) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="py-16 text-center text-sm text-[var(--muted-foreground)]">
        {t("loading")}
      </div>
    );
  }

  const accent =
    layoutDraft?.accentColor ||
    layout?.accentColor ||
    boot.templates.find((x) => x.code === boot.templateCode)?.accentColor ||
    "#0F766E";

  const pinCandidates =
    pinSearch.trim().length > 0
      ? boot.products
          .filter((p) =>
            p.name.toLowerCase().includes(pinSearch.trim().toLowerCase()),
          )
          .slice(0, 12)
      : boot.products.filter((p) => pinnedSet.has(p.id)).slice(0, 12);

  const countedCash = SAR_DENOMS.reduce((sum, v) => {
    const c = Number(denomCounts[String(v)]) || 0;
    return sum + v * c;
  }, 0);

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-3 lg:flex-row">
      <section className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("search")}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pe-3 ps-9 text-sm outline-none focus:border-[var(--primary)]"
            />
          </div>
          {boot.assignment?.cashier?.displayName ? (
            <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
              <span className="text-[var(--muted-foreground)]">
                {t("cashierLabel")}:{" "}
              </span>
              <span className="font-semibold">
                {boot.assignment.cashier.displayName}
              </span>
            </div>
          ) : null}
          {browseOnly ? (
            <p className="w-full text-sm text-[var(--muted-foreground)]">
              {t("browseOnlyHint")}
            </p>
          ) : (
            <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowHeld((v) => !v)}
          >
            <Pause className="me-1 h-4 w-4" />
            {t("held")} ({boot.heldInvoices.length})
          </Button>
          {(boot.roleOps?.quoteCreate ||
            boot.roleOps?.quoteDelete ||
            boot.roleOps?.quoteConvert ||
            boot.roleOps?.quoteSendWhatsapp) && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadQuotesPanel()}
            >
              {t("quotes")}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowTemplates((v) => !v)}
          >
            {t("templates")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowLayout((v) => !v)}
          >
            <LayoutGrid className="me-1 h-4 w-4" />
            {t("layoutEditor")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowReturns((v) => !v)}
          >
            <RotateCcw className="me-1 h-4 w-4" />
            {t("returns")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowShift((v) => !v)}
          >
            <Wallet className="me-1 h-4 w-4" />
            {t("shift")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              window.open(
                `/c/${companyId}/me/pos/display`,
                "pos-customer-display",
                "noopener,noreferrer",
              )
            }
          >
            <Monitor className="me-1 h-4 w-4" />
            {t("customerDisplay")}
          </Button>
            </>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoryId("all")}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              categoryId === "all"
                ? "text-white"
                : "bg-[var(--muted)] text-[var(--foreground)]",
            )}
            style={
              categoryId === "all" ? { backgroundColor: accent } : undefined
            }
          >
            {t("allCategories")}
          </button>
          {rootCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
                categoryId === c.id
                  ? "text-white"
                  : "bg-[var(--muted)] text-[var(--foreground)]",
              )}
              style={
                categoryId === c.id ? { backgroundColor: accent } : undefined
              }
            >
              {localizedCategoryName(c, locale)}
            </button>
          ))}
        </div>

        {showLayout && layoutDraft ? (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-sm font-semibold">{t("layoutEditor")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t("accentColor")}</span>
                <input
                  type="color"
                  value={layoutDraft.accentColor || accent}
                  onChange={(e) =>
                    setLayoutDraft((d) =>
                      d ? { ...d, accentColor: e.target.value } : d,
                    )
                  }
                  className="h-10 w-16 cursor-pointer rounded border border-[var(--border)] bg-transparent"
                />
              </label>
              <Button
                type="button"
                disabled={pending || !boot.assignment?.pointOfSale.id}
                onClick={() => {
                  const posId = boot.assignment?.pointOfSale.id;
                  if (!posId || !layoutDraft) return;
                  startTransition(async () => {
                    const res = await posSaveLayout(companyId, {
                      pointOfSaleId: posId,
                      layoutJson: layoutDraft,
                    });
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(t("layoutSaved"));
                    reload(posId);
                  });
                }}
              >
                {t("saveLayout")}
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">
                {t("reorderCategories")}
              </p>
              {rootCategories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span>{localizedCategoryName(c, locale)}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--muted)] p-1.5"
                      onClick={() => moveCategory(c.id, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--muted)] p-1.5"
                      onClick={() => moveCategory(c.id, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Input
                label={t("pinSearch")}
                value={pinSearch}
                onChange={(e) => setPinSearch(e.target.value)}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {pinCandidates.map((p) => {
                  const pinned = (layoutDraft.pinnedItemIds ?? []).includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePin(p.id)}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-start text-sm"
                    >
                      <span className="truncate">{p.name}</span>
                      {pinned ? (
                        <Pin className="h-4 w-4 text-[var(--primary)]" />
                      ) : (
                        <PinOff className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {showReturns ? (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-sm font-semibold">{t("returnsTitle")}</p>
            <div className="flex flex-wrap gap-2">
              <Input
                label={t("returnLookup")}
                value={returnQ}
                onChange={(e) => setReturnQ(e.target.value)}
                className="min-w-[12rem] flex-1"
              />
              <Button
                type="button"
                className="self-end"
                disabled={pending || !returnQ.trim()}
                onClick={() => {
                  startTransition(async () => {
                    const res = await posLookupInvoice(companyId, returnQ.trim());
                    if (res.error) {
                      toast.error(res.error);
                      setReturnInvoice(null);
                      return;
                    }
                    setReturnInvoice(res.data ?? null);
                    const next: Record<string, string> = {};
                    for (const line of res.data?.items ?? []) {
                      next[line.id] = "0";
                    }
                    setReturnQty(next);
                  });
                }}
              >
                {t("lookup")}
              </Button>
            </div>
            {returnInvoice ? (
              <div className="space-y-2">
                <p className="text-sm">
                  {returnInvoice.invoiceNumber} · {returnInvoice.contact.name}
                </p>
                {returnInvoice.items.map((line) => (
                  <div
                    key={line.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{line.description}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {t("availableQty", {
                          qty: Number(line.quantity),
                        })}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={Number(line.quantity)}
                      value={returnQty[line.id] ?? "0"}
                      onChange={(e) =>
                        setReturnQty((q) => ({
                          ...q,
                          [line.id]: e.target.value,
                        }))
                      }
                      className="w-24"
                    />
                  </div>
                ))}
                <Input
                  label={t("returnReason")}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const items = returnInvoice.items
                      .map((line) => ({
                        salesInvoiceItemId: line.id,
                        quantity: Number(returnQty[line.id]) || 0,
                      }))
                      .filter((x) => x.quantity > 0);
                    if (!items.length) {
                      toast.error(t("returnSelectLines"));
                      return;
                    }
                    startTransition(async () => {
                      let pin: string | undefined;
                      if (!boot.permissions.returns) {
                        const verified = await ensureOverridePin(true);
                        if (!verified) return;
                        pin = verified;
                      }
                      const res = await posCreateReturn(companyId, {
                        invoiceId: returnInvoice.id,
                        invoiceNumber: returnInvoice.invoiceNumber,
                        reason: returnReason || undefined,
                        overridePin: pin,
                        items,
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      const note = res.data as
                        | { creditNoteNumber?: string }
                        | undefined;
                      toast.success(
                        note?.creditNoteNumber
                          ? `${t("returnOk")}: ${note.creditNoteNumber}`
                          : t("returnOk"),
                      );
                      setReturnInvoice(null);
                      setReturnQ("");
                      setReturnReason("");
                    });
                  }}
                >
                  {t("submitReturn")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {showShift ? (
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-sm font-semibold">{t("shiftTitle")}</p>
            {boot.openShift ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("shiftOpenSince", {
                  time: new Date(boot.openShift.openedAt).toLocaleString(),
                })}
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  label={t("openingFloat")}
                  type="number"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-40"
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await posOpenShift(companyId, {
                        openingFloat: Number(openingFloat) || 0,
                        pointOfSaleId: boot.assignment?.pointOfSale.id,
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success(t("shiftOpened"));
                      reload(boot.assignment?.pointOfSale.id);
                    });
                  }}
                >
                  {t("openShift")}
                </Button>
              </div>
            )}

            {boot.openShift ? (
              <div className="space-y-2">
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("blindCloseHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SAR_DENOMS.map((v) => (
                    <Input
                      key={v}
                      label={`${v} SAR`}
                      type="number"
                      min={0}
                      value={denomCounts[String(v)] ?? ""}
                      onChange={(e) =>
                        setDenomCounts((d) => ({
                          ...d,
                          [String(v)]: e.target.value,
                        }))
                      }
                    />
                  ))}
                </div>
                <p className="text-sm font-medium">
                  {t("countedCash")}: {money(countedCash)} SAR
                </p>
                <Input
                  label={t("shiftNotes")}
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      let pin: string | undefined;
                      if (!boot.permissions.shiftClose) {
                        const verified = await ensureOverridePin(true);
                        if (!verified) return;
                        pin = verified;
                      }
                      const denominations = SAR_DENOMS.map((value) => ({
                        value,
                        count: Number(denomCounts[String(value)]) || 0,
                      })).filter((d) => d.count > 0);
                      const res = await posCloseShift(companyId, {
                        denominations,
                        notes: shiftNotes || undefined,
                        overridePin: pin,
                        pointOfSaleId: boot.assignment?.pointOfSale.id,
                      });
                      if (res.error) {
                        toast.error(res.error);
                        return;
                      }
                      setZReport({
                        zReportNumber:
                          (res.data?.zReportNumber as string | null) ?? null,
                        journalEntryId:
                          (res.data?.journalEntryId as string | null) ?? null,
                      });
                      toast.success(t("shiftClosed"));
                      setDenomCounts({});
                      reload(boot.assignment?.pointOfSale.id);
                    });
                  }}
                >
                  {t("closeShift")}
                </Button>
                {zReport ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
                    <p>
                      {t("zReport")}: {zReport.zReportNumber ?? "—"}
                    </p>
                    <p>
                      {t("journalId")}: {zReport.journalEntryId ?? "—"}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {showTemplates ? (
          <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:grid-cols-2 lg:grid-cols-3">
            {boot.templates.map((tpl) => (
              <button
                key={tpl.code}
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const res = await posApplyTemplate(companyId, {
                      templateCode: tpl.code,
                      pointOfSaleId: boot.assignment?.pointOfSale.id,
                    });
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success(t("templateApplied"));
                    setShowTemplates(false);
                    reload(boot.assignment?.pointOfSale.id);
                  });
                }}
                className="rounded-xl border border-[var(--border)] p-3 text-start transition hover:border-[var(--primary)]/50"
              >
                <span
                  className="mb-2 inline-block h-2 w-10 rounded-full"
                  style={{ backgroundColor: tpl.accentColor }}
                />
                <p className="font-medium">
                  {locale === "ar" ? tpl.nameAr : tpl.nameEn}
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {locale === "ar" ? tpl.descriptionAr : tpl.descriptionEn}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {showHeld ? (
          <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <p className="text-sm font-semibold">{t("heldTitle")}</p>
            {boot.heldInvoices.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("heldEmpty")}
              </p>
            ) : (
              boot.heldInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-3"
                >
                  <div>
                    <p className="font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {inv.contact.name} · {money(Number(inv.totalAmount))}{" "}
                      {boot.companyDefaults.currency}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        if (
                          cart.length > 0 &&
                          !window.confirm(t("retrieveToCartReplaceConfirm"))
                        ) {
                          return;
                        }
                        startTransition(async () => {
                          const nextCart: CartLine[] = [];
                          for (const [idx, item] of inv.items.entries()) {
                            if (!item.itemId) continue;
                            const product = boot.products.find(
                              (p) => p.id === item.itemId,
                            );
                            const desc = item.description ?? "";
                            const noteMatch = /\(([^)]+)\)\s*$/.exec(desc);
                            const note = noteMatch?.[1]?.trim() ?? "";
                            const name = noteMatch
                              ? desc.replace(/\s*\([^)]+\)\s*$/, "").trim()
                              : desc;
                            nextCart.push({
                              key: `held-${inv.id}-${item.id ?? idx}`,
                              itemId: item.itemId,
                              name: product?.name || name || desc,
                              unitPrice: Number(item.unitPrice) || 0,
                              quantity: Math.max(1, Number(item.quantity) || 1),
                              taxRate:
                                product?.taxRate ??
                                boot.companyDefaults.taxRate ??
                                15,
                              note,
                            });
                          }
                          if (nextCart.length === 0) {
                            toast.error(t("retrieveToCartNoItems"));
                            return;
                          }

                          const voidRes = await posTerminalVoidHeld(
                            companyId,
                            inv.id,
                          );
                          if (voidRes.error) {
                            toast.error(voidRes.error);
                            return;
                          }

                          setCart(nextCart);
                          lastItemRef.current =
                            nextCart[nextCart.length - 1] ?? null;
                          setShowHeld(false);
                          toast.success(t("retrieveToCartOk"));
                          reload(boot.assignment?.pointOfSale.id);
                        });
                      }}
                    >
                      {t("retrieveToCart")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await posTerminalIssueHeld(
                            companyId,
                            inv.id,
                            { paymentMethod: "CASH" },
                          );
                          if (res.error) {
                            toast.error(res.error);
                            return;
                          }
                          toast.success(t("retrievedOk"));
                          reload(boot.assignment?.pointOfSale.id);
                        });
                      }}
                    >
                      {t("retrieve")}
                    </Button>
                    {boot.permissions.voidBeforeSave ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await posTerminalVoidHeld(
                              companyId,
                              inv.id,
                            );
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(t("voidedOk"));
                            reload(boot.assignment?.pointOfSale.id);
                          });
                        }}
                      >
                        {t("void")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        {quotesOpen ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{t("quotesTitle")}</p>
              <button
                type="button"
                className="text-xs text-[var(--muted-foreground)]"
                onClick={() => setQuotesOpen(false)}
              >
                {t("close")}
              </button>
            </div>
            {recentQuotes.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("quotesEmpty")}
              </p>
            ) : (
              recentQuotes.map((q) => (
                <div
                  key={q.id}
                  className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] p-2 last:mb-0"
                >
                  <div>
                    <p className="font-mono text-sm font-medium">
                      {q.quoteNumber}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {q.contact.name} · {money(Number(q.totalAmount))}{" "}
                      {boot.companyDefaults.currency}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {boot.roleOps?.quoteCreate ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending || browseOnly}
                        onClick={() => {
                          startTransition(async () => {
                            await loadQuoteForEdit(q.id);
                          });
                        }}
                      >
                        {t("editQuote")}
                      </Button>
                    ) : null}
                    {boot.roleOps?.quoteSendWhatsapp && q.contact.phone ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const url = buildWhatsAppUrl(
                            q.contact.phone!,
                            t("whatsappQuoteText", {
                              number: q.quoteNumber,
                              total: money(Number(q.totalAmount)),
                              currency: boot.companyDefaults.currency,
                            }),
                          );
                          if (url)
                            window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        {t("sendWhatsapp")}
                      </Button>
                    ) : null}
                    {boot.roleOps?.quoteConvert ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await posTerminalConvertQuote(
                              companyId,
                              q.id,
                            );
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(t("quoteConvertedOk"));
                            const phone =
                              res.data?.contact?.phone || q.contact.phone;
                            const roleOps = boot.roleOps
                              ? resolvePosRoleOps(null, boot.roleOps)
                              : resolvePosRoleOps(null, null);
                            if (
                              roleOps.invoiceSendWhatsapp &&
                              phone &&
                              window.confirm(t("quoteConvertWhatsapp"))
                            ) {
                              const url = buildWhatsAppUrl(
                                phone,
                                t("whatsappInvoiceText", {
                                  number:
                                    res.data?.invoiceNumber ??
                                    res.data?.id ??
                                    "",
                                  total: money(
                                    Number(
                                      res.data?.totalAmount ?? q.totalAmount,
                                    ),
                                  ),
                                  currency: boot.companyDefaults.currency,
                                }),
                              );
                              if (url)
                                window.open(
                                  url,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                            }
                            void loadQuotesPanel();
                            reload(boot.assignment?.pointOfSale.id);
                          });
                        }}
                      >
                        {t("convertQuote")}
                      </Button>
                    ) : null}
                    {boot.roleOps?.quoteDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            const res = await posTerminalCancelQuote(
                              companyId,
                              q.id,
                            );
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(t("quoteDeletedOk"));
                            void loadQuotesPanel();
                          });
                        }}
                      >
                        {t("deleteQuote")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-start shadow-sm transition hover:border-[var(--primary)]/35 hover:shadow-md active:scale-[0.99]"
            >
              <div className="relative">
                <ProductThumb
                  companyId={companyId}
                  name={p.name}
                  imageAttachmentId={p.imageAttachmentId}
                  accent={accent}
                />
                {pinnedSet.has(p.id) ? (
                  <Pin className="absolute end-3 top-3 h-4 w-4 text-white drop-shadow" />
                ) : null}
              </div>
              <div className="space-y-1 px-3 py-2.5">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</p>
                <p className="text-sm font-medium text-[var(--primary)]">
                  {money(p.price)} {boot.companyDefaults.currency}
                </p>
              </div>
            </button>
          ))}
          {products.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("noProducts")}
            </p>
          ) : null}
        </div>
      </section>

      {!browseOnly ? (
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] lg:w-[22rem] xl:w-[24rem]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[var(--primary)]" />
            <div>
              <p className="text-sm font-semibold">{t("cartTitle")}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {boot.assignment?.pointOfSale.name ?? t("noPos")}
                {boot.assignment?.cashier?.displayName
                  ? ` · ${boot.assignment.cashier.displayName}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-xs text-[var(--muted-foreground)] hover:text-red-600"
            onClick={() => {
              setCart([]);
              lastItemRef.current = null;
            }}
          >
            {t("clear")}
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              {t("cartEmpty")}
            </p>
          ) : (
            cart.map((line) => (
              <div
                key={line.key}
                className="rounded-xl border border-[var(--border)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {money(line.unitPrice)} × {line.quantity}
                    </p>
                    {line.note ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {line.note}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCart((prev) => prev.filter((l) => l.key !== line.key))
                    }
                    className="text-[var(--muted-foreground)] hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--muted)]"
                    onClick={() => updateQty(line.key, -1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--muted)]"
                    onClick={() => updateQty(line.key, 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="ms-auto text-sm font-semibold">
                    {money(line.unitPrice * line.quantity)}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteDraft[line.key] ?? line.note}
                    onChange={(e) =>
                      setNoteDraft((d) => ({
                        ...d,
                        [line.key]: e.target.value,
                      }))
                    }
                    placeholder={t("lineNote")}
                    className="h-8 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-2 text-xs"
                  />
                  <button
                    type="button"
                    className="text-xs text-[var(--primary)]"
                    onClick={() => applyNote(line.key)}
                  >
                    {t("saveNote")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 border-t border-[var(--border)] p-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {t("customerSection")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium",
                  customerMode === "walkin"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)]",
                )}
                onClick={() => {
                  setCustomerMode("walkin");
                  setSelectedContact(null);
                  if (appliedCoupon) {
                    setAppliedCoupon(null);
                    setCouponInput("");
                  }
                }}
              >
                {t("customerWalkIn")}
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium",
                  customerMode === "named"
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-[var(--border)]",
                )}
                onClick={() => setCustomerMode("named")}
              >
                {t("customerNamed")}
              </button>
            </div>
            {customerMode === "named" ? (
              <div className="grid gap-2">
                <Input
                  label={t("customerName")}
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setSelectedContact(null);
                  }}
                />
                <Input
                  label={t("customerPhone")}
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setSelectedContact(null);
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    void saveNamedCustomer();
                  }}
                >
                  {t("customerSave")}
                </Button>
                {selectedContact ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {selectedContact.name}
                    {selectedContact.phone ? ` · ${selectedContact.phone}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  label={t("couponCode")}
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setAppliedCoupon(null);
                  }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !couponInput.trim()}
                onClick={() => {
                  void applyCouponCode();
                }}
              >
                {t("couponApply")}
              </Button>
            </div>
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                <span>
                  {t("couponApplied", {
                    code: appliedCoupon.code,
                    amount: money(appliedCoupon.discountAmount),
                  })}
                </span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                  }}
                >
                  {t("couponClear")}
                </button>
              </div>
            ) : null}
          </div>

          {boot.permissions.discounts || boot.hasSupervisorPin ? (
            <Input
              label={t("discountPct")}
              type="number"
              min={0}
              max={100}
              value={String(discountPct)}
              onChange={(e) => setDiscountPct(Number(e.target.value) || 0)}
            />
          ) : null}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">
                {t("subtotal")}
              </span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">{t("tax")}</span>
              <span>{money(totals.tax)}</span>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between text-amber-700 dark:text-amber-300">
                <span>{t("discount")}</span>
                <span>-{money(totals.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-base font-bold">
              <span>{t("total")}</span>
              <span>
                {money(totals.total)} {boot.companyDefaults.currency}
              </span>
            </div>
          </div>

          {boot.permissions.multiCurrency &&
          Object.keys(exchangeRates).length > 0 ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("tenderCurrency")}</label>
              <select
                value={tenderCurrency}
                onChange={(e) => setTenderCurrency(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm"
              >
                <option value="SAR">SAR</option>
                {(boot.allowedCurrencies ?? Object.keys(exchangeRates))
                  .filter((c) => c !== "SAR")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                      {exchangeRates[c] ? ` (${exchangeRates[c]})` : ""}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("tenderSarNote")}
              </p>
              {tenderEquivalent != null ? (
                <p className="text-xs">
                  {t("tenderEquivalent", {
                    amount: money(tenderEquivalent),
                    currency: tenderCurrency,
                    sar: money(totals.total),
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg border px-2 py-2 text-xs font-medium",
                docMode === "invoice"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)]",
              )}
              onClick={() => {
                if (lockDocMode) return;
                setDocMode("invoice");
                setEditingQuoteId(null);
              }}
              disabled={
                lockDocMode
                  ? docMode !== "invoice"
                  : !boot.roleOps?.invoiceCreate && !!boot.roleOps
              }
            >
              {t("docInvoice")}
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-lg border px-2 py-2 text-xs font-medium",
                docMode === "quote"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)]",
              )}
              onClick={() => {
                if (lockDocMode) return;
                setDocMode("quote");
              }}
              disabled={
                lockDocMode
                  ? docMode !== "quote"
                  : !boot.roleOps?.quoteCreate && !!boot.roleOps
              }
            >
              {t("docQuote")}
            </button>
          </div>

          {docMode === "invoice" ? (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["CASH", Banknote, t("payCash")],
                ["CARD", CreditCard, t("payCard")],
                ["MIXED", Split, t("paySplit")],
              ] as const
            ).map(([mode, Icon, label]) => (
              <button
                key={mode}
                type="button"
                disabled={pending}
                onClick={() => selectOrCharge(mode)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium disabled:opacity-50",
                  payMode === mode
                    ? "border-transparent text-white"
                    : "border-[var(--border)]",
                )}
                style={
                  payMode === mode ? { backgroundColor: accent } : undefined
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          ) : (
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {t("quoteModeHint")}
            </p>
          )}
          {docMode === "invoice" ? (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {t("quickPayHintNoCredit")}
          </p>
          ) : null}

          {docMode === "invoice" && (payMode === "CARD" || payMode === "MIXED") ? (
            <p className="text-[11px] leading-4 text-[var(--muted-foreground)]">
              {boot.paymentProvider?.message || t("cardManualHint")}
            </p>
          ) : null}

          {docMode === "invoice" && payMode === "MIXED" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t("payCash")}
                type="number"
                min={0}
                max={totals.total}
                step="0.01"
                value={splitCash}
                onChange={(e) => {
                  const balanced = balanceSplitAmount(e.target.value, totals.total);
                  if (!balanced) return;
                  setSplitCash(balanced.primary);
                  setSplitCard(balanced.rest);
                }}
              />
              <Input
                label={t("payCard")}
                type="number"
                min={0}
                max={totals.total}
                step="0.01"
                value={splitCard}
                onChange={(e) => {
                  const balanced = balanceSplitAmount(e.target.value, totals.total);
                  if (!balanced) return;
                  setSplitCard(balanced.primary);
                  setSplitCash(balanced.rest);
                }}
              />
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={autoPrint}
              onChange={(e) => setAutoPrint(e.target.checked)}
            />
            {t("autoPrint")}
          </label>

          <div className="grid gap-2">
            <Button
              type="button"
              disabled={pending || cart.length === 0}
              onClick={() => checkout("ISSUED")}
              className="h-12 text-base"
            >
              {docMode === "quote"
                ? editingQuoteId
                  ? t("updateQuote")
                  : t("createQuote")
                : t("charge")}
            </Button>
            {docMode === "invoice" && boot.permissions.holdRetrieve ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending || cart.length === 0}
                onClick={() => checkout("ON_HOLD")}
              >
                <Pause className="me-1 h-4 w-4" />
                {t("hold")}
              </Button>
            ) : null}
            {boot.permissions.openCashDrawer ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  const reason = window.prompt(t("drawerReason"));
                  if (!reason) return;
                  startTransition(async () => {
                    const res = await posOpenDrawer(companyId, reason);
                    if (res.error) toast.error(res.error);
                    else toast.success(t("drawerLogged"));
                  });
                }}
              >
                {t("openDrawer")}
              </Button>
            ) : null}
          </div>
        </div>
      </aside>
      ) : null}
    </div>
  );
}
