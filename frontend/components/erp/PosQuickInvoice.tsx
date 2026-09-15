"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import {
  posTerminalQuickCheckout,
  type PosBootstrap,
} from "@/app/c/[companyId]/me/pos/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/lib/toast";

type QuickLine = {
  key: string;
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: number;
};

function money(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function newLine(): QuickLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemId: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRate: 15,
  };
}

export function PosQuickInvoice({
  companyId,
  boot,
  onDone,
}: {
  companyId: string;
  boot: PosBootstrap;
  onDone?: () => void;
}) {
  const t = useTranslations("pos");
  const [pending, startTransition] = useTransition();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payMode, setPayMode] = useState<"CASH" | "CARD">("CASH");
  const [lines, setLines] = useState<QuickLine[]>([newLine()]);
  const defaultTax = boot.companyDefaults.taxRate || 15;

  const products = boot.products ?? [];

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const line of lines) {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const net = qty * price;
      subtotal += net;
      tax += (net * (line.taxRate || defaultTax)) / 100;
    }
    return {
      subtotal,
      tax,
      total: Math.max(0, subtotal + tax),
    };
  }, [lines, defaultTax]);

  function updateLine(key: string, patch: Partial<QuickLine>) {
    setLines((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function onPickProduct(key: string, itemId: string) {
    if (!itemId) {
      updateLine(key, {
        itemId: "",
        description: "",
        unitPrice: "",
        taxRate: defaultTax,
      });
      return;
    }
    const product = products.find((p) => p.id === itemId);
    if (!product) return;
    updateLine(key, {
      itemId: product.id,
      description: product.name,
      unitPrice: String(Number(product.price) || 0),
      taxRate: product.taxRate || defaultTax,
    });
  }

  function submit() {
    const prepared = lines
      .map((line) => {
        const description = line.description.trim();
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (!description || !(quantity > 0) || !(unitPrice >= 0)) return null;
        const net = quantity * unitPrice;
        const taxAmount = (net * (line.taxRate || defaultTax)) / 100;
        return {
          itemId: line.itemId || undefined,
          description,
          quantity,
          unitPrice,
          taxAmount,
        };
      })
      .filter(Boolean) as Array<{
      itemId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxAmount: number;
    }>;

    if (!prepared.length) {
      toast.error(t("quickLineRequired"));
      return;
    }

    startTransition(async () => {
      const name = customerName.trim();
      const res = await posTerminalQuickCheckout(companyId, {
        pointOfSaleId: boot.assignment?.pointOfSale.id,
        customerName: name.length >= 2 ? name : undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod: payMode,
        lines: prepared,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        t("checkoutOk", { number: res.data?.invoiceNumber ?? "" }),
      );
      setLines([newLine()]);
      setCustomerName("");
      setCustomerPhone("");
      onDone?.();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold">{t("quickCustomerOptional")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t("customerName")}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <Input
            label={t("customerPhone")}
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">{t("quickLines")}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLines((rows) => [...rows, newLine()])}
          >
            <Plus className="me-1 h-4 w-4" />
            {t("quickAddLine")}
          </Button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("quickLinesHint")}
        </p>

        <div className="space-y-3">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[1.2fr_1fr_5rem_7rem_auto]"
            >
              <Select
                label={t("quickPickProduct")}
                value={line.itemId}
                onChange={(e) => onPickProduct(line.key, e.target.value)}
                placeholder={t("quickServiceOnly")}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.price != null ? ` — ${money(Number(p.price))}` : ""}`,
                }))}
              />
              <Input
                label={t("quickDescription")}
                value={line.description}
                onChange={(e) =>
                  updateLine(line.key, { description: e.target.value })
                }
                placeholder={t("quickDescriptionPh")}
              />
              <Input
                label={t("quickQty")}
                type="number"
                min={0.001}
                step="0.001"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(line.key, { quantity: e.target.value })
                }
              />
              <Input
                label={t("quickUnitPrice")}
                type="number"
                min={0}
                step="0.01"
                value={line.unitPrice}
                onChange={(e) =>
                  updateLine(line.key, { unitPrice: e.target.value })
                }
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={lines.length <= 1}
                  onClick={() =>
                    setLines((rows) => rows.filter((r) => r.key !== line.key))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={payMode === "CASH" ? "primary" : "secondary"}
            onClick={() => setPayMode("CASH")}
          >
            {t("payCash")}
          </Button>
          <Button
            type="button"
            variant={payMode === "CARD" ? "primary" : "secondary"}
            onClick={() => setPayMode("CARD")}
          >
            {t("payCard")}
          </Button>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">{t("subtotal")}</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">{t("tax")}</span>
            <span>{money(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>{t("total")}</span>
            <span>
              {money(totals.total)} {boot.companyDefaults.currency}
            </span>
          </div>
        </div>
        <Button
          type="button"
          className="h-12 w-full text-base"
          disabled={pending}
          onClick={submit}
        >
          {t("quickCharge")}
        </Button>
      </Card>
    </div>
  );
}
