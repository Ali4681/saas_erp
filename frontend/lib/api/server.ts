import {
  clearSessionCookies,
  readSessionFromCookies,
  setSessionCookies,
} from "@/lib/auth/session";
import { userFromAccessToken } from "@/lib/auth/jwt";
import { nestFetch, ApiError } from "@/lib/api/client";
import { getAppLocale } from "@/lib/i18n/locale-server";
import type { SessionPayload } from "@/lib/types/auth";

async function refreshSession(
  refreshToken: string,
  previous: SessionPayload,
): Promise<SessionPayload | null> {
  try {
    const tokens = await nestFetch<{
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken,
        companyId: previous.user.companyId,
      }),
    });
    const session: SessionPayload = {
      user: userFromAccessToken(tokens.accessToken, previous.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    // Cookie writes from RSC are flaky in Next — never wipe the session if
    // only Set-Cookie fails; this request can still use the new tokens.
    try {
      await setSessionCookies(session);
    } catch {
      /* ignore — Route Handler / next navigation may still refresh */
    }
    return session;
  } catch {
    try {
      await clearSessionCookies();
    } catch {
      /* ignore */
    }
    return null;
  }
}

type ApiServerInit = RequestInit & {
  /** Override tenant header (use URL companyId for platform admin). */
  companyId?: string | null;
};

export async function apiServer<T>(
  path: string,
  init: ApiServerInit = {},
): Promise<T> {
  const { companyId: companyIdOverride, ...rest } = init;
  // Fresh cookie read — never use React cache() here (Route Handlers / polls).
  let session = await readSessionFromCookies();
  if (!session) {
    throw new ApiError(401, "غير مسجّل الدخول");
  }

  // Refresh before the request if the access token is near expiry (avoid
  // fail-then-retry double RTT on soft navigations).
  const expiresMs = Date.parse(session.expiresAt);
  if (
    Number.isFinite(expiresMs) &&
    expiresMs < Date.now() + 60_000 &&
    session.refreshToken
  ) {
    const refreshed = await refreshSession(session.refreshToken, session);
    if (refreshed) session = refreshed;
    if (!session.accessToken) {
      throw new ApiError(401, "انتهت الجلسة");
    }
  }

  const companyId =
    companyIdOverride !== undefined
      ? companyIdOverride
      : session.user.companyId;

  const locale = await getAppLocale();

  try {
    return await nestFetch<T>(path, {
      ...rest,
      accessToken: session.accessToken,
      companyId,
      locale,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    session = await refreshSession(session.refreshToken, session);
    if (!session) {
      throw new ApiError(401, "انتهت الجلسة");
    }
    return nestFetch<T>(path, {
      ...rest,
      accessToken: session.accessToken,
      companyId:
        companyIdOverride !== undefined
          ? companyIdOverride
          : session.user.companyId,
      locale,
    });
  }
}
