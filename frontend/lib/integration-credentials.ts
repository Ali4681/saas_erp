export type CredentialFieldDef = {
  name: string;
  label: string;
  type?: "text" | "password" | "textarea";
  hint?: string;
};

export type CredentialPreset = {
  authTypeDefault: "API_KEY" | "OAUTH2" | "BASIC" | "CUSTOM";
  fields: CredentialFieldDef[];
};

export const ECOMMERCE_CREDENTIAL_PRESET: CredentialPreset = {
  authTypeDefault: "API_KEY",
  fields: [
    { name: "apiKey", label: "API Key / Manager Token", type: "password" },
    {
      name: "accessToken",
      label: "Access Token (اختياري)",
      type: "password",
    },
    { name: "storeId", label: "Store ID" },
    {
      name: "baseUrl",
      label: "Base URL (اختياري)",
      hint: "مثل https://api.zid.sa/v1",
    },
    {
      name: "grantedScopesText",
      label: "Scopes (مفصولة بفاصلة)",
      hint: "مثال: products.read,orders.read",
    },
    { name: "webhookSecret", label: "Webhook Secret", type: "password" },
  ],
};

export const INSTALLMENT_CREDENTIAL_PRESET: CredentialPreset = {
  authTypeDefault: "API_KEY",
  fields: [
    { name: "apiKey", label: "Secret / API Key", type: "password" },
    {
      name: "accessToken",
      label: "Access Token (اختياري)",
      type: "password",
    },
    { name: "clientId", label: "Client ID (اختياري)" },
    { name: "clientSecret", label: "Client Secret", type: "password" },
    { name: "webhookSecret", label: "Webhook Secret", type: "password" },
    {
      name: "grantedScopesText",
      label: "Scopes (مفصولة بفاصلة)",
      hint: "مثال: checkout:write,payments:read",
    },
  ],
};

export const MADFU_CREDENTIAL_PRESET: CredentialPreset = {
  authTypeDefault: "CUSTOM",
  fields: [
    { name: "apiKey", label: "API Key", type: "password" },
    {
      name: "appCode",
      label: "App Code",
      hint: "رأس AppCode في طلبات Madfu",
    },
    {
      name: "basicToken",
      label: "Basic Token",
      type: "password",
      hint: "قيمة Authorization: Basic … بدون كلمة Basic",
    },
    { name: "username", label: "Merchant username (sign-in)" },
    { name: "password", label: "Merchant password", type: "password" },
    {
      name: "baseUrl",
      label: "Base URL (اختياري)",
      hint: "الافتراضي https://api.madfu.com.sa",
    },
    {
      name: "webhookSecret",
      label: "Webhook Secret (إن وُجد)",
      type: "password",
    },
  ],
};

export const DELIVERY_CREDENTIAL_PRESET: CredentialPreset = {
  authTypeDefault: "CUSTOM",
  fields: [
    { name: "accessToken", label: "Access Token", type: "password" },
    { name: "refreshToken", label: "Refresh Token", type: "password" },
    { name: "deviceToken", label: "Device Token" },
    {
      name: "vendorId",
      label: "Vendor / Restaurant / Merchant ID",
      hint: "Ninja: restaurantId · Mrsool: branchId · HS: vendorId",
    },
    {
      name: "branchId",
      label: "Branch ID",
      hint: "مطلوب لـ Ninja",
    },
    {
      name: "menuId",
      label: "Menu ID",
      hint: "مطلوب لـ Ninja لمزامنة المنتجات",
    },
    { name: "username", label: "Partner username" },
    { name: "password", label: "Partner password", type: "password" },
    {
      name: "cookiesJson",
      label: "Cookies JSON",
      type: "textarea",
      hint: "كائن JSON لجلسة Partner Portal (HungerStation / Mrsool)",
    },
    { name: "pxCookie", label: "PerimeterX cookie (_px3)" },
    {
      name: "grantedScopesText",
      label: "Scopes (مفصولة بفاصلة)",
      hint: "مثال: orders:read,catalog:read",
    },
    { name: "webhookSecret", label: "Webhook Secret", type: "password" },
  ],
};

export function credentialPresetForCategory(
  categoryCode?: string | null,
  providerCode?: string | null,
) {
  if ((providerCode ?? "").toUpperCase() === "MADFU") {
    return MADFU_CREDENTIAL_PRESET;
  }
  const code = (categoryCode ?? "").toUpperCase();
  if (code === "INSTALLMENT") return INSTALLMENT_CREDENTIAL_PRESET;
  if (code === "DELIVERY") return DELIVERY_CREDENTIAL_PRESET;
  return ECOMMERCE_CREDENTIAL_PRESET;
}
