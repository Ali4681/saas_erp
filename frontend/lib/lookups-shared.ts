import type { AppLocale } from "@/i18n/config";

export type LookupOption = {
  value: string;
  label: string;
  labelAr: string;
};

function displayLabel(item: LookupOption, locale: AppLocale = "ar") {
  return locale === "en" ? item.label : item.labelAr;
}

export function lookupSelectOptions(
  items: LookupOption[],
  locale: AppLocale = "ar",
) {
  return items.map((item) => ({
    value: item.value,
    label: `${displayLabel(item, locale)} (${item.value})`,
  }));
}

export function lookupLabel(
  items: LookupOption[],
  value: string | null | undefined,
  locale: AppLocale = "ar",
): string {
  if (!value) return "—";
  const hit = items.find((i) => i.value === value);
  return hit ? `${displayLabel(hit, locale)} (${hit.value})` : value;
}
