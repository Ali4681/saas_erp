import { cpSync, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';

const logger = new Logger('AppI18nModule');

/**
 * Ensure dist/i18n exists even when deploy skipped nest assets / postbuild.
 * Safe to run at module load (sync, once per process).
 */
function ensureI18nOnDisk(): string {
  const cwd = process.cwd();
  const distI18n = path.join(cwd, 'dist', 'i18n');
  const srcI18n = path.join(cwd, 'src', 'i18n');
  // When main.js is at dist/main.js, __dirname for this file is dist/common/i18n
  const siblingI18n = path.join(__dirname, '..', '..', 'i18n');
  const packageRootI18n = path.join(__dirname, '..', '..', '..', 'src', 'i18n');

  const sources = [srcI18n, packageRootI18n].filter((p) => existsSync(p));
  const already = [distI18n, siblingI18n].filter((p) => existsSync(p));

  if (already.length > 0) {
    const chosen = already[0]!;
    logger.log(`Using i18n path: ${chosen}`);
    return chosen;
  }

  if (sources.length > 0) {
    try {
      mkdirSync(path.dirname(distI18n), { recursive: true });
      cpSync(sources[0]!, distI18n, { recursive: true });
      logger.warn(`Copied i18n JSON → ${distI18n} (was missing from build)`);
      return distI18n;
    } catch (err) {
      logger.error(`Failed to copy i18n to dist: ${String(err)}`);
      logger.log(`Falling back to source i18n: ${sources[0]}`);
      return sources[0]!;
    }
  }

  const tried = [distI18n, siblingI18n, srcI18n, packageRootI18n];
  throw new Error(
    `i18n JSON not found. Tried:\n${tried.map((c) => `  - ${c}`).join('\n')}\n` +
      `On the server run from backend/: npm run build   (or: node scripts/copy-i18n.js)`,
  );
}

const i18nPath = ensureI18nOnDisk();
const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: i18nPath,
        watch: !isProd && existsSync(i18nPath),
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        new HeaderResolver(['x-locale']),
        AcceptLanguageResolver,
      ],
    }),
  ],
})
export class AppI18nModule {}
