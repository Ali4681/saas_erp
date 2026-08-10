import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "./config";

const messageCache = new Map<AppLocale, Promise<Record<string, unknown>>>();

async function loadMessagesUncached(locale: AppLocale) {
  const base = (await import(`../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;

  const moduleFiles = [
    "home",
    "settings",
    "users",
    "roles",
    "rolesPage",
    "notifications",
    "crm",
    "sales",
    "purchasing",
    "inventory",
    "finance",
    "hr",
    "work",
    "notebook",
    "marketing",
    "ai",
    "reports",
    "automation",
    "integrations",
    "channels",
    "attachments",
    "audit",
    "platform",
  ] as const;

  const merged: Record<string, unknown> = { ...base };
  await Promise.all(
    moduleFiles.map(async (name) => {
      try {
        const mod = (await import(`../messages/${locale}/${name}.json`))
          .default as unknown;
        // Prefer modular file; fall back to namespace already in base
        merged[name] = mod;
      } catch {
        // optional module file
      }
    }),
  );
  return merged;
}

function loadMessages(locale: AppLocale) {
  let hit = messageCache.get(locale);
  if (!hit) {
    hit = loadMessagesUncached(locale);
    messageCache.set(locale, hit);
  }
  return hit;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = isAppLocale(raw) ? raw : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
