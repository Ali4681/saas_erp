"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText, Quote } from "lucide-react";
import {
  posTerminalConvertQuote,
  posTerminalListDocuments,
  type PosDocumentRow,
} from "@/app/c/[companyId]/me/pos/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { buildWhatsAppUrl } from "@/lib/phone";
import { resolvePosRoleOps } from "@/lib/pos-permissions";
import { toast } from "@/lib/toast";
import type { PosBootstrap } from "@/app/c/[companyId]/me/pos/actions";

function money(n: number, locale: string) {
  return n.toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWhen(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function DocTable({
  rows,
  kind,
  currencyFallback,
  roleOps,
  companyId,
  pending,
  onRefresh,
  onEditQuote,
}: {
  rows: PosDocumentRow[];
  kind: "quote" | "invoice";
  currencyFallback: string;
  roleOps: ReturnType<typeof resolvePosRoleOps>;
  companyId: string;
  pending: boolean;
  onRefresh: () => void;
  onEditQuote?: (id: string) => void;
}) {
  const t = useTranslations("pos");
  const locale = useLocale();

  if (!rows.length) {
    return (
      <EmptyState
        message={kind === "quote" ? t("docsQuotesEmpty") : t("docsInvoicesEmpty")}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
            <th className="px-2 py-2 font-medium">{t("docsNumber")}</th>
            <th className="px-2 py-2 font-medium">{t("docsCustomer")}</th>
            <th className="px-2 py-2 font-medium">{t("docsDate")}</th>
            <th className="px-2 py-2 font-medium">{t("docsTotal")}</th>
            <th className="px-2 py-2 font-medium">{t("docsStatus")}</th>
            <th className="px-2 py-2 font-medium">{t("docsActions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const currency = row.currency || currencyFallback;
            const status = String(row.status || "").toUpperCase();
            const quoteFinalized = ["CANCELLED", "CLOSED", "REJECTED"].includes(
              status,
            );
            const canEditQuote =
              kind === "quote" &&
              Boolean(roleOps.quoteCreate && onEditQuote) &&
              !quoteFinalized;
            const canConvertQuote =
              kind === "quote" && Boolean(roleOps.quoteConvert) && !quoteFinalized;
            return (
              <tr
                key={row.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-2 py-2 font-mono text-xs">{row.number}</td>
                <td className="px-2 py-2">{row.contact?.name ?? "—"}</td>
                <td className="px-2 py-2">
                  {formatWhen(row.createdAt || row.issuedOn, locale)}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  {money(Number(row.totalAmount), locale)} {currency}
                </td>
                <td className="px-2 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {canEditQuote ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => onEditQuote!(row.id)}
                      >
                        {t("editQuote")}
                      </Button>
                    ) : null}
                    {kind === "quote" &&
                    roleOps.quoteSendWhatsapp &&
                    row.contact?.phone ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const url = buildWhatsAppUrl(
                            row.contact.phone!,
                            t("whatsappQuoteText", {
                              number: row.number,
                              total: money(Number(row.totalAmount), locale),
                              currency,
                            }),
                          );
                          if (url)
                            window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        {t("sendWhatsapp")}
                      </Button>
                    ) : null}
                    {canConvertQuote ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          void (async () => {
                            const res = await posTerminalConvertQuote(
                              companyId,
                              row.id,
                            );
                            if (res.error) {
                              toast.error(res.error);
                              return;
                            }
                            toast.success(t("quoteConvertedOk"));
                            onRefresh();
                          })();
                        }}
                      >
                        {t("convertQuote")}
                      </Button>
                    ) : null}
                    {kind === "invoice" &&
                    roleOps.invoiceSendWhatsapp &&
                    row.contact?.phone ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const url = buildWhatsAppUrl(
                            row.contact.phone!,
                            t("whatsappInvoiceText", {
                              number: row.number,
                              total: money(Number(row.totalAmount), locale),
                              currency,
                            }),
                          );
                          if (url)
                            window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        {t("sendWhatsapp")}
                      </Button>
                    ) : null}
                    {row.cashierName ? (
                      <span className="self-center text-xs text-[var(--muted-foreground)]">
                        {row.cashierName}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PosCashierDocuments({
  companyId,
  roleOps,
  currency = "SAR",
  onEditQuote,
}: {
  companyId: string;
  roleOps?: PosBootstrap["roleOps"];
  currency?: string;
  onEditQuote?: (quoteId: string) => void;
}) {
  const t = useTranslations("pos");
  const [pending, startTransition] = useTransition();
  const [quotes, setQuotes] = useState<PosDocumentRow[]>([]);
  const [invoices, setInvoices] = useState<PosDocumentRow[]>([]);
  const ops = resolvePosRoleOps(null, roleOps ?? null);

  function reload() {
    startTransition(async () => {
      const res = await posTerminalListDocuments(companyId);
      if (res.error || !res.data) {
        toast.error(res.error || t("docsLoadFailed"));
        setQuotes([]);
        setInvoices([]);
        return;
      }
      setQuotes(res.data.quotes);
      setInvoices(res.data.invoices);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="text-sm font-semibold">{t("docsQuotesTitle")}</h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            ({quotes.length})
          </span>
          <Button
            type="button"
            variant="secondary"
            className="ms-auto"
            disabled={pending}
            onClick={() => reload()}
          >
            {t("docsRefresh")}
          </Button>
        </div>
        {pending && quotes.length === 0 && invoices.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">{t("loading")}</p>
        ) : (
          <DocTable
            rows={quotes}
            kind="quote"
            currencyFallback={currency}
            roleOps={ops}
            companyId={companyId}
            pending={pending}
            onRefresh={reload}
            onEditQuote={onEditQuote}
          />
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="text-sm font-semibold">{t("docsInvoicesTitle")}</h2>
          <span className="text-xs text-[var(--muted-foreground)]">
            ({invoices.length})
          </span>
        </div>
        <DocTable
          rows={invoices}
          kind="invoice"
          currencyFallback={currency}
          roleOps={ops}
          companyId={companyId}
          pending={pending}
          onRefresh={reload}
        />
      </Card>
    </div>
  );
}
