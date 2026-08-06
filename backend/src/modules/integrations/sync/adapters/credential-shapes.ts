import type { CredentialPayload } from '../../effective-capability.service';

/** Documented credential keys used across provider adapters (Phase 0+). */
export type IntegrationCredentialFields = CredentialPayload & {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  username?: string;
  password?: string;
  grantedScopes?: string[];
  /** Ecommerce manager / store binding */
  storeId?: string;
  /** Delivery partner vendor / merchant id */
  vendorId?: string;
  merchantId?: string;
  /** Ninja branch / menu scoping */
  branchId?: string;
  menuId?: string;
  restaurantId?: string;
  /** Madfu merchant headers */
  appCode?: string;
  basicToken?: string;
  /** Partner portal cookie bag (JSON object or serialized string) */
  cookies?: Record<string, string> | string;
  cookiesJson?: string;
  /** PerimeterX / anti-bot cookie when present */
  pxCookie?: string;
  webhookSecret?: string;
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  deviceToken?: string;
};

export type CredentialFieldPreset = {
  authTypeDefault: 'API_KEY' | 'OAUTH2' | 'BASIC' | 'CUSTOM';
  fields: Array<{
    name: keyof IntegrationCredentialFields | 'grantedScopesText';
    label: string;
    type?: 'text' | 'password' | 'textarea';
    hint?: string;
  }>;
};

export const ECOMMERCE_CREDENTIAL_PRESET: CredentialFieldPreset = {
  authTypeDefault: 'API_KEY',
  fields: [
    { name: 'apiKey', label: 'API Key / Manager Token', type: 'password' },
    { name: 'accessToken', label: 'Access Token (اختياري)', type: 'password' },
    { name: 'storeId', label: 'Store ID' },
    { name: 'baseUrl', label: 'Base URL (اختياري)', hint: 'مثل https://api.zid.sa/v1' },
    {
      name: 'grantedScopesText',
      label: 'Scopes (مفصولة بفاصلة)',
      hint: 'مثال: products.read,orders.read',
    },
    { name: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
  ],
};

export const INSTALLMENT_CREDENTIAL_PRESET: CredentialFieldPreset = {
  authTypeDefault: 'API_KEY',
  fields: [
    { name: 'apiKey', label: 'Secret / API Key', type: 'password' },
    { name: 'accessToken', label: 'Access Token (اختياري)', type: 'password' },
    { name: 'clientId', label: 'Client ID (اختياري)' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    { name: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
    {
      name: 'grantedScopesText',
      label: 'Scopes (مفصولة بفاصلة)',
      hint: 'مثال: checkout:write,payments:read',
    },
  ],
};

/** Madfu two-step merchant auth (api.madfu.com.sa). */
export const MADFU_CREDENTIAL_PRESET: CredentialFieldPreset = {
  authTypeDefault: 'CUSTOM',
  fields: [
    { name: 'apiKey', label: 'API Key', type: 'password' },
    {
      name: 'appCode',
      label: 'App Code',
      hint: 'رأس AppCode في طلبات Madfu',
    },
    {
      name: 'basicToken',
      label: 'Basic Token',
      type: 'password',
      hint: 'قيمة Authorization: Basic … بدون كلمة Basic',
    },
    { name: 'username', label: 'Merchant username (sign-in)' },
    { name: 'password', label: 'Merchant password', type: 'password' },
    {
      name: 'baseUrl',
      label: 'Base URL (اختياري)',
      hint: 'الافتراضي https://api.madfu.com.sa',
    },
    { name: 'webhookSecret', label: 'Webhook Secret (إن وُجد)', type: 'password' },
  ],
};

export const DELIVERY_CREDENTIAL_PRESET: CredentialFieldPreset = {
  authTypeDefault: 'CUSTOM',
  fields: [
    { name: 'accessToken', label: 'Access Token', type: 'password' },
    { name: 'refreshToken', label: 'Refresh Token', type: 'password' },
    { name: 'deviceToken', label: 'Device Token' },
    {
      name: 'vendorId',
      label: 'Vendor / Restaurant / Merchant ID',
      hint: 'Ninja: restaurantId · Mrsool: branchId · HS: vendorId',
    },
    {
      name: 'branchId',
      label: 'Branch ID',
      hint: 'مطلوب لـ Ninja (branchId)',
    },
    {
      name: 'menuId',
      label: 'Menu ID',
      hint: 'مطلوب لـ Ninja لمزامنة المنتجات',
    },
    { name: 'username', label: 'Partner username' },
    { name: 'password', label: 'Partner password', type: 'password' },
    {
      name: 'cookiesJson',
      label: 'Cookies JSON',
      type: 'textarea',
      hint: 'كائن JSON لجلسة Partner Portal (HungerStation / Mrsool)',
    },
    { name: 'pxCookie', label: 'PerimeterX cookie (_px3)' },
    {
      name: 'grantedScopesText',
      label: 'Scopes (مفصولة بفاصلة)',
      hint: 'مثال: orders:read,catalog:read',
    },
    { name: 'webhookSecret', label: 'Webhook Secret', type: 'password' },
  ],
};

export function credentialPresetForCategory(
  categoryCode: string | null | undefined,
  providerCode?: string | null,
): CredentialFieldPreset {
  if ((providerCode ?? '').toUpperCase() === 'MADFU') {
    return MADFU_CREDENTIAL_PRESET;
  }
  const code = (categoryCode ?? '').toUpperCase();
  if (code === 'INSTALLMENT') return INSTALLMENT_CREDENTIAL_PRESET;
  if (code === 'DELIVERY') return DELIVERY_CREDENTIAL_PRESET;
  return ECOMMERCE_CREDENTIAL_PRESET;
}

function parseScopes(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function parseCookies(raw: unknown): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v != null && String(v).trim()) out[k] = String(v);
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parseCookies(parsed);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Strip empties, normalize scopes/cookies for encrypted storage. */
export function normalizeCredentialPayload(
  input: Record<string, unknown>,
): CredentialPayload {
  const out: CredentialPayload = {};

  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (key === 'grantedScopesText') continue;
    if (typeof value === 'string' && !value.trim()) continue;
    out[key] = value;
  }

  const scopes =
    parseScopes(input.grantedScopesText) ?? parseScopes(input.grantedScopes);
  if (scopes?.length) out.grantedScopes = scopes;

  const cookies =
    parseCookies(input.cookiesJson) ?? parseCookies(input.cookies);
  if (cookies) out.cookies = cookies;

  delete out.cookiesJson;
  delete (out as Record<string, unknown>).grantedScopesText;

  return out;
}

export function hasAnyAuthSecret(payload: CredentialPayload): boolean {
  return Boolean(
    payload.apiKey ||
      payload.accessToken ||
      payload.password ||
      payload.clientSecret ||
      (payload.cookies &&
        typeof payload.cookies === 'object' &&
        Object.keys(payload.cookies as object).length > 0),
  );
}
