import { Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { ensureI18nDir } from './ensure-i18n.util';

const i18nPath = ensureI18nDir();

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: i18nPath,
        // Watch scandir on a missing folder loops ENOENT under PM2.
        watch: false,
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
