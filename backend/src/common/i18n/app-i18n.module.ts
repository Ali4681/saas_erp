import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';

/** Resolve i18n JSON dir for both `nest start` (dist) and missing asset copies. */
function resolveI18nPath(): string {
  const candidates = [
    // Compiled: dist/common/i18n -> dist/i18n (assets copied next to JS)
    path.join(__dirname, '..', '..', 'i18n'),
    // Legacy nested emit: dist/src/common/i18n -> dist/src/i18n
    path.join(__dirname, '..', '..', '..', 'i18n'),
    // Source checkout (dev / when nest did not copy assets)
    path.join(process.cwd(), 'src', 'i18n'),
    path.join(process.cwd(), 'dist', 'i18n'),
    path.join(process.cwd(), 'dist', 'src', 'i18n'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Last resort — nestjs-i18n error will name this path
  return candidates[0]!;
}

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: resolveI18nPath(),
        watch: process.env.NODE_ENV !== 'production',
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
