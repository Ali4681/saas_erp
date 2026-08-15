export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

export type ProviderHttpRequest = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  /** When true, do not throw on non-2xx; return status + parsed body */
  raw?: boolean;
};

export type ProviderHttpResponse<T = unknown> = {
  ok: boolean;
  status: number;
  headers: Headers;
  data: T;
  text: string;
};

function buildUrl(url: string, query?: ProviderHttpRequest['query']): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v == null || v === '') continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/**
 * Shared outbound HTTP for provider adapters (Phase 0 foundation).
 * Uses global fetch available on Node 18+.
 */
export async function providerFetch<T = unknown>(
  req: ProviderHttpRequest,
): Promise<ProviderHttpResponse<T>> {
  const method = req.method ?? (req.body !== undefined ? 'POST' : 'GET');
  const url = buildUrl(req.url, req.query);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(req.headers ?? {}),
  };

  let body: string | undefined;
  if (req.body !== undefined && req.body !== null) {
    if (
      typeof req.body === 'string' ||
      req.body instanceof URLSearchParams ||
      Buffer.isBuffer(req.body)
    ) {
      body = String(req.body);
    } else {
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
      body = JSON.stringify(req.body);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 30_000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: T = null as T;
    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text as T;
      }
    }

    const result: ProviderHttpResponse<T> = {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      data,
      text,
    };

    if (!res.ok && !req.raw) {
      const message =
        typeof data === 'object' &&
        data &&
        'message' in data &&
        (data as { message: unknown }).message != null
          ? String((data as { message: unknown }).message)
          : `Provider HTTP ${res.status}`;
      throw new ProviderHttpError(message, res.status, data, url);
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export function bearerHeaders(
  token: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(extra ?? {}),
  };
}

export function cookieHeader(
  cookies: Record<string, string> | string | undefined,
): string | undefined {
  if (!cookies) return undefined;
  if (typeof cookies === 'string') return cookies;
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
