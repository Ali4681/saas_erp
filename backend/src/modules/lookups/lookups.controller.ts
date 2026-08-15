import { Controller, Get, Param, Query } from '@nestjs/common';
import { CITIES_BY_COUNTRY, LOOKUP_CITY_DEFAULTS } from './cities.data';
import {
  COUNTRIES,
  CURRENCIES,
  LANGUAGES,
  LOOKUP_DEFAULTS,
  TIMEZONES,
} from './lookups.data';

@Controller('lookups')
export class LookupsController {
  @Get('locales')
  locales() {
    return {
      defaults: LOOKUP_DEFAULTS,
      countries: COUNTRIES,
      currencies: CURRENCIES,
      languages: LANGUAGES,
      timezones: TIMEZONES,
      citiesByCountry: CITIES_BY_COUNTRY,
      cityDefaults: LOOKUP_CITY_DEFAULTS,
    };
  }

  @Get('cities')
  cities(@Query('country') country?: string) {
    const code = (country ?? LOOKUP_DEFAULTS.countryCode).toUpperCase();
    return {
      countryCode: code,
      defaultCity: LOOKUP_CITY_DEFAULTS[code] ?? null,
      cities: CITIES_BY_COUNTRY[code] ?? [],
    };
  }

  @Get('cities/:countryCode')
  citiesByCountry(@Param('countryCode') countryCode: string) {
    const code = countryCode.toUpperCase();
    return {
      countryCode: code,
      defaultCity: LOOKUP_CITY_DEFAULTS[code] ?? null,
      cities: CITIES_BY_COUNTRY[code] ?? [],
    };
  }
}
