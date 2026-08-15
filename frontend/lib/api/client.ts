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

  let res: Response;
  try {
    res = await fetch(url, {
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
  } catch (error) {
    const cause =
      error instanceof Error && "cause" in error
        ? (error as Error & { cause?: { code?: string } }).cause
        : undefined;
    const offline =
      cause?.code === "ECONNREFUSED" ||
      (error instanceof Error && /fetch failed|ECONNREFUSED/i.test(error.message));
    throw new ApiError(
      503,
      offline
        ? "API server is unreachable. Is the backend running on port 3000?"
        : error instanceof Error
          ? error.message
          : "Network request failed",
      { cause },
    );
  }

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
    const obj =
      typeof data === "object" && data != null
        ? (data as {
            message?: unknown;
            details?: unknown;
          })
        : null;
    let message =
      obj && obj.message != null
        ? Array.isArray(obj.message)
          ? obj.message.join(", ")
          : String(obj.message)
        : `Request failed (${res.status})`;
    if (obj && Array.isArray(obj.details) && obj.details.length > 0) {
      message = `${message}: ${obj.details.map(String).join("; ")}`;
    }
    throw new ApiError(res.status, message, data);
  }

  return data as T;
}
