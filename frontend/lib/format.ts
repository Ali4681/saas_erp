import { defaultLocale, type AppLocale } from "@/i18n/config";
import { readLocaleFromDocument } from "@/lib/i18n/locale";

export function resolveFormatLocale(locale?: string | null): AppLocale {
  if (locale === "en" || locale === "ar") return locale;
  if (typeof document !== "undefined") return readLocaleFromDocument();
  return defaultLocale;
}

/** BCP 47 tag for Intl formatters. */
export function intlLocaleTag(locale?: string | null): string {
  return resolveFormatLocale(locale) === "en" ? "en-US" : "ar-SA";
}

export function formatMoney(
  value: string | number | null | undefined,
  currency = "SAR",
  locale?: string | null,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(intlLocaleTag(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(
  value: string | Date | null | undefined,
  locale?: string | null,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocaleTag(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatNumber(
  value: string | number | null | undefined,
  locale?: string | null,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(intlLocaleTag(locale)).format(n);
}

export function toNumber(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Sync formatters bound to a locale (RSC / client). */
export function createFormatters(locale?: string | null) {
  const loc = resolveFormatLocale(locale);
  return {
    locale: loc,
    formatDate: (value: string | Date | null | undefined) =>
      formatDate(value, loc),
    formatMoney: (
      value: string | number | null | undefined,
      currency = "SAR",
    ) => formatMoney(value, currency, loc),
    formatNumber: (value: string | number | null | undefined) =>
      formatNumber(value, loc),
    toNumber,
  };
}
