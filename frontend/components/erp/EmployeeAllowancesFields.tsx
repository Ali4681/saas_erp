"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type AllowanceType = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
};

type Row = { key: string; typeId: string; amount: string };

export function EmployeeAllowancesFields({
  allowanceTypes,
  labels,
  locale = "ar",
  defaultAllowances,
}: {
  allowanceTypes: AllowanceType[];
  labels: {
    heading: string;
    hint: string;
    select: string;
    amount: string;
    add: string;
    remove: string;
    empty: string;
  };
  locale?: string;
  defaultAllowances?: Array<{ allowanceTypeId: string; amount: string }>;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (defaultAllowances && defaultAllowances.length > 0) {
      return defaultAllowances.map((a, i) => ({
        key: String(i + 1),
        typeId: a.allowanceTypeId,
        amount: a.amount,
      }));
    }
    return [{ key: "1", typeId: "", amount: "" }];
  });

  const options = useMemo(
    () =>
      allowanceTypes.map((a) => ({
        value: a.id,
        label: locale === "ar" ? a.nameAr : a.nameEn,
      })),
    [allowanceTypes, locale],
  );

  return (
    <div className="space-y-3 md:col-span-2">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">
          {labels.heading}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">{labels.hint}</p>
      </div>
      {allowanceTypes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)]">
          {labels.empty}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[1fr_140px_auto]"
            >
              <Select
                name={`allowanceTypeId_${index}`}
                label={labels.select}
                value={row.typeId}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, typeId: e.target.value }
                        : r,
                    ),
                  )
                }
                options={options}
              />
              <Input
                name={`allowanceAmount_${index}`}
                label={labels.amount}
                type="number"
                min={0}
                step="0.01"
                value={row.amount}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.key === row.key
                        ? { ...r, amount: e.target.value }
                        : r,
                    ),
                  )
                }
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setRows((prev) =>
                      prev.length <= 1
                        ? prev
                        : prev.filter((r) => r.key !== row.key),
                    )
                  }
                >
                  {labels.remove}
                </Button>
              </div>
            </div>
          ))}
          <input type="hidden" name="allowanceCount" value={String(rows.length)} />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                { key: `${Date.now()}`, typeId: "", amount: "" },
              ])
            }
          >
            {labels.add}
          </Button>
        </div>
      )}
    </div>
  );
}
