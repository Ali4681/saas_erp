"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SalesTaxFields } from "@/components/erp/SalesTaxFields";
import { Select } from "@/components/ui/Select";

type ItemOption = {
  id: string;
  name: string;
  sku?: string | null;
  salePrice?: string | number | null;
};

/** Product line on quote/invoice — description comes from selected item. */
export function SalesLineItemFields({
  items,
  defaultTaxRate,
  defaultMode = "COMPANY",
  defaultItemId,
  defaultQuantity = "1",
  defaultUnitPrice = "",
}: {
  items: ItemOption[];
  defaultTaxRate: number;
  defaultMode?: "COMPANY" | "NONE";
  defaultItemId?: string;
  defaultQuantity?: string;
  defaultUnitPrice?: string;
}) {
  const t = useTranslations("sales");
  const [itemId, setItemId] = useState(defaultItemId ?? "");
  const selected = useMemo(
    () => items.find((row) => row.id === itemId),
    [items, itemId],
  );
  const unitPrice =
    defaultUnitPrice ||
    (selected?.salePrice != null ? String(selected.salePrice) : "");

  return (
    <>
      <Select
        name="itemId"
        label={t("soldProduct")}
        required
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        placeholder={t("selectProduct")}
        options={items.map((row) => ({
          value: row.id,
          label: row.sku ? `${row.name} (${row.sku})` : row.name,
        }))}
      />
      <input type="hidden" name="description" value={selected?.name ?? ""} />
      <SalesTaxFields
        key={itemId || "no-item"}
        defaultTaxRate={defaultTaxRate}
        defaultMode={defaultMode}
        initialQuantity={defaultQuantity}
        initialUnitPrice={unitPrice}
      />
    </>
  );
}
