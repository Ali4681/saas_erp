"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PaymentMethodGrid } from "@/components/erp/PaymentMethodGrid";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const SPLIT_METHODS = [
  "CASH",
  "CARD",
  "BANK_TRANSFER",
  "PAYMENT_GATEWAY",
  "OTHER",
] as const;

/** Controlled payment grid + optional two-way split tenders. */
export function InvoicePaymentMethodField({
  defaultValue = "CASH",
  estimatedTotal,
}: {
  defaultValue?: string;
  /** When set, second split amount auto-fills as total − first. */
  estimatedTotal?: number;
}) {
  const t = useTranslations("sales.invoices");
  const [method, setMethod] = useState(defaultValue);
  const [method1, setMethod1] = useState<string>("CASH");
  const [method2, setMethod2] = useState<string>("CARD");
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [liveTotal, setLiveTotal] = useState(estimatedTotal ?? 0);
  const rootRef = useRef<HTMLDivElement>(null);

  const methodOptions = useMemo(
    () =>
      SPLIT_METHODS.map((m) => ({
        value: m,
        label:
          m === "CASH"
            ? t("cash")
            : m === "CARD"
              ? t("card")
              : m === "BANK_TRANSFER"
                ? t("bankTransfer")
                : m === "PAYMENT_GATEWAY"
                  ? t("paymentGateway")
                  : t("other"),
      })),
    [t],
  );

  useEffect(() => {
    if (estimatedTotal != null && Number.isFinite(estimatedTotal)) {
      setLiveTotal(estimatedTotal);
    }
  }, [estimatedTotal]);

  useEffect(() => {
    if (method !== "MIXED") return;
    const form = rootRef.current?.closest("form");
    if (!form) return;

    const readTotal = () => {
      const qty = Number(
        (form.elements.namedItem("quantity") as HTMLInputElement | null)
          ?.value ?? 0,
      );
      const price = Number(
        (form.elements.namedItem("unitPrice") as HTMLInputElement | null)
          ?.value ?? 0,
      );
      const tax = Number(
        (form.elements.namedItem("taxAmount") as HTMLInputElement | null)
          ?.value ?? 0,
      );
      const base = Math.max(0, qty * price);
      setLiveTotal(Number((base + tax).toFixed(2)));
    };

    readTotal();
    form.addEventListener("input", readTotal);
    form.addEventListener("change", readTotal);
    return () => {
      form.removeEventListener("input", readTotal);
      form.removeEventListener("change", readTotal);
    };
  }, [method]);

  useEffect(() => {
    if (method !== "MIXED") return;
    const a1 = Number(amount1);
    if (!(liveTotal > 0) || !(a1 >= 0)) return;
    const remainder = Math.max(0, Number((liveTotal - a1).toFixed(2)));
    setAmount2(remainder > 0 ? remainder.toFixed(2) : "");
  }, [amount1, liveTotal, method]);

  return (
    <div ref={rootRef} className="space-y-3">
      <PaymentMethodGrid
        name="paymentMethod"
        value={method}
        onChange={setMethod}
        defaultValue={defaultValue}
      />
      {method === "MIXED" ? (
        <fieldset className="space-y-3 rounded-xl border border-[var(--color-border)] p-3">
          <legend className="px-1 text-sm font-medium">
            {t("splitTitle")}
          </legend>
          <p className="text-xs text-[var(--color-muted)]">{t("splitHint")}</p>
          {liveTotal > 0 ? (
            <p className="text-xs text-[var(--color-muted)]">
              {t("splitTotal", { total: liveTotal.toFixed(2) })}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              name="paymentSplit1Method"
              label={t("splitMethod1")}
              value={method1}
              onChange={(e) => setMethod1(e.target.value)}
              showPlaceholderOption={false}
              options={methodOptions}
            />
            <Input
              name="paymentSplit1Amount"
              label={t("splitAmount1")}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
            />
            <Select
              name="paymentSplit2Method"
              label={t("splitMethod2")}
              value={method2}
              onChange={(e) => setMethod2(e.target.value)}
              showPlaceholderOption={false}
              options={methodOptions}
            />
            <Input
              name="paymentSplit2Amount"
              label={t("splitAmount2")}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount2}
              onChange={(e) => setAmount2(e.target.value)}
            />
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
