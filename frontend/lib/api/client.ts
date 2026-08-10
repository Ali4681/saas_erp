import { defaultLocale } from "@/i18n/config";
import { readLocaleFromDocument } from "@/lib/i18n/locale";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3000";
  // Nest uses global prefix `api` (see backend/src/main.ts)
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export async function nestFetch<T>(
  path: string,
  init: RequestInit & {
    accessToken?: string;
    companyId?: string | null;
    /** Override Accept-Language / X-Locale (defaults to cookie locale). */
    locale?: string;
  } = {},
): Promise<T> {
  const { accessToken, companyId, locale: localeOverride, headers, ...rest } =
    init;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const locale =
    localeOverride ||
    (typeof document !== "undefined"
      ? readLocaleFromDocument()
      : defaultLocale);

  const res = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": locale,
      "X-Locale": locale,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(companyId ? { "X-Company-Id": companyId } : {}),
      ...(headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      typeof data === "object" &&
      data &&
      "message" in data &&
      (data as { message: unknown }).message != null
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(", ")
          : String((data as { message: unknown }).message)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}
