import {
  defaultLocale,
  isAppLocale,
  localeDirection,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";

/** Client-side locale from document cookie. */
export function readLocaleFromDocument(): AppLocale {
  if (typeof document === "undefined") return defaultLocale;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
  );
  const raw = match ? decodeURIComponent(match[1]) : null;
  return isAppLocale(raw) ? raw : defaultLocale;
}

/** Write locale cookie so RSC can read it without waiting on the network. */
export function writeLocaleCookie(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/** Apply lang/dir on `<html>` immediately. */
export function applyLocaleDocument(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
}
