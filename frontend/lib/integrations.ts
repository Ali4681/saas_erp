import type { AppLocale } from "@/i18n/config";

export type IntegrationCategory = {
  id: string;
  code: string;
  name: string;
};

export type IntegrationProvider = {
  id: string;
  code: string;
  name: string;
  apiAvailability: string;
  requiresApproval: boolean;
  officialDocsUrl?: string | null;
  category: IntegrationCategory;
};

export type IntegrationCapability = {
  id: string;
  code: string;
  name: string;
  entityType: string;
  direction: string;
  description?: string | null;
};

export type IntegrationProviderCapability = {
  supportStatus: string;
  requiredScope?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
  verifiedAt?: string | null;
  capability: IntegrationCapability;
};

export type IntegrationProviderDetail = IntegrationProvider & {
  capabilities: IntegrationProviderCapability[];
};

type LocalizedLabel = Record<AppLocale, string>;

export const CATEGORY_LABELS: Record<string, LocalizedLabel> = {
  DELIVERY: { ar: "التوصيل", en: "Delivery" },
  INSTALLMENT: { ar: "الأقساط", en: "Installments" },
  ECOMMERCE: { ar: "المتاجر", en: "Stores" },
};

export const CATEGORY_ORDER = ["DELIVERY", "INSTALLMENT", "ECOMMERCE"] as const;

/** Tenant dashboard channels available to every company. */
export const COMPANY_CHANNEL_SECTIONS = [
  {
    code: "DELIVERY" as const,
    slug: "delivery",
    label: CATEGORY_LABELS.DELIVERY.ar,
    description: "منصات التوصيل والطلبات",
    providers: [
      { code: "HUNGERSTATION", name: "HungerStation" },
      { code: "THE_CHEFZ", name: "The Chefz" },
      { code: "TOYOU", name: "ToYou" },
      { code: "MRSOOL", name: "Mrsool" },
      { code: "NINJA", name: "Ninja" },
      { code: "JAHEZ", name: "Jahez" },
      { code: "KEETA", name: "Keeta" },
      { code: "SHGARDI", name: "Shgardi" },
    ],
  },
  {
    code: "INSTALLMENT" as const,
    slug: "installments",
    label: CATEGORY_LABELS.INSTALLMENT.ar,
    description: "حلول الدفع بالأقساط",
    providers: [
      { code: "TABBY", name: "Tabby" },
      { code: "TAMARA", name: "Tamara" },
      { code: "MADFU", name: "Madfu" },
      { code: "MIS_PAY", name: "MIS Pay" },
      { code: "EMKAN", name: "Emkan" },
    ],
  },
  {
    code: "ECOMMERCE" as const,
    slug: "stores",
    label: CATEGORY_LABELS.ECOMMERCE.ar,
    description: "منصات المتاجر الإلكترونية",
    providers: [
      { code: "ZID", name: "Zid" },
      { code: "SALLA", name: "Salla" },
    ],
  },
] as const;

export type CompanyChannelSlug =
  (typeof COMPANY_CHANNEL_SECTIONS)[number]["slug"];

export function channelBySlug(slug: string) {
  return COMPANY_CHANNEL_SECTIONS.find((s) => s.slug === slug) ?? null;
}

/** Providers that sync via Chrome extension WebSocket bridge. */
export const EXTENSION_PROVIDER_CHANNELS: Record<string, string> = {
  HUNGERSTATION: "hungerstation",
  NINJA: "ninja",
  TOYOU: "toyou",
  MRSOOL: "mrsool",
};

export function extensionChannelForProvider(providerCode: string) {
  return EXTENSION_PROVIDER_CHANNELS[providerCode.toUpperCase()] ?? null;
}

export const CAPABILITY_SUPPORT_LABELS: Record<string, LocalizedLabel> = {
  VERIFIED: { ar: "موثّق", en: "Verified" },
  UNVERIFIED: { ar: "غير موثّق", en: "Unverified" },
  NOT_SUPPORTED: { ar: "غير مدعوم", en: "Not supported" },
  PARTNER_ENABLED: { ar: "عبر الشريك", en: "Partner enabled" },
};

export const CAPABILITY_DIRECTION_LABELS: Record<string, LocalizedLabel> = {
  INBOUND: { ar: "وارد", en: "Inbound" },
  OUTBOUND: { ar: "صادر", en: "Outbound" },
  BOTH: { ar: "ثنائي", en: "Bidirectional" },
};

function pickLocaleLabel(
  map: Record<string, LocalizedLabel>,
  code: string,
  locale: AppLocale,
  fallback: string,
) {
  return map[code]?.[locale] ?? fallback;
}

export function categoryLabel(
  category: IntegrationCategory | string,
  locale: AppLocale = "ar",
) {
  const code = typeof category === "string" ? category : category.code;
  const fallback =
    typeof category === "string" ? code : category.name;
  return pickLocaleLabel(CATEGORY_LABELS, code, locale, fallback);
}

export function capabilitySupportLabel(
  supportStatus: string,
  locale: AppLocale = "ar",
) {
  return pickLocaleLabel(
    CAPABILITY_SUPPORT_LABELS,
    supportStatus,
    locale,
    supportStatus,
  );
}

export function capabilityDirectionLabel(
  direction: string,
  locale: AppLocale = "ar",
) {
  return pickLocaleLabel(
    CAPABILITY_DIRECTION_LABELS,
    direction,
    locale,
    direction,
  );
}

export function groupProvidersByCategory(
  providers: IntegrationProvider[],
  locale: AppLocale = "ar",
) {
  const grouped = new Map<string, IntegrationProvider[]>();
  for (const code of CATEGORY_ORDER) {
    grouped.set(code, []);
  }
  for (const provider of providers) {
    const code = provider.category.code;
    const list = grouped.get(code) ?? [];
    list.push(provider);
    grouped.set(code, list);
  }
  return CATEGORY_ORDER.map((code) => ({
    code,
    label: categoryLabel(code, locale),
    providers: (grouped.get(code) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}
