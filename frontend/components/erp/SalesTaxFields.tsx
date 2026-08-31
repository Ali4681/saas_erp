"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

/** Tax mode: company default rate applied to (qty × price), or no tax. */
export function SalesTaxFields({
  defaultTaxRate,
  defaultMode = "COMPANY",
  quantityName = "quantity",
  unitPriceName = "unitPrice",
  taxAmountName = "taxAmount",
  initialQuantity = "1",
  initialUnitPrice = "",
}: {
  defaultTaxRate: number;
  defaultMode?: "COMPANY" | "NONE";
  quantityName?: string;
  unitPriceName?: string;
  taxAmountName?: string;
  initialQuantity?: string;
  initialUnitPrice?: string;
}) {
  const t = useTranslations("sales");
  const hasCompanyRate = Number.isFinite(defaultTaxRate) && defaultTaxRate > 0;
  const [mode, setMode] = useState<"COMPANY" | "NONE">(
    !hasCompanyRate && defaultMode === "COMPANY" ? "NONE" : defaultMode,
  );
  const [quantity, setQuantity] = useState(initialQuantity);
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice);

  const rate = hasCompanyRate ? defaultTaxRate : 0;
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const base = Math.max(0, qty * price);
  const computedTax =
    mode === "COMPANY" && rate > 0
      ? ((base * rate) / 100).toFixed(2)
      : "0";

  return (
    <>
      <Input
        name={quantityName}
        label={t("quantity")}
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <Input
        name={unitPriceName}
        label={t("unitPrice")}
        required
        value={unitPrice}
        onChange={(e) => setUnitPrice(e.target.value)}
      />
      <Select
        name="taxMode"
        label={t("taxMode")}
        value={mode}
        showPlaceholderOption={false}
        onChange={(e) => setMode(e.target.value as "COMPANY" | "NONE")}
        options={[
          {
            value: "COMPANY",
            label: hasCompanyRate
              ? t("taxWithCompanyRate", { rate: String(rate) })
              : t("taxCompanyMissing"),
          },
          { value: "NONE", label: t("taxNone") },
        ]}
      />
      <Input
        name={taxAmountName}
        label={t("taxAmount")}
        value={computedTax}
        readOnly
      />
      {!hasCompanyRate && mode === "COMPANY" ? (
        <p className="md:col-span-2 text-xs text-[var(--muted-foreground)]">
          {t("taxSetInSettings")}
        </p>
      ) : null}
    </>
  );
}
