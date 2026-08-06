"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";
import type { AppLocale } from "@/i18n/config";
import {
  lookupSelectOptions,
  type LookupOption,
} from "@/lib/lookups-shared";

type Props = {
  countries: LookupOption[];
  citiesByCountry: Record<string, LookupOption[]>;
  cityDefaults?: Record<string, string>;
  defaultCountryCode?: string;
  defaultCity?: string;
  countryRequired?: boolean;
  cityRequired?: boolean;
  countryName?: string;
  cityName?: string;
};

export function CountryCityFields({
  countries,
  citiesByCountry,
  cityDefaults = {},
  defaultCountryCode = "SA",
  defaultCity,
  countryRequired = true,
  cityRequired = true,
  countryName = "countryCode",
  cityName = "city",
}: Props) {
  const [countryCode, setCountryCode] = useState(defaultCountryCode);
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");

  const cityOptions = useMemo(() => {
    return lookupSelectOptions(citiesByCountry[countryCode] ?? [], locale);
  }, [citiesByCountry, countryCode, locale]);

  const countryOptions = useMemo(
    () => lookupSelectOptions(countries, locale),
    [countries, locale],
  );

  const selectedCity =
    defaultCity &&
    (citiesByCountry[countryCode] ?? []).some((c) => c.value === defaultCity)
      ? defaultCity
      : cityDefaults[countryCode] ?? cityOptions[0]?.value ?? "";

  return (
    <>
      <Select
        name={countryName}
        label={t("country")}
        required={countryRequired}
        value={countryCode}
        onChange={(e) => setCountryCode(e.target.value)}
        options={countryOptions}
      />
      <Select
        key={`${countryCode}-${selectedCity}`}
        name={cityName}
        label={t("city")}
        required={cityRequired}
        defaultValue={selectedCity}
        options={cityOptions}
        placeholder={t("select")}
      />
    </>
  );
}
