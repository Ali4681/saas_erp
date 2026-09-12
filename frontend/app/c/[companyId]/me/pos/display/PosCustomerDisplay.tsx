"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type CartLine = {
  key: string;
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string;
};

type CartBroadcast = {
  companyId: string;
  currency: string;
  lastItem: CartLine | null;
  lines: CartLine[];
  totals: { subtotal: number; tax: number; discount: number; total: number };
};

function money(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PosCustomerDisplay({ companyId }: { companyId: string }) {
  const t = useTranslations("pos");
  const [payload, setPayload] = useState<CartBroadcast | null>(null);

  useEffect(() => {
    if (!companyId || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`pos-cart-${companyId}`);
    channel.onmessage = (event: MessageEvent<CartBroadcast>) => {
      if (!event.data || event.data.companyId !== companyId) return;
      setPayload(event.data);
    };
    return () => channel.close();
  }, [companyId]);

  const lines = payload?.lines ?? [];
  const last = payload?.lastItem;
  const totals = payload?.totals ?? {
    subtotal: 0,
    tax: 0,
    discount: 0,
    total: 0,
  };
  const currency = payload?.currency ?? "SAR";

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col bg-[radial-gradient(circle_at_top,_#0f766e22,_transparent_55%),var(--background)] px-4 py-6 sm:px-8">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {t("customerDisplayTitle")}
      </p>

      <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)]/90 p-6 shadow-sm backdrop-blur">
        <p className="text-sm text-[var(--muted-foreground)]">{t("lastItem")}</p>
        {last ? (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              {last.name}
            </h1>
            <p className="text-2xl font-semibold tabular-nums sm:text-4xl">
              {money(last.unitPrice * last.quantity)} {currency}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-2xl text-[var(--muted-foreground)]">
            {t("displayWaiting")}
          </p>
        )}
      </div>

      <div className="mt-6 flex-1 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-6 py-4 text-lg font-medium">
          {t("displayLines")}
        </div>
        <ul className="max-h-[45vh] space-y-0 overflow-y-auto divide-y divide-[var(--border)]">
          {lines.length === 0 ? (
            <li className="px-6 py-10 text-center text-[var(--muted-foreground)]">
              {t("cartEmpty")}
            </li>
          ) : (
            lines.map((line) => (
              <li
                key={line.key}
                className="flex items-center justify-between gap-4 px-6 py-4 text-lg sm:text-xl"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.name}</p>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {money(line.unitPrice)} × {line.quantity}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums font-semibold">
                  {money(line.unitPrice * line.quantity)}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] px-6 py-5">
        <div className="flex items-end justify-between gap-4">
          <span className="text-xl text-[var(--muted-foreground)]">
            {t("total")}
          </span>
          <span className="text-4xl font-bold tabular-nums sm:text-6xl">
            {money(totals.total)}{" "}
            <span className="text-2xl font-semibold sm:text-3xl">
              {currency}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
