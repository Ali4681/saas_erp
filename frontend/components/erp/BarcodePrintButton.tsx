"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { printBarcodeLabels } from "@/lib/barcode-svg";

export function BarcodePrintButton({
  title,
  sku,
  barcode,
  label,
  copiesLabel,
}: {
  title: string;
  sku?: string | null;
  barcode: string;
  label: string;
  copiesLabel: string;
}) {
  const [copies, setCopies] = useState(1);

  return (
    <span className="inline-flex items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        {copiesLabel}
        <input
          type="number"
          min={1}
          max={50}
          value={copies}
          onChange={(e) => setCopies(Number(e.target.value) || 1)}
          className="h-8 w-14 rounded-md border border-[var(--input)] bg-[var(--card)] px-1 text-center"
        />
      </label>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          printBarcodeLabels({ title, sku, barcode, copies })
        }
      >
        {label}
      </Button>
    </span>
  );
}
