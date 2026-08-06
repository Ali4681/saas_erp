import { COOKIE_ACCESS, COOKIE_USER } from "@/lib/auth/cookie-names";
import type { AuthUser } from "@/lib/types/auth";
import { homePathFor } from "@/lib/permissions";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
} from "@/i18n/config";
import {
  defaultTheme,
  isAppTheme,
  THEME_COOKIE,
} from "@/lib/theme";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isAuthPage(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/admin-login")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const access = request.cookies.get(COOKIE_ACCESS)?.value;
  const userRaw = request.cookies.get(COOKIE_USER)?.value;

  const isPublicApi = pathname.startsWith("/api/auth/");
  const isLocaleApi = pathname === "/api/locale";
  const isThemeApi = pathname === "/api/theme";

  // Ensure locale / theme cookies exist for RSC + FOUC prevention
  const existingLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(existingLocale) ? existingLocale : defaultLocale;
  const needsLocaleCookie = !isAppLocale(existingLocale);

  const existingTheme = request.cookies.get(THEME_COOKIE)?.value;
  const theme = isAppTheme(existingTheme) ? existingTheme : defaultTheme;
  const needsThemeCookie = !isAppTheme(existingTheme);

  const withPreferenceCookies = (res: NextResponse) => {
    if (needsLocaleCookie) {
      res.cookies.set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    if (needsThemeCookie) {
      res.cookies.set(THEME_COOKIE, theme, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return res;
  };

  if (isLocaleApi || isThemeApi) {
    return withPreferenceCookies(NextResponse.next());
  }

  if (isPublicApi && pathname !== "/api/auth/me") {
    return withPreferenceCookies(NextResponse.next());
  }

  if (!access || !userRaw) {
    if (isAuthPage(pathname) || pathname === "/") {
      if (pathname === "/") {
        return withPreferenceCookies(
          NextResponse.redirect(new URL("/login", request.url)),
        );
      }
      return withPreferenceCookies(NextResponse.next());
    }
    if (pathname.startsWith("/api/")) {
      return withPreferenceCookies(
        NextResponse.json({ message: "غير مصرح" }, { status: 401 }),
      );
    }
    if (pathname.startsWith("/platform") || pathname.startsWith("/admin")) {
      const login = new URL("/admin/login", request.url);
      login.searchParams.set("next", pathname);
      return withPreferenceCookies(NextResponse.redirect(login));
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return withPreferenceCookies(NextResponse.redirect(login));
  }

  let user: AuthUser | null = null;
  try {
    user = JSON.parse(userRaw) as AuthUser;
  } catch {
    user = null;
  }

  if (!user) {
    const login = new URL("/login", request.url);
    return withPreferenceCookies(NextResponse.redirect(login));
  }

  if (pathname === "/login" || pathname === "/admin/login" || pathname === "/") {
    return withPreferenceCookies(
      NextResponse.redirect(new URL(homePathFor(user), request.url)),
    );
  }

  if (pathname.startsWith("/platform") && !user.isPlatformAdmin) {
    return withPreferenceCookies(
      NextResponse.redirect(
        new URL(user.companyId ? `/c/${user.companyId}` : "/login", request.url),
      ),
    );
  }

  if (pathname.startsWith("/c/")) {
    const parts = pathname.split("/");
    const companyId = parts[2];
    if (!companyId) {
      return withPreferenceCookies(
        NextResponse.redirect(new URL(homePathFor(user), request.url)),
      );
    }
    if (
      !user.isPlatformAdmin &&
      user.companyId &&
      user.companyId !== companyId
    ) {
      return withPreferenceCookies(
        NextResponse.redirect(new URL(`/c/${user.companyId}`, request.url)),
      );
    }
    if (!user.isPlatformAdmin && !user.companyId) {
      return withPreferenceCookies(
        NextResponse.redirect(new URL("/login", request.url)),
      );
    }
  }

  return withPreferenceCookies(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin/login",
    "/platform/:path*",
    "/c/:path*",
    "/api/auth/me",
    "/api/locale",
    "/api/theme",
  ],
};
