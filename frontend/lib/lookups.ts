import { apiServer } from "@/lib/api/server";
import {
  lookupLabel,
  lookupSelectOptions,
  type LookupOption,
} from "@/lib/lookups-shared";
import { getAppLocale } from "@/lib/i18n/locale-server";
import type { AppLocale } from "@/i18n/config";

export type { LookupOption };
export { lookupLabel, lookupSelectOptions };

export type LocalesLookup = {
  defaults: {
    countryCode: string;
    currency: string;
    timezone: string;
    city?: string;
    language?: string;
  };
  countries: LookupOption[];
  currencies: LookupOption[];
  languages: LookupOption[];
  timezones: LookupOption[];
  citiesByCountry: Record<string, LookupOption[]>;
  cityDefaults: Record<string, string>;
};

const FALLBACK: LocalesLookup = {
  defaults: {
    countryCode: "SA",
    currency: "SAR",
    timezone: "Asia/Riyadh",
    city: "Riyadh",
    language: "ar",
  },
  countries: [
    { value: "SA", label: "Saudi Arabia", labelAr: "السعودية" },
  ],
  currencies: [
    { value: "SAR", label: "Saudi Riyal", labelAr: "ريال سعودي" },
  ],
  languages: [
    { value: "ar", label: "Arabic", labelAr: "العربية" },
    { value: "en", label: "English", labelAr: "الإنجليزية" },
  ],
  timezones: [
    {
      value: "Asia/Riyadh",
      label: "Asia/Riyadh",
      labelAr: "الرياض (UTC+3)",
    },
  ],
  citiesByCountry: {
    SA: [{ value: "Riyadh", label: "Riyadh", labelAr: "الرياض" }],
  },
  cityDefaults: {
    SA: "Riyadh",
  },
};

export async function fetchLocalesLookup(
  companyId?: string | null,
): Promise<LocalesLookup> {
  const data = await apiServer<LocalesLookup>("/lookups/locales", {
    companyId: companyId ?? null,
  }).catch(() => null);
  if (!data) return FALLBACK;
  return {
    defaults: {
      ...FALLBACK.defaults,
      ...data.defaults,
    },
    countries: data.countries?.length ? data.countries : FALLBACK.countries,
    currencies: data.currencies?.length ? data.currencies : FALLBACK.currencies,
    languages: data.languages?.length ? data.languages : FALLBACK.languages,
    timezones: data.timezones?.length ? data.timezones : FALLBACK.timezones,
    citiesByCountry: data.citiesByCountry ?? FALLBACK.citiesByCountry,
    cityDefaults: data.cityDefaults ?? FALLBACK.cityDefaults,
  };
}

/** Server helper: lookup options for the active locale cookie. */
export async function localizedLookupSelectOptions(items: LookupOption[]) {
  const locale = await getAppLocale();
  return lookupSelectOptions(items, locale);
}

export async function localizedLookupLabel(
  items: LookupOption[],
  value: string | null | undefined,
) {
  const locale = await getAppLocale();
  return lookupLabel(items, value, locale);
}

export type { AppLocale };
