import {
  clearSessionCookies,
  readSessionFromCookies,
  setSessionCookies,
  COOKIE_REFRESH,
  COOKIE_USER,
  COOKIE_EXPIRES,
} from "@/lib/auth/session";
import { userFromAccessToken } from "@/lib/auth/jwt";
import { nestFetch } from "@/lib/api/client";
import type { AuthUser, SessionPayload } from "@/lib/types/auth";
import { cookies } from "next/headers";

async function refreshSession(
  refreshToken: string,
  previousUser: AuthUser,
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
        companyId: previousUser.companyId,
      }),
    });
    const session: SessionPayload = {
      user: userFromAccessToken(tokens.accessToken, previousUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
    try {
      await setSessionCookies(session);
    } catch {
      /* ignore Set-Cookie flakiness */
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

/**
 * Resolve a usable session for Route Handlers (PDF downloads, etc.).
 * Renews access when missing/near expiry using the refresh cookie —
 * pages can stay open after `erp_access` (10m) expires.
 */
export async function resolveApiSession(): Promise<SessionPayload | null> {
  let session = await readSessionFromCookies();

  if (!session) {
    const jar = await cookies();
    const refreshToken = jar.get(COOKIE_REFRESH)?.value;
    const userRaw = jar.get(COOKIE_USER)?.value;
    const expiresAt = jar.get(COOKIE_EXPIRES)?.value;
    if (!refreshToken || !userRaw) return null;
    try {
      const user = JSON.parse(userRaw) as AuthUser;
      session = await refreshSession(refreshToken, user);
      if (session && !session.expiresAt && expiresAt) {
        session = { ...session, expiresAt };
      }
      return session;
    } catch {
      return null;
    }
  }

  const expiresMs = Date.parse(session.expiresAt);
  if (
    Number.isFinite(expiresMs) &&
    expiresMs < Date.now() + 60_000 &&
    session.refreshToken
  ) {
    const refreshed = await refreshSession(
      session.refreshToken,
      session.user,
    );
    if (refreshed) return refreshed;
  }

  return session;
}
