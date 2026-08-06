import type { AppLocale } from "@/i18n/config";
import type { CredentialFieldDef } from "@/lib/integration-credentials";

export type ProviderOpAction = {
  label: string;
  capabilityCode: string;
  /** Fixed status / order_status sent in payload */
  status?: string;
  /** Include row amount in payload (Tabby/Tamara/Madfu) */
  includeAmount?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

export type ProviderOpsConfig = {
  ready: boolean;
  /** Create project via extension session first */
  connectViaExtension: boolean;
  /** Show credentials form (create and/or update) */
  showCredentials: boolean;
  authTypeDefault: "API_KEY" | "OAUTH2" | "BASIC" | "CUSTOM";
  credentialFields: CredentialFieldDef[];
  setupHint: string;
  /** Primary mirror list for the ops panel */
  primaryEntity: "orders" | "installments" | "products";
  entityTitle: string;
  emptyEntityMessage: string;
  actionsHint?: string;
  actions: ProviderOpAction[];
};

type L = { ar: string; en: string };

type LocalizedField = {
  name: string;
  label: L | string;
  type?: "text" | "password" | "textarea";
  hint?: L | string;
};

type LocalizedAction = {
  label: L | string;
  capabilityCode: string;
  status?: string;
  includeAmount?: boolean;
  variant?: "primary" | "secondary" | "ghost";
};

type LocalizedOps = {
  ready: boolean;
  connectViaExtension: boolean;
  showCredentials: boolean;
  authTypeDefault: "API_KEY" | "OAUTH2" | "BASIC" | "CUSTOM";
  credentialFields: LocalizedField[];
  setupHint: L;
  primaryEntity: "orders" | "installments" | "products";
  entityTitle: L;
  emptyEntityMessage: L;
  actionsHint?: L;
  actions: LocalizedAction[];
};

function pick(text: L | string, locale: AppLocale): string {
  if (typeof text === "string") return text;
  return text[locale] ?? text.ar;
}

function resolveField(field: LocalizedField, locale: AppLocale): CredentialFieldDef {
  return {
    name: field.name,
    label: pick(field.label, locale),
    type: field.type,
    hint: field.hint ? pick(field.hint, locale) : undefined,
  };
}

function resolveOps(ops: LocalizedOps, locale: AppLocale): ProviderOpsConfig {
  return {
    ready: ops.ready,
    connectViaExtension: ops.connectViaExtension,
    showCredentials: ops.showCredentials,
    authTypeDefault: ops.authTypeDefault,
    credentialFields: ops.credentialFields.map((f) => resolveField(f, locale)),
    setupHint: pick(ops.setupHint, locale),
    primaryEntity: ops.primaryEntity,
    entityTitle: pick(ops.entityTitle, locale),
    emptyEntityMessage: pick(ops.emptyEntityMessage, locale),
    actionsHint: ops.actionsHint ? pick(ops.actionsHint, locale) : undefined,
    actions: ops.actions.map((a) => ({
      label: pick(a.label, locale),
      capabilityCode: a.capabilityCode,
      status: a.status,
      includeAmount: a.includeAmount,
      variant: a.variant,
    })),
  };
}

const LATEST_ORDERS: L = {
  ar: "أحدث الطلبات",
  en: "Latest orders",
};
const NO_ORDERS: L = {
  ar: "لا طلبات مزامَنة بعد",
  en: "No synced orders yet",
};
const INSTALLMENTS: L = {
  ar: "عمليات الأقساط",
  en: "Installment transactions",
};
const ORDERS: L = { ar: "الطلبات", en: "Orders" };
const NOT_AVAILABLE: L = { ar: "غير متاح", en: "Not available" };
const OPTIONAL_BASE: L = {
  ar: "Base URL (اختياري)",
  en: "Base URL (optional)",
};

const PROVIDER_OPS: Record<string, LocalizedOps> = {
  HUNGERSTATION: {
    ready: true,
    connectViaExtension: true,
    showCredentials: true,
    authTypeDefault: "CUSTOM",
    credentialFields: [],
    setupHint: {
      ar: "ثبّت الإكستنشن وسجّل الدخول في partner-app.hungerstation.com، ثم احفظ الجلسة من هذه الصفحة. بعدها استخدم روابط الطلبات والتقارير والكتالوج والمتجر من القائمة الجانبية.",
      en: "Install the extension and sign in at partner-app.hungerstation.com, then save the session from this page. Then use Orders / Reports / Catalog / Store from the sidebar.",
    },
    primaryEntity: "orders",
    entityTitle: LATEST_ORDERS,
    emptyEntityMessage: NO_ORDERS,
    actionsHint: {
      ar: "المزامنة والعمليات عبر جلسة الإكستنشن فقط.",
      en: "Sync and operations use the extension session only.",
    },
    actions: [],
  },

  NINJA: {
    ready: true,
    connectViaExtension: true,
    showCredentials: true,
    authTypeDefault: "CUSTOM",
    credentialFields: [
      {
        name: "accessToken",
        label: "Access Token",
        type: "password",
        hint: {
          ar: "من بوابة Ninja أو عبر حفظ جلسة الإكستنشن",
          en: "From Ninja portal or via extension session save",
        },
      },
      {
        name: "vendorId",
        label: "Restaurant ID",
        hint: { ar: "معرّف المطعم", en: "Restaurant identifier" },
      },
      {
        name: "branchId",
        label: "Branch ID",
        hint: { ar: "مطلوب", en: "Required" },
      },
      {
        name: "menuId",
        label: "Menu ID",
        hint: {
          ar: "مطلوب لمزامنة المنتجات",
          en: "Required for product sync",
        },
      },
    ],
    setupHint: {
      ar: "احفظ جلسة الإكستنشن أو أدخل Access Token مع Restaurant / Branch / Menu ID ثم فعّل الربط.",
      en: "Save the extension session or enter Access Token with Restaurant / Branch / Menu ID, then activate the link.",
    },
    primaryEntity: "orders",
    entityTitle: LATEST_ORDERS,
    emptyEntityMessage: NO_ORDERS,
    actionsHint: {
      ar: "المزامنة فقط حاليًا — لا أوامر كتابة على Ninja بعد.",
      en: "Sync only for now — no write operations on Ninja yet.",
    },
    actions: [],
  },

  TOYOU: {
    ready: true,
    connectViaExtension: true,
    showCredentials: true,
    authTypeDefault: "CUSTOM",
    credentialFields: [
      {
        name: "accessToken",
        label: "Access Token",
        type: "password",
        hint: {
          ar: "JWT من merchant.toyou.io",
          en: "JWT from merchant.toyou.io",
        },
      },
    ],
    setupHint: {
      ar: "احفظ جلسة الإكستنشن من بوابة ToYou أو الصق Access Token يدويًا ثم فعّل.",
      en: "Save the extension session from the ToYou portal or paste an Access Token manually, then activate.",
    },
    primaryEntity: "orders",
    entityTitle: LATEST_ORDERS,
    emptyEntityMessage: NO_ORDERS,
    actionsHint: {
      ar: "المزامنة فقط حاليًا.",
      en: "Sync only for now.",
    },
    actions: [],
  },

  MRSOOL: {
    ready: true,
    connectViaExtension: true,
    showCredentials: true,
    authTypeDefault: "CUSTOM",
    credentialFields: [
      {
        name: "vendorId",
        label: "Branch / Vendor ID",
        hint: {
          ar: "اختياري لتضييق نطاق القائمة",
          en: "Optional to narrow list scope",
        },
      },
      {
        name: "branchId",
        label: {
          ar: "Branch ID (اختياري)",
          en: "Branch ID (optional)",
        },
      },
    ],
    setupHint: {
      ar: "الإكستنشن إلزامي. سجّل الدخول في business.mrsool.co ثم احفظ الجلسة وفعّل الربط.",
      en: "Extension is required. Sign in at business.mrsool.co, save the session, and activate the link.",
    },
    primaryEntity: "orders",
    entityTitle: LATEST_ORDERS,
    emptyEntityMessage: NO_ORDERS,
    actionsHint: {
      ar: "المزامنة عبر الجسر. تحديث المنتجات (تفعيل/إيقاف) متاح عبر العمليات عند الحاجة.",
      en: "Sync via bridge. Product updates (enable/disable) are available through operations when needed.",
    },
    actions: [],
  },

  TABBY: {
    ready: true,
    connectViaExtension: false,
    showCredentials: true,
    authTypeDefault: "API_KEY",
    credentialFields: [
      {
        name: "apiKey",
        label: "Secret Key",
        type: "password",
        hint: { ar: "مفتاح Tabby السري", en: "Tabby secret key" },
      },
      {
        name: "webhookSecret",
        label: "Webhook Secret",
        type: "password",
      },
      {
        name: "baseUrl",
        label: OPTIONAL_BASE,
        hint: {
          ar: "الافتراضي https://api.tabby.sa",
          en: "Default https://api.tabby.sa",
        },
      },
    ],
    setupHint: {
      ar: "أدخل Secret Key من لوحة تاجر Tabby ثم فعّل الربط.",
      en: "Enter the Secret Key from the Tabby merchant dashboard, then activate.",
    },
    primaryEntity: "installments",
    entityTitle: INSTALLMENTS,
    emptyEntityMessage: {
      ar: "لا معاملات أقساط بعد",
      en: "No installment transactions yet",
    },
    actionsHint: {
      ar: "Capture / Refund / Close على رقم الدفعة الخارجي.",
      en: "Capture / Refund / Close on the external payment reference.",
    },
    actions: [
      {
        label: "Capture",
        capabilityCode: "PAYMENT_CAPTURE",
        includeAmount: true,
        variant: "secondary",
      },
      {
        label: "Refund",
        capabilityCode: "PAYMENT_REFUND",
        includeAmount: true,
        variant: "secondary",
      },
      {
        label: { ar: "إغلاق", en: "Close" },
        capabilityCode: "PAYMENT_CLOSE",
        variant: "ghost",
      },
    ],
  },

  TAMARA: {
    ready: true,
    connectViaExtension: false,
    showCredentials: true,
    authTypeDefault: "API_KEY",
    credentialFields: [
      { name: "apiKey", label: "API Token", type: "password" },
      { name: "webhookSecret", label: "Webhook Secret", type: "password" },
      {
        name: "baseUrl",
        label: OPTIONAL_BASE,
        hint: {
          ar: "الافتراضي https://api.tamara.co",
          en: "Default https://api.tamara.co",
        },
      },
    ],
    setupHint: {
      ar: "أدخل API Token من Tamara. المزامنة القائمة فارغة غالبًا — الحالة تصل عبر Webhook.",
      en: "Enter the API Token from Tamara. The sync list is often empty — status arrives via webhook.",
    },
    primaryEntity: "installments",
    entityTitle: INSTALLMENTS,
    emptyEntityMessage: {
      ar: "لا معاملات بعد — ستظهر عبر الـ Webhook أو المزامنة",
      en: "No transactions yet — they appear via webhook or sync",
    },
    actionsHint: {
      ar: "Authorize / Capture / Cancel / Refund.",
      en: "Authorize / Capture / Cancel / Refund.",
    },
    actions: [
      {
        label: "Authorize",
        capabilityCode: "PAYMENT_AUTHORIZE",
        includeAmount: true,
        variant: "secondary",
      },
      {
        label: "Capture",
        capabilityCode: "PAYMENT_CAPTURE",
        includeAmount: true,
        variant: "secondary",
      },
      {
        label: { ar: "إلغاء", en: "Cancel" },
        capabilityCode: "PAYMENT_CANCEL",
        variant: "ghost",
      },
      {
        label: "Refund",
        capabilityCode: "PAYMENT_REFUND",
        includeAmount: true,
        variant: "ghost",
      },
    ],
  },

  MADFU: {
    ready: true,
    connectViaExtension: false,
    showCredentials: true,
    authTypeDefault: "CUSTOM",
    credentialFields: [
      { name: "apiKey", label: "API Key", type: "password" },
      { name: "appCode", label: "App Code" },
      {
        name: "basicToken",
        label: "Basic Token",
        type: "password",
        hint: {
          ar: "قيمة Basic بدون كلمة Basic",
          en: "Basic value without the Basic prefix",
        },
      },
      { name: "username", label: "Merchant username" },
      { name: "password", label: "Merchant password", type: "password" },
      {
        name: "baseUrl",
        label: OPTIONAL_BASE,
        hint: {
          ar: "الافتراضي https://api.madfu.com.sa",
          en: "Default https://api.madfu.com.sa",
        },
      },
      { name: "webhookSecret", label: "Webhook Secret", type: "password" },
    ],
    setupHint: {
      ar: "أدخل كامل بيانات Madfu (API Key + App Code + Basic + دخول التاجر).",
      en: "Enter full Madfu credentials (API Key + App Code + Basic + merchant login).",
    },
    primaryEntity: "installments",
    entityTitle: INSTALLMENTS,
    emptyEntityMessage: {
      ar: "لا معاملات Madfu بعد",
      en: "No Madfu transactions yet",
    },
    actionsHint: {
      ar: "Cancel / Refund على المعاملة.",
      en: "Cancel / Refund on the transaction.",
    },
    actions: [
      {
        label: { ar: "إلغاء", en: "Cancel" },
        capabilityCode: "PAYMENT_CANCEL",
        variant: "ghost",
      },
      {
        label: "Refund",
        capabilityCode: "PAYMENT_REFUND",
        includeAmount: true,
        variant: "secondary",
      },
    ],
  },

  ZID: {
    ready: true,
    connectViaExtension: false,
    showCredentials: true,
    authTypeDefault: "API_KEY",
    credentialFields: [
      { name: "apiKey", label: "Manager Token", type: "password" },
      {
        name: "storeId",
        label: "Store ID",
        hint: { ar: "مطلوب", en: "Required" },
      },
      {
        name: "baseUrl",
        label: OPTIONAL_BASE,
        hint: {
          ar: "الافتراضي https://api.zid.sa/v1",
          en: "Default https://api.zid.sa/v1",
        },
      },
      { name: "webhookSecret", label: "Webhook Secret", type: "password" },
    ],
    setupHint: {
      ar: "أدخل Manager Token و Store ID من لوحة زد ثم فعّل.",
      en: "Enter Manager Token and Store ID from the Zid dashboard, then activate.",
    },
    primaryEntity: "orders",
    entityTitle: LATEST_ORDERS,
    emptyEntityMessage: NO_ORDERS,
    actionsHint: {
      ar: "تحديث حالة الطلب على زد.",
      en: "Update order status on Zid.",
    },
    actions: [
      {
        label: { ar: "جاهز", en: "Ready" },
        capabilityCode: "ORDER_STATUS_UPDATE",
        status: "ready",
        variant: "secondary",
      },
      {
        label: { ar: "توصيل", en: "Delivering" },
        capabilityCode: "ORDER_STATUS_UPDATE",
        status: "delivering",
        variant: "secondary",
      },
      {
        label: { ar: "مُسلَّم", en: "Delivered" },
        capabilityCode: "ORDER_STATUS_UPDATE",
        status: "delivered",
        variant: "secondary",
      },
      {
        label: { ar: "إلغاء", en: "Cancel" },
        capabilityCode: "ORDER_STATUS_UPDATE",
        status: "cancelled",
        variant: "ghost",
      },
    ],
  },

  SALLA: {
    ready: true,
    connectViaExtension: false,
    showCredentials: true,
    authTypeDefault: "API_KEY",
    credentialFields: [
      {
        name: "accessToken",
        label: "Access Token",
        type: "password",
        hint: {
          ar: "توكن Salla Admin API",
          en: "Salla Admin API token",
        },
      },
      {
        name: "apiKey",
        label: { ar: "API Key (بديل)", en: "API Key (alternative)" },
        type: "password",
      },
      {
        name: "baseUrl",
        label: OPTIONAL_BASE,
        hint: {
          ar: "الافتراضي https://api.salla.dev/admin/v2",
          en: "Default https://api.salla.dev/admin/v2",
        },
      },
      { name: "webhookSecret", label: "Webhook Secret", type: "password" },
    ],
    setupHint: {
      ar: "أدخل Access Token من Salla ثم فعّل. مزامنة المنتجات متاحة؛ الطلبات لاحقًا.",
      en: "Enter Access Token from Salla, then activate. Product sync is available; orders coming later.",
    },
    primaryEntity: "products",
    entityTitle: { ar: "المنتجات", en: "Products" },
    emptyEntityMessage: {
      ar: "لا منتجات مزامَنة بعد",
      en: "No synced products yet",
    },
    actionsHint: {
      ar: "مزامنة المنتجات وتحديثها مدعومان. مزامنة الطلبات غير مكتملة بعد.",
      en: "Product sync and updates are supported. Order sync is not complete yet.",
    },
    actions: [],
  },

  THE_CHEFZ: {
    ready: false,
    connectViaExtension: false,
    showCredentials: false,
    authTypeDefault: "API_KEY",
    credentialFields: [],
    setupHint: {
      ar: "بانتظار حزمة API رسمية من The Chefz.",
      en: "Awaiting official API package from The Chefz.",
    },
    primaryEntity: "orders",
    entityTitle: ORDERS,
    emptyEntityMessage: NOT_AVAILABLE,
    actions: [],
  },
  JAHEZ: {
    ready: false,
    connectViaExtension: false,
    showCredentials: false,
    authTypeDefault: "API_KEY",
    credentialFields: [],
    setupHint: {
      ar: "يتطلب اعتماد Jahez وتفعيل بوابة التكامل.",
      en: "Requires Jahez approval and integration portal activation.",
    },
    primaryEntity: "orders",
    entityTitle: ORDERS,
    emptyEntityMessage: NOT_AVAILABLE,
    actions: [],
  },
  KEETA: {
    ready: false,
    connectViaExtension: false,
    showCredentials: false,
    authTypeDefault: "API_KEY",
    credentialFields: [],
    setupHint: {
      ar: "يتطلب اعتماد Keeta / SIT.",
      en: "Requires Keeta / SIT approval.",
    },
    primaryEntity: "orders",
    entityTitle: ORDERS,
    emptyEntityMessage: NOT_AVAILABLE,
    actions: [],
  },
  SHGARDI: {
    ready: false,
    connectViaExtension: false,
    showCredentials: false,
    authTypeDefault: "API_KEY",
    credentialFields: [],
    setupHint: {
      ar: "لا يوجد API عام موثّق بعد.",
      en: "No public documented API yet.",
    },
    primaryEntity: "orders",
    entityTitle: ORDERS,
    emptyEntityMessage: NOT_AVAILABLE,
    actions: [],
  },
  MIS_PAY: {
    ready: false,
    connectViaExtension: false,
    showCredentials: false,
    authTypeDefault: "API_KEY",
    credentialFields: [],
    setupHint: {
      ar: "الموصّل غير مكتمل بعد رغم وجود توثيق MIS Pay.",
      en: "Connector incomplete despite MIS Pay documentation.",
    },
    primaryEntity: "installments",
    entityTitle: { ar: "الأقساط", en: "Installments" },
    emptyEntityMessage: NOT_AVAILABLE,
    actions: [],
  },
  EMKAN: {
    ready: false,
    connectViaExtension: false,
    showCredentials: false,
    authTypeDefault: "API_KEY",
    credentialFields: [],
    setupHint: {
      ar: "يتطلب موافقة شريك Emkan.",
      en: "Requires Emkan partner approval.",
    },
    primaryEntity: "installments",
    entityTitle: { ar: "الأقساط", en: "Installments" },
    emptyEntityMessage: NOT_AVAILABLE,
    actions: [],
  },
};

const UNKNOWN_PROVIDER_OPS: LocalizedOps = {
  ready: false,
  connectViaExtension: false,
  showCredentials: false,
  authTypeDefault: "API_KEY",
  credentialFields: [],
  setupHint: {
    ar: "مزوّد غير مُعرَّف في الكتالوج.",
    en: "Provider is not defined in the catalog.",
  },
  primaryEntity: "orders",
  entityTitle: { ar: "البيانات", en: "Data" },
  emptyEntityMessage: NOT_AVAILABLE,
  actions: [],
};

export function providerOpsConfig(
  providerCode: string,
  locale: AppLocale = "ar",
): ProviderOpsConfig {
  const code = providerCode.toUpperCase();
  const base = PROVIDER_OPS[code] ?? UNKNOWN_PROVIDER_OPS;
  return resolveOps(base, locale === "en" ? "en" : "ar");
}

export const ALL_CREDENTIAL_FORM_KEYS = [
  "apiKey",
  "apiSecret",
  "accessToken",
  "clientId",
  "clientSecret",
  "merchantId",
  "vendorId",
  "branchId",
  "menuId",
  "storeId",
  "appCode",
  "basicToken",
  "username",
  "password",
  "baseUrl",
  "webhookSecret",
  "deviceToken",
  "refreshToken",
  "pxCookie",
  "cookiesJson",
  "grantedScopesText",
] as const;
