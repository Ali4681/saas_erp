import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { Logger, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import arCommon from '../../i18n/ar/common.json';
import arErrors from '../../i18n/ar/errors.json';
import enCommon from '../../i18n/en/common.json';
import enErrors from '../../i18n/en/errors.json';

const logger = new Logger('AppI18nModule');

function writeJson(filePath: string, data: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data));
}

/**
 * Always materialize JSON on disk. Production deploys often ship `dist/`
 * without src/i18n; nestjs-i18n must scandir a real folder.
 */
function ensureI18nOnDisk(): string {
  const dest = path.join(process.cwd(), 'dist', 'i18n');
  writeJson(path.join(dest, 'en', 'common.json'), enCommon);
  writeJson(path.join(dest, 'en', 'errors.json'), enErrors);
  writeJson(path.join(dest, 'ar', 'common.json'), arCommon);
  writeJson(path.join(dest, 'ar', 'errors.json'), arErrors);
  logger.log(`Using i18n path: ${dest}`);
  return dest;
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
