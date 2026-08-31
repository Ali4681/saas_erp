"use client";

import { useTranslations } from "next-intl";

const METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "PAYMENT_GATEWAY",
  "CREDIT",
  "MIXED",
  "OTHER",
] as const;

type Method = (typeof METHODS)[number];

export function PaymentMethodGrid({
  name = "paymentMethod",
  value,
  onChange,
  defaultValue = "CASH",
}: {
  name?: string;
  value?: string;
  onChange?: (method: string) => void;
  defaultValue?: Method | string;
}) {
  const t = useTranslations("sales.invoices");
  const selected = value ?? defaultValue;

  const labels: Record<Method, string> = {
    CASH: t("cash"),
    BANK_TRANSFER: t("bankTransfer"),
    CARD: t("card"),
    PAYMENT_GATEWAY: t("paymentGateway"),
    CREDIT: t("credit"),
    MIXED: t("mixed"),
    OTHER: t("other"),
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-[var(--foreground)]">
        {t("paymentType")}
      </legend>
      <input type="hidden" name={name} value={selected} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {METHODS.map((method) => {
          const active = selected === method;
          return (
            <button
              key={method}
              type="button"
              onClick={() => onChange?.(method)}
              className={`rounded-xl border px-3 py-3 text-start text-sm transition ${
                active
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--color-accent)]/50"
              }`}
            >
              {labels[method]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
