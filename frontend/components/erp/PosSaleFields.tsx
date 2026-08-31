"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/Select";

type PosOption = {
  id: string;
  code: string;
  name: string;
  cashiers: Array<{
    id: string;
    displayName?: string | null;
    employee: { fullName: string };
  }>;
};

/** Optional POS + cashier on invoice create — leave empty for office/manual invoices. */
export function PosSaleFields({
  points,
  defaultPosId,
  defaultCashierId,
}: {
  points: PosOption[];
  defaultPosId?: string;
  defaultCashierId?: string;
}) {
  const t = useTranslations("sales");
  const [posId, setPosId] = useState(defaultPosId ?? "");
  const cashiers = useMemo(() => {
    const pos = points.find((p) => p.id === posId);
    return pos?.cashiers ?? [];
  }, [points, posId]);

  return (
    <fieldset className="space-y-2 rounded-xl border border-[var(--color-border)] p-3">
      <legend className="px-1 text-sm font-medium text-[var(--foreground)]">
        {t("pos.invoiceOptionalTitle")}
      </legend>
      <p className="text-xs text-[var(--color-muted)]">
        {t("pos.invoiceOptionalHint")}
      </p>
      {points.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{t("pos.selectHint")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            name="pointOfSaleId"
            label={t("pos.pointOfSale")}
            value={posId}
            onChange={(e) => setPosId(e.target.value)}
            placeholder={t("pos.none")}
            options={points.map((p) => ({
              value: p.id,
              label: `${p.code} — ${p.name}`,
            }))}
          />
          <Select
            name="posCashierId"
            label={t("pos.cashier")}
            key={posId || "no-pos"}
            defaultValue={defaultCashierId}
            placeholder={t("pos.noneCashier")}
            disabled={!posId}
            options={cashiers.map((c) => ({
              value: c.id,
              label: c.displayName || c.employee.fullName,
            }))}
          />
        </div>
      )}
    </fieldset>
  );
}
