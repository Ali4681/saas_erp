"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type ItemOption = { id: string; name: string };

export function GenerateBarcodeForm({
  action,
  items,
  labels,
  onSuccess,
}: {
  action: (formData: FormData) => void | Promise<void>;
  items: ItemOption[];
  onSuccess?: () => void;
  labels: {
    item: string;
    barcodeType: string;
    barcodeRetail: string;
    barcodeLogistic: string;
    barcodeSupplier: string;
    barcodeSerial: string;
    serialHint: string;
    serialModeLabel: string;
    serialModeUnique: string;
    serialModeShared: string;
    create: string;
    generating: string;
    uniqueHint: string;
  };
}) {
  const [type, setType] = useState("RETAIL");
  const [serialMode, setSerialMode] = useState<"unique" | "shared">("unique");
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const serial = type === "SERIAL";

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || locked.current) return;
        const form = e.currentTarget;
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        locked.current = true;
        const formData = new FormData(form);
        startTransition(() => {
          void Promise.resolve(action(formData))
            .then(() => onSuccess?.())
            .catch(() => onSuccess?.())
            .finally(() => {
              locked.current = false;
            });
        });
      }}
    >
      <Select
        name="itemId"
        label={labels.item}
        required
        options={items.map((item) => ({ value: item.id, label: item.name }))}
      />
      <Select
        name="barcodeType"
        label={labels.barcodeType}
        value={type}
        onChange={(e) => setType(e.target.value)}
        showPlaceholderOption={false}
        options={[
          { value: "RETAIL", label: labels.barcodeRetail },
          { value: "LOGISTIC", label: labels.barcodeLogistic },
          { value: "SUPPLIER", label: labels.barcodeSupplier },
          { value: "SERIAL", label: labels.barcodeSerial },
        ]}
      />
      {serial ? (
        <>
          <input type="hidden" name="serialBased" value="on" />
          <fieldset className="space-y-2 rounded-lg border border-[var(--border)] p-3">
            <legend className="text-sm font-medium">{labels.serialModeLabel}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="serialMode"
                value="unique"
                checked={serialMode === "unique"}
                onChange={() => setSerialMode("unique")}
                className="mt-1"
              />
              <span>{labels.serialModeUnique}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="serialMode"
                value="shared"
                checked={serialMode === "shared"}
                onChange={() => setSerialMode("shared")}
                className="mt-1"
              />
              <span>{labels.serialModeShared}</span>
            </label>
          </fieldset>
          <Input
            name="quantity"
            label={labels.barcodeSerial}
            type="number"
            min={1}
            max={50}
            defaultValue="1"
            required
          />
          <p className="text-xs text-[var(--muted-foreground)]">{labels.serialHint}</p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">{labels.uniqueHint}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? labels.generating : labels.create}
      </Button>
    </form>
  );
}
