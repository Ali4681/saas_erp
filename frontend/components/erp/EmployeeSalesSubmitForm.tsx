"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

export function EmployeeSalesSubmitForm({
  action,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  labels: {
    saleDate: string;
    amount: string;
    paymentMethod: string;
    cash: string;
    network: string;
    transfer: string;
    cashHint: string;
    multiHint: string;
    salesCount: string;
    receiptN: string;
    receipt: string;
    notes: string;
    submit: string;
  };
}) {
  const [method, setMethod] = useState("CASH");
  const [count, setCount] = useState(1);
  const isCash = method === "CASH";
  const salesCount = isCash ? 1 : Math.min(20, Math.max(1, count));

  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <Input
        name="saleDate"
        label={labels.saleDate}
        type="date"
        required
        defaultValue={new Date().toISOString().slice(0, 10)}
      />
      <Select
        name="paymentMethod"
        label={labels.paymentMethod}
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        showPlaceholderOption={false}
        options={[
          { value: "CASH", label: labels.cash },
          { value: "NETWORK", label: labels.network },
          { value: "TRANSFER", label: labels.transfer },
        ]}
      />
      {isCash ? (
        <>
          <Input
            key="sale-amount-cash"
            name="amount"
            label={labels.amount}
            type="number"
            min={0}
            step="0.01"
            required
          />
          <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
            {labels.cashHint}
          </p>
        </>
      ) : (
        <>
          <Input
            key="sales-count"
            name="salesCount"
            label={labels.salesCount}
            type="number"
            min={1}
            max={20}
            value={String(count)}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            required
          />
          <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
            {labels.multiHint}
          </p>
          {Array.from({ length: salesCount }).map((_, i) => (
            <div
              key={`sale-row-${i}`}
              className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:col-span-2 md:grid-cols-2"
            >
              <Input
                name={`saleAmount_${i}`}
                label={`${labels.amount} #${i + 1}`}
                type="number"
                min={0}
                step="0.01"
                required
              />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">
                  {`${labels.receiptN}${i + 1}`}
                </span>
                <input
                  type="file"
                  name={`receipt_${i}`}
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf"
                  required
                  className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
                />
              </label>
            </div>
          ))}
        </>
      )}
      <div className="md:col-span-2">
        <Textarea name="notes" label={labels.notes} />
      </div>
      <div className="md:col-span-2">
        <Button type="submit">{labels.submit}</Button>
      </div>
    </form>
  );
}
