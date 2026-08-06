import { cookies } from "next/headers";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";

/** Server-side locale from cookie (for API headers, RSC). */
export async function getAppLocale(): Promise<AppLocale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  return isAppLocale(raw) ? raw : defaultLocale;
}
