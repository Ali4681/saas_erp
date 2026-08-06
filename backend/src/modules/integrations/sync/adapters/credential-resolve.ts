import type { CredentialPayload } from '../../effective-capability.service';

export function resolveAccessToken(credentials: CredentialPayload): string {
  const candidates = [
    credentials.accessToken,
    credentials.apiKey,
    credentials.token,
    credentials.manager_token,
    credentials.managerToken,
    credentials.x_manager_token,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function resolveStoreId(credentials: CredentialPayload): string {
  const candidates = [
    credentials.storeId,
    credentials.store_id,
    credentials.store,
  ];
  for (const value of candidates) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function resolveBaseUrl(
  credentials: CredentialPayload,
  fallback: string,
): string {
  const raw =
    (typeof credentials.baseUrl === 'string' && credentials.baseUrl) ||
    (typeof credentials.api_url === 'string' && credentials.api_url) ||
    (typeof credentials.apiUrl === 'string' && credentials.apiUrl) ||
    fallback;
  return String(raw).replace(/\/$/, '');
}

export function bilingualName(value: unknown, fallback = 'Untitled'): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of ['ar', 'en', 'name', 'title']) {
      const part = obj[key];
      if (typeof part === 'string' && part.trim()) return part.trim();
    }
  }
  return fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function money(value: unknown, fallback = '0'): string {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object' && value && 'amount' in value) {
    return money((value as { amount: unknown }).amount, fallback);
  }
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : fallback;
}
