import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';

const logger = new Logger('AppI18nModule');

/** Resolve i18n JSON dir for both `nest start` (dist) and missing asset copies. */
function resolveI18nPath(): string {
  const candidates = [
    // Preferred: always copy to dist/i18n via nest assets + scripts/copy-i18n.js
    path.join(process.cwd(), 'dist', 'i18n'),
    // Compiled module lives at dist/common/i18n → sibling dist/i18n
    path.join(__dirname, '..', '..', 'i18n'),
    // Legacy nested emit: dist/src/common/i18n → dist/src/i18n
    path.join(__dirname, '..', '..', '..', 'i18n'),
    path.join(process.cwd(), 'dist', 'src', 'i18n'),
    // Dev / source checkout still on disk next to dist
    path.join(process.cwd(), 'src', 'i18n'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      logger.log(`Using i18n path: ${candidate}`);
      return candidate;
    }
  }
  logger.error(
    `i18n JSON not found. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}\n` +
      `Run: npm run build (copies src/i18n → dist/i18n)`,
  );
  // Last resort — nestjs-i18n will throw with this path
  return candidates[0]!;
}

const i18nPath = resolveI18nPath();
const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: i18nPath,
        // Watching a missing dir throws ENOENT scandir loops under PM2.
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
