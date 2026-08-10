import { cookies } from "next/headers";
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

const secure = process.env.NODE_ENV === "production";

export async function setSessionCookies(session: SessionPayload) {
  const jar = await cookies();
  const common = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
  };

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

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of [
    COOKIE_ACCESS,
    COOKIE_REFRESH,
    COOKIE_USER,
    COOKIE_EXPIRES,
  ]) {
    jar.delete(name);
  }
}

/** Deduped per RSC request — layouts/pages share one cookie parse. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
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
});
