import { getLocale } from "next-intl/server";
import {
  formatDate as formatDateBase,
  formatMoney as formatMoneyBase,
  formatNumber as formatNumberBase,
  createFormatters,
  toNumber,
} from "@/lib/format";

export { toNumber, createFormatters };

/** RSC helpers — use cookie/next-intl locale automatically. */
export async function formatDate(
  value: string | Date | null | undefined,
): Promise<string> {
  return formatDateBase(value, await getLocale());
}

export async function formatMoney(
  value: string | number | null | undefined,
  currency = "SAR",
): Promise<string> {
  return formatMoneyBase(value, currency, await getLocale());
}

export async function formatNumber(
  value: string | number | null | undefined,
): Promise<string> {
  return formatNumberBase(value, await getLocale());
}

/** Prefer when a page calls formatters many times (one locale read). */
export async function getFormatters() {
  return createFormatters(await getLocale());
}
