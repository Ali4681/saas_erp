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
      body: JSON.stringify({ refreshToken }),
    });
    const session: SessionPayload = {
      user: userFromAccessToken(tokens.accessToken, previous.user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    await setSessionCookies(session);
    return session;
  } catch {
    await clearSessionCookies();
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
    expiresMs < Date.now() + 30_000 &&
    session.refreshToken
  ) {
    session = (await refreshSession(session.refreshToken, session)) ?? session;
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
