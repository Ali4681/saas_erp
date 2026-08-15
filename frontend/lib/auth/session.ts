import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { cache } from "react";
import type { AuthUser, SessionPayload } from "@/lib/types/auth";
import {
  COOKIE_ACCESS,
  COOKIE_EXPIRES,
  COOKIE_REFRESH,
  COOKIE_USER,
} from "@/lib/auth/cookie-names";

export {
  COOKIE_ACCESS,
  COOKIE_EXPIRES,
  COOKIE_REFRESH,
  COOKIE_USER,
} from "@/lib/auth/cookie-names";

/** Prefer explicit COOKIE_SECURE; otherwise Secure only in production. */
function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

function commonCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
  };
}

type CookieJar = {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      path?: string;
      maxAge?: number;
    },
  ) => void;
};

function writeSessionCookies(jar: CookieJar, session: SessionPayload) {
  const common = commonCookieOptions();
  jar.set(COOKIE_ACCESS, session.accessToken, {
    ...common,
    maxAge: 60 * 60 * 12,
  });
  jar.set(COOKIE_REFRESH, session.refreshToken, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set(COOKIE_USER, JSON.stringify(session.user), {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
  jar.set(COOKIE_EXPIRES, session.expiresAt, {
    ...common,
    maxAge: 60 * 60 * 24 * 30,
  });
}

function clearJarSessionCookies(jar: {
  delete: (name: string) => void;
}) {
  for (const name of [
    COOKIE_ACCESS,
    COOKIE_REFRESH,
    COOKIE_USER,
    COOKIE_EXPIRES,
  ]) {
    jar.delete(name);
  }
}

/** Attach session cookies to a Route Handler response (reliable Set-Cookie). */
export function applySessionCookies(
  res: NextResponse,
  session: SessionPayload,
) {
  writeSessionCookies(res.cookies, session);
  return res;
}

export function clearSessionCookiesOn(res: NextResponse) {
  clearJarSessionCookies(res.cookies);
  return res;
}

/** For Server Actions / RSC paths that use next/headers cookies(). */
export async function setSessionCookies(session: SessionPayload) {
  const jar = await cookies();
  writeSessionCookies(jar, session);
}

export async function clearSessionCookies() {
  const jar = await cookies();
  clearJarSessionCookies(jar);
}

/** Deduped per RSC request — layouts/pages share one cookie parse. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  return readSessionFromCookies();
});

/**
 * Always re-read cookies (no React cache). Use from Route Handlers / apiServer
 * so auth is not polluted by a stale RSC memoization entry.
 */
export async function readSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const accessToken = jar.get(COOKIE_ACCESS)?.value;
  const refreshToken = jar.get(COOKIE_REFRESH)?.value;
  const userRaw = jar.get(COOKIE_USER)?.value;
  const expiresAt = jar.get(COOKIE_EXPIRES)?.value;
  if (!accessToken || !refreshToken || !userRaw || !expiresAt) {
    return null;
  }
  try {
    const user = JSON.parse(userRaw) as AuthUser;
    return { user, accessToken, refreshToken, expiresAt };
  } catch {
    return null;
  }
}
