import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "./config";

const messageCache = new Map<AppLocale, Promise<Record<string, unknown>>>();

const MODULE_FILES = [
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
  "tracking",
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

async function readJsonFile(relativePath: string): Promise<unknown | null> {
  try {
    const full = path.join(process.cwd(), "messages", relativePath);
    const raw = await readFile(full, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function loadMessagesUncached(locale: AppLocale) {
  // Read from disk — Turbopack dynamic `import(*.json)` often yields
  // modules without `.default`, wiping namespaces like `hr` / `nav` keys.
  const base = (await readJsonFile(`${locale}.json`)) as Record<
    string,
    unknown
  > | null;
  if (!base || typeof base !== "object") {
    throw new Error(`Missing or invalid messages/${locale}.json`);
  }

  const merged: Record<string, unknown> = { ...base };
  await Promise.all(
    MODULE_FILES.map(async (name) => {
      const mod = await readJsonFile(`${locale}/${name}.json`);
      if (mod && typeof mod === "object") {
        merged[name] = mod;
      }
    }),
  );
  return merged;
}

function loadMessages(locale: AppLocale) {
  // Dev: skip process cache so newly added keys apply without restart.
  if (process.env.NODE_ENV !== "production") {
    return loadMessagesUncached(locale);
  }
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
