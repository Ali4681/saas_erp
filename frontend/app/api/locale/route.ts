import { after, NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";

export async function POST(request: Request) {
  let locale: AppLocale = defaultLocale;
  try {
    const body = (await request.json()) as { locale?: unknown };
    if (isAppLocale(body.locale)) locale = body.locale;
  } catch {
    locale = defaultLocale;
  }

  const session = await getSession();
  if (session) {
    const accessToken = session.accessToken;
    const nextLocale = locale;
    after(async () => {
      try {
        await nestFetch("/auth/me/locale", {
          method: "PATCH",
          accessToken,
          headers: {
            "Accept-Language": nextLocale,
            "X-Locale": nextLocale,
          },
          body: JSON.stringify({ locale: nextLocale }),
        });
      } catch {
        // Preference cookie already set; DB sync is best-effort
      }
    });
  }

  const res = NextResponse.json({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
