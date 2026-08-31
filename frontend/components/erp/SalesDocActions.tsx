"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Eye, FileSpreadsheet, Share2, X } from "lucide-react";
import { ActionForm } from "@/components/erp/ActionForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { InvoicePaymentMethodField } from "@/components/erp/InvoicePaymentMethodField";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { lockPageScroll } from "@/lib/lock-page-scroll";
import { toExcelXml } from "@/lib/erp/reports";
import { SalesCustomerField } from "@/components/erp/SalesCustomerField";
import { SalesTaxFields } from "@/components/erp/SalesTaxFields";

const CURRENCIES = ["SAR", "USD", "EUR", "AED", "EGP", "BHD", "KWD", "OMR", "QAR"];

type LineItem = {
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  taxAmount?: string | number;
  totalAmount?: string | number;
};

type DocBase = {
  id: string;
  number: string;
  status: string;
  issuedOn: string;
  currency: string;
  subtotal?: string;
  taxAmount?: string;
  totalAmount: string;
  contact?: { id?: string; name?: string } | null;
  items?: LineItem[];
};

function downloadExcel(fileName: string, rows: Array<Record<string, unknown>>) {
  const xml = toExcelXml([{ name: "Document", rows }]);
  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xls") ? fileName : `${fileName}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

function isoDate(value: string) {
  return value.slice(0, 10);
}

export function SalesDocActions({
  kind,
  companyId,
  doc,
  contacts,
  defaultTaxRate,
  canWrite,
  pdfUrl,
  zatcaUrl,
  onUpdate,
  onDelete,
  onIssue,
  convertAction,
  convertLabel,
  convertConfirm,
  onApprove,
  onSend,
  onAccept,
}: {
  kind: "quote" | "invoice" | "creditNote";
  companyId: string;
  doc: DocBase & {
    expiresOn?: string | null;
    dueOn?: string | null;
    balanceDue?: string;
    saleChannel?: string | null;
    paymentMethod?: string | null;
    reason?: string | null;
    relatedInvoiceNumber?: string | null;
  };
  contacts: Array<{ id: string; name: string }>;
  defaultTaxRate: number;
  canWrite: boolean;
  pdfUrl: string;
  zatcaUrl?: string;
  onUpdate: (formData: FormData) => Promise<void>;
  onDelete: (formData?: FormData) => Promise<void>;
  onIssue?: (formData: FormData) => Promise<void>;
  convertAction?: (formData?: FormData) => Promise<void>;
  convertLabel?: string;
  convertConfirm?: string;
  onApprove?: (formData?: FormData) => Promise<void>;
  onSend?: (formData?: FormData) => Promise<void>;
  onAccept?: (formData?: FormData) => Promise<void>;
}) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const [viewOpen, setViewOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [pdfTheme, setPdfTheme] = useState("MODERN");
  const [pdfFormat, setPdfFormat] = useState("A4");
  const titleId = useId();
  const first = doc.items?.[0];
  const deletable =
    canWrite &&
    (kind === "quote"
      ? !["CANCELLED", "CLOSED", "REJECTED"].includes(doc.status)
      : doc.status !== "CANCELLED");
  const quoteOpen =
    kind === "quote" &&
    canWrite &&
    !["CANCELLED", "CLOSED", "REJECTED"].includes(doc.status);
  const canApprove =
    quoteOpen && ["DRAFT", "PENDING_APPROVAL"].includes(doc.status);
  const canSend =
    quoteOpen && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(doc.status);
  const canAccept =
    quoteOpen && ["APPROVED", "SENT"].includes(doc.status);
  const canConvert = ["APPROVED", "SENT", "ACCEPTED"].includes(doc.status);
  const canIssueHeld =
    kind === "invoice" &&
    canWrite &&
    Boolean(onIssue) &&
    ["ON_HOLD", "DRAFT"].includes(doc.status);
  const themedPdfUrl = `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}theme=${pdfTheme}${kind === "invoice" ? `&format=${pdfFormat}` : ""}`;

  useEffect(() => {
    if (!viewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewOpen(false);
    };
    const unlock = lockPageScroll();
    document.addEventListener("keydown", onKey);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKey);
    };
  }, [viewOpen]);

  async function share() {
    setShareMsg(null);
    const absolutePdf =
      typeof window !== "undefined"
        ? new URL(themedPdfUrl, window.location.origin).toString()
        : themedPdfUrl;
    const title =
      kind === "quote"
        ? `${t("quotes.title")} ${doc.number}`
        : kind === "creditNote"
          ? `${t("creditNotes.title")} ${doc.number}`
          : `${t("invoices.title")} ${doc.number}`;
    const text = [
      title,
      `${t("customer")}: ${doc.contact?.name ?? "—"}`,
      `${t("total")}: ${doc.totalAmount} ${doc.currency}`,
      absolutePdf,
    ].join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: absolutePdf });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareMsg(t("shareCopied"));
    } catch {
      setShareMsg(t("shareFailed"));
    }
  }

  function exportExcel() {
    const header = {
      number: doc.number,
      status: doc.status,
      customer: doc.contact?.name ?? "",
      issuedOn: isoDate(doc.issuedOn),
      currency: doc.currency,
      subtotal: doc.subtotal ?? "",
      tax: doc.taxAmount ?? "",
      total: doc.totalAmount,
      ...(kind === "invoice"
        ? {
            balanceDue: doc.balanceDue ?? "",
            channel: doc.saleChannel ?? "",
            paymentMethod: doc.paymentMethod ?? "",
          }
        : kind === "creditNote"
          ? {
              reason: doc.reason ?? "",
              invoice: doc.relatedInvoiceNumber ?? "",
            }
          : { expiresOn: doc.expiresOn ? isoDate(doc.expiresOn) : "" }),
    };
    const lines = (doc.items ?? []).map((item, i) => ({
      line: i + 1,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      tax: String(item.taxAmount ?? 0),
      lineTotal: String(item.totalAmount ?? ""),
    }));
    downloadExcel(doc.number, lines.length ? lines.map((l) => ({ ...header, ...l })) : [header]);
  }

  const editTitle =
    kind === "quote"
      ? t("quotes.editTitle")
      : kind === "creditNote"
        ? t("creditNotes.editTitle")
        : t("invoices.editTitle");

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        className="!px-2 !py-1 text-xs"
        onClick={() => setViewOpen(true)}
        title={t("view")}
      >
        <Eye className="h-3.5 w-3.5" />
        {t("view")}
      </Button>

      {canIssueHeld && onIssue ? (
        <CreateFormDialog
          title={t("invoices.issueHeldTitle")}
          triggerLabel={t("invoices.issueHeld")}
          triggerVariant="ghost"
          showPlus={false}
          className="max-w-lg"
        >
          <form action={onIssue} className="grid gap-3">
            <p className="text-sm text-[var(--color-muted)]">
              {t("invoices.issueHeldHint", { number: doc.number })}
            </p>
            <InvoicePaymentMethodField
              defaultValue={doc.paymentMethod === "MIXED" ? "MIXED" : doc.paymentMethod ?? "CASH"}
              estimatedTotal={Number(doc.totalAmount) || 0}
            />
            <Input
              name="dueOn"
              label={t("invoices.dueOn")}
              type="date"
              defaultValue={doc.dueOn ? isoDate(doc.dueOn) : undefined}
            />
            <Button type="submit">{t("invoices.issueHeldSubmit")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}

      {canWrite && deletable && kind !== "creditNote" ? (
        <CreateFormDialog
          title={editTitle}
          triggerLabel={t("edit")}
          triggerVariant="ghost"
          showPlus={false}
          className="max-w-2xl"
        >
          <form action={onUpdate} className="grid gap-3 md:grid-cols-2">
            <SalesCustomerField
              companyId={companyId}
              contacts={contacts}
              label={t("customer")}
              defaultValue={doc.contact?.id}
            />
            <Input
              name="issuedOn"
              label={t("issuedOn")}
              type="date"
              defaultValue={isoDate(doc.issuedOn)}
            />
            {kind === "quote" ? (
              <Input
                name="expiresOn"
                label={t("expiresOn")}
                type="date"
                defaultValue={doc.expiresOn ? isoDate(doc.expiresOn) : undefined}
              />
            ) : (
              <Input
                name="dueOn"
                label={t("invoices.dueOn")}
                type="date"
                defaultValue={doc.dueOn ? isoDate(doc.dueOn) : undefined}
              />
            )}
            <Select
              name="currency"
              label={t("currency")}
              defaultValue={doc.currency || "SAR"}
              showPlaceholderOption={false}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            {kind === "invoice" ? (
              <Select
                name="saleChannel"
                label={t("channel")}
                defaultValue={doc.saleChannel ?? "POS"}
                showPlaceholderOption={false}
                options={[
                  { value: "POS", label: t("channels.pos") },
                  { value: "ECOMMERCE", label: t("channels.ecommerce") },
                  { value: "DELIVERY", label: t("channels.delivery") },
                  { value: "BNPL", label: t("channels.bnpl") },
                ]}
              />
            ) : null}
            <Input
              name="description"
              label={t("lineDescription")}
              required
              className="md:col-span-2"
              defaultValue={first?.description}
            />
            <SalesTaxFields
              defaultTaxRate={defaultTaxRate}
              defaultMode={
                Number(first?.taxAmount ?? 0) > 0 ? "COMPANY" : "NONE"
              }
              initialQuantity={String(first?.quantity ?? "1")}
              initialUnitPrice={String(first?.unitPrice ?? "")}
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("saveChanges")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      {canWrite && deletable && kind === "creditNote" ? (
        <CreateFormDialog
          title={editTitle}
          triggerLabel={t("edit")}
          triggerVariant="ghost"
          showPlus={false}
          className="max-w-lg"
        >
          <form action={onUpdate} className="grid gap-3">
            <Input
              name="issuedOn"
              label={t("issuedOn")}
              type="date"
              defaultValue={isoDate(doc.issuedOn)}
            />
            <Input
              name="reason"
              label={t("creditNotes.reason")}
              defaultValue={doc.reason ?? ""}
            />
            <Input
              name="description"
              label={t("lineDescription")}
              required
              defaultValue={first?.description}
            />
            <Input
              name="quantity"
              label={t("quantity")}
              defaultValue={String(first?.quantity ?? "1")}
            />
            <Input
              name="amount"
              label={t("amount")}
              required
              defaultValue={String(first?.totalAmount ?? first?.unitPrice ?? "")}
            />
            <Button type="submit">{t("saveChanges")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}

      <Select
        aria-label={t("pdfTheme")}
        value={pdfTheme}
        onChange={(event) => setPdfTheme(event.target.value)}
        showPlaceholderOption={false}
        className="!w-auto !min-w-28 text-xs"
        options={[
          { value: "MODERN", label: t("themes.modern") },
          { value: "CLASSIC", label: t("themes.classic") },
          { value: "MINIMAL", label: t("themes.minimal") },
        ]}
      />
      {kind === "invoice" ? (
        <Select
          aria-label={t("pdfFormat")}
          value={pdfFormat}
          onChange={(event) => setPdfFormat(event.target.value)}
          showPlaceholderOption={false}
          className="!w-auto !min-w-28 text-xs"
          options={[
            { value: "A4", label: t("formats.a4") },
            { value: "A12", label: t("formats.a12") },
            { value: "THERMAL", label: t("formats.thermal") },
          ]}
        />
      ) : null}
      <a
        href={themedPdfUrl}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-accent)] underline"
        target="_blank"
        rel="noreferrer"
        title={t("downloadPdf")}
      >
        <Download className="h-3.5 w-3.5" />
        PDF
      </a>
      {zatcaUrl ? (
        <a
          href={zatcaUrl}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-accent)] underline"
          target="_blank"
          rel="noreferrer"
        >
          ZATCA
        </a>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        className="!px-2 !py-1 text-xs"
        onClick={() => void share()}
        title={t("share")}
      >
        <Share2 className="h-3.5 w-3.5" />
        {t("share")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="!px-2 !py-1 text-xs"
        onClick={exportExcel}
        title={t("exportExcel")}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Excel
      </Button>

      {canApprove && onApprove ? (
        <ActionForm
          label={t("quotes.approve")}
          variant="secondary"
          confirm={t("quotes.approveConfirm")}
          action={onApprove}
        />
      ) : null}
      {canSend && onSend ? (
        <ActionForm
          label={t("quotes.send")}
          variant="secondary"
          confirm={t("quotes.sendConfirm")}
          action={onSend}
        />
      ) : null}
      {canAccept && onAccept ? (
        <ActionForm
          label={t("quotes.accept")}
          variant="secondary"
          confirm={t("quotes.acceptConfirm")}
          action={onAccept}
        />
      ) : null}

      {convertAction &&
      convertLabel &&
      canWrite &&
      canConvert ? (
        <ActionForm
          label={convertLabel}
          variant="primary"
          confirm={convertConfirm}
          action={convertAction}
        />
      ) : null}

      {deletable ? (
        <ActionForm
          label={t("delete")}
          variant="danger"
          confirm={t("deleteConfirm")}
          action={onDelete}
        />
      ) : null}

      {shareMsg ? (
        <span className="text-[10px] text-[var(--muted-foreground)]">{shareMsg}</span>
      ) : null}

      {viewOpen ? (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label={tCommon("close")}
            className="absolute inset-0 bg-black/50"
            onClick={() => setViewOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 id={titleId} className="text-lg font-semibold font-mono">
                  {doc.number}
                </h3>
                <div className="mt-1">
                  <StatusBadge status={doc.status} />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setViewOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label={t("customer")} value={doc.contact?.name ?? "—"} />
              <Row label={t("date")} value={isoDate(doc.issuedOn)} />
              <Row
                label={t("total")}
                value={`${doc.totalAmount} ${doc.currency}`}
              />
              {doc.taxAmount != null && kind !== "creditNote" ? (
                <Row label={t("taxAmount")} value={String(doc.taxAmount)} />
              ) : null}
              {kind === "invoice" && doc.balanceDue != null ? (
                <Row label={t("balanceDue")} value={String(doc.balanceDue)} />
              ) : null}
              {kind === "invoice" && doc.paymentMethod ? (
                <Row
                  label={t("invoices.paymentType")}
                  value={String(doc.paymentMethod)}
                />
              ) : null}
              {kind === "creditNote" && doc.relatedInvoiceNumber ? (
                <Row label={t("invoice")} value={doc.relatedInvoiceNumber} />
              ) : null}
              {kind === "creditNote" && doc.reason ? (
                <Row label={t("creditNotes.reason")} value={doc.reason} />
              ) : null}
            </dl>
            {(doc.items?.length ?? 0) > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-3 text-sm">
                {doc.items!.map((item, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {item.description} × {String(item.quantity)}
                    </span>
                    <span className="font-medium">
                      {String(item.totalAmount ?? item.unitPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--muted-foreground)]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
