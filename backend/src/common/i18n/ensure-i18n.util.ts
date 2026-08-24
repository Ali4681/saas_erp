import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const FALLBACK: Record<string, Record<string, unknown>> = {
  'en/common.json': {
    hello: 'Hello',
    localeUpdated: 'Language updated',
    themeUpdated: 'Theme updated',
  },
  'en/errors.json': { internal: 'Internal server error' },
  'ar/common.json': {
    hello: 'مرحباً',
    localeUpdated: 'تم تحديث اللغة',
    themeUpdated: 'تم تحديث المظهر',
  },
  'ar/errors.json': { internal: 'خطأ داخلي في الخادم' },
};

/** Create dist/i18n before nestjs-i18n scandir. Safe to call many times. */
export function ensureI18nDir(): string {
  const dest = path.join(process.cwd(), 'dist', 'i18n');
  const src = path.join(process.cwd(), 'src', 'i18n');
  mkdirSync(dest, { recursive: true });
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
  } else {
    for (const [rel, data] of Object.entries(FALLBACK)) {
      const file = path.join(dest, rel);
      mkdirSync(path.dirname(file), { recursive: true });
      if (!existsSync(file)) {
        writeFileSync(file, JSON.stringify(data));
      }
    }
  }
  return dest;
}

ensureI18nDir();
