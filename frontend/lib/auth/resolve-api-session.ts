import {
  applySessionCookies,
  readSessionFromCookies,
  COOKIE_REFRESH,
  COOKIE_USER,
  COOKIE_EXPIRES,
} from "@/lib/auth/session";
import { userFromAccessToken } from "@/lib/auth/jwt";
import { nestFetch } from "@/lib/api/client";
import type { AuthUser, SessionPayload } from "@/lib/types/auth";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export type ResolvedApiSession = {
  session: SessionPayload | null;
  /** When set, attach these cookies on the Route Handler response. */
  cookieSession: SessionPayload | null;
};

async function performRefresh(
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
    return {
      user: userFromAccessToken(tokens.accessToken, previousUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
  } catch {
    return null;
  }
}

/** Attach refreshed session cookies to a Route Handler response. */
export function applyResolvedSessionCookies(
  res: NextResponse,
  resolved: ResolvedApiSession | null | undefined,
) {
  if (resolved?.cookieSession) {
    return applySessionCookies(res, resolved.cookieSession);
  }
  return res;
}

/**
 * Resolve a usable session for Route Handlers (PDF downloads, etc.).
 * Renews access when missing/near expiry using the refresh cookie.
 * Callers must use `applyResolvedSessionCookies` on the response so
 * Set-Cookie is reliable (cookies() alone is flaky in Route Handlers).
 */
export async function resolveApiSession(): Promise<ResolvedApiSession> {
  let session = await readSessionFromCookies();
  let cookieSession: SessionPayload | null = null;

  if (!session) {
    const jar = await cookies();
    const refreshToken = jar.get(COOKIE_REFRESH)?.value;
    const userRaw = jar.get(COOKIE_USER)?.value;
    const expiresAt = jar.get(COOKIE_EXPIRES)?.value;
    if (!refreshToken || !userRaw) {
      return { session: null, cookieSession: null };
    }
    try {
      const user = JSON.parse(userRaw) as AuthUser;
      const refreshed = await performRefresh(refreshToken, user);
      if (!refreshed) return { session: null, cookieSession: null };
      if (!refreshed.expiresAt && expiresAt) {
        refreshed.expiresAt = expiresAt;
      }
      return { session: refreshed, cookieSession: refreshed };
    } catch {
      return { session: null, cookieSession: null };
    }
  }

  const expiresMs = Date.parse(session.expiresAt);
  if (
    Number.isFinite(expiresMs) &&
    expiresMs < Date.now() + 60_000 &&
    session.refreshToken
  ) {
    const refreshed = await performRefresh(session.refreshToken, session.user);
    if (refreshed) {
      return { session: refreshed, cookieSession: refreshed };
    }
  }

  return { session, cookieSession };
}
