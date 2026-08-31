"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Eye, Share2, X } from "lucide-react";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { SalesCustomerField } from "@/components/erp/SalesCustomerField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createFormatters } from "@/lib/format";
import { lockPageScroll } from "@/lib/lock-page-scroll";

export type StatementInvoice = {
  id: string;
  invoiceNumber: string;
  issuedOn: string;
  dueOn?: string | null;
  totalAmount: string;
  balanceDue: string;
  currency: string;
  status: string;
};

export type CustomerStatementRow = {
  contactId: string;
  contact: { id: string; name: string; phone?: string | null };
  currency: string;
  outstandingTotal: string;
  invoiceCount: number;
  invoices: StatementInvoice[];
};

function isoDate(value: string) {
  return value.slice(0, 10);
}

function createdKey(companyId: string) {
  return `sales-statements-created:${companyId}`;
}

function readCreated(companyId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(createdKey(companyId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeCreated(companyId: string, ids: string[]) {
  localStorage.setItem(createdKey(companyId), JSON.stringify(ids));
}

/** Migrates old dismiss-list model once: keep nothing auto-shown. */
function migrateLegacyDismissed(companyId: string) {
  try {
    localStorage.removeItem(`sales-statements-dismissed:${companyId}`);
  } catch {
    /* ignore */
  }
}

export function CustomerStatementsWorkspace({
  companyId,
  contacts,
  statements,
  canWrite,
}: {
  companyId: string;
  contacts: Array<{ id: string; name: string }>;
  statements: CustomerStatementRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("sales");
  const [createdIds, setCreatedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    migrateLegacyDismissed(companyId);
    setCreatedIds(readCreated(companyId));
    setReady(true);
  }, [companyId]);

  function addCreated(contactId: string) {
    setCreatedIds((prev) => {
      const next = prev.includes(contactId) ? prev : [...prev, contactId];
      writeCreated(companyId, next);
      return next;
    });
  }

  function removeCreated(contactId: string) {
    setCreatedIds((prev) => {
      const next = prev.filter((id) => id !== contactId);
      writeCreated(companyId, next);
      return next;
    });
  }

  const byId = useMemo(
    () => new Map(statements.map((s) => [s.contactId, s])),
    [statements],
  );

  const visible = useMemo(() => {
    if (!ready) return [];
    return createdIds
      .map((id) => byId.get(id))
      .filter((row): row is CustomerStatementRow => Boolean(row));
  }, [createdIds, byId, ready]);

  return (
    <div className="space-y-5">
      {canWrite ? (
        <CreateFormDialog
          title={t("creditNotes.newTitle")}
          triggerLabel={t("creditNotes.add")}
          closeOnSuccess
        >
          <CustomerStatementPicker
            companyId={companyId}
            contacts={contacts}
            statements={statements}
            alreadyCreated={createdIds}
            onCreate={addCreated}
          />
        </CreateFormDialog>
      ) : null}

      <Card>
        <CustomerStatementsTable
          companyId={companyId}
          rows={visible}
          canWrite={canWrite}
          onDelete={removeCreated}
        />
      </Card>
    </div>
  );
}

export function CustomerStatementPicker({
  companyId,
  contacts,
  statements,
  alreadyCreated,
  onCreate,
  onSuccess,
}: {
  companyId: string;
  contacts: Array<{ id: string; name: string }>;
  statements: CustomerStatementRow[];
  alreadyCreated: string[];
  onCreate: (contactId: string) => void;
  onSuccess?: () => void;
}) {
  const t = useTranslations("sales");
  const locale = useLocale();
  const { formatMoney } = useMemo(() => createFormatters(locale), [locale]);
  const byId = useMemo(
    () => new Map(statements.map((s) => [s.contactId, s])),
    [statements],
  );
  const [contactId, setContactId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = contactId ? byId.get(contactId) : undefined;
  const already = contactId ? alreadyCreated.includes(contactId) : false;

  function createStatement() {
    setError(null);
    if (!selected) {
      setError(t("creditNotes.noBalanceForCustomer"));
      return;
    }
    if (already) {
      setError(t("statementAlreadyCreated"));
      return;
    }
    onCreate(selected.contactId);
    onSuccess?.();
  }

  return (
    <div className="grid gap-3">
      <SalesCustomerField
        companyId={companyId}
        contacts={contacts}
        label={t("customer")}
        onChange={setContactId}
      />
      <Input
        name="outstandingTotal"
        label={t("creditNotes.outstanding")}
        readOnly
        value={
          selected
            ? formatMoney(selected.outstandingTotal, selected.currency)
            : "—"
        }
      />
      {selected ? (
        <div className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
          <p className="mb-2 text-[var(--color-muted)]">
            {t("creditNotes.openInvoices", { count: selected.invoiceCount })}
          </p>
          <ul className="space-y-1">
            {selected.invoices.map((inv) => (
              <li key={inv.id} className="flex justify-between gap-2">
                <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                <span>{formatMoney(inv.balanceDue, inv.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : contactId ? (
        <p className="text-sm text-[var(--color-muted)]">
          {t("creditNotes.noBalanceForCustomer")}
        </p>
      ) : null}

      <Button
        type="button"
        disabled={!selected || already}
        onClick={createStatement}
        className="w-full"
      >
        {t("create")}
      </Button>
      {error ? (
        <p className="text-sm text-[var(--destructive)]">{error}</p>
      ) : null}
    </div>
  );
}

export function CustomerStatementActions({
  companyId,
  row,
  canWrite = false,
  onDelete,
}: {
  companyId: string;
  row: CustomerStatementRow;
  canWrite?: boolean;
  onDelete?: (contactId: string) => void;
}) {
  const t = useTranslations("sales");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { formatMoney, formatDate } = useMemo(
    () => createFormatters(locale),
    [locale],
  );
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [pdfTheme, setPdfTheme] = useState("MODERN");
  const titleId = useId();
  const pdfUrl = `/api/sales/contacts/${row.contactId}/statement/pdf?companyId=${companyId}&theme=${pdfTheme}`;

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
        ? new URL(pdfUrl, window.location.origin).toString()
        : pdfUrl;
    const title = `${t("creditNotes.title")} · ${row.contact.name}`;
    const text = [
      title,
      `${t("creditNotes.outstanding")}: ${row.outstandingTotal} ${row.currency}`,
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
      <Select
        aria-label={t("pdfTheme")}
        value={pdfTheme}
        onChange={(e) => setPdfTheme(e.target.value)}
        showPlaceholderOption={false}
        className="!w-auto !min-w-28 text-xs"
        options={[
          { value: "MODERN", label: t("themes.modern") },
          { value: "CLASSIC", label: t("themes.classic") },
          { value: "MINIMAL", label: t("themes.minimal") },
        ]}
      />
      <a
        href={pdfUrl}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-accent)] underline"
        target="_blank"
        rel="noopener"
        title={t("downloadPdf")}
      >
        <Download className="h-3.5 w-3.5" />
        PDF
      </a>
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
      {canWrite && onDelete ? (
        <Button
          type="button"
          variant="danger"
          className="!px-2 !py-1 text-xs"
          onClick={() => setDeleteOpen(true)}
          title={t("delete")}
        >
          {t("delete")}
        </Button>
      ) : null}
      {shareMsg ? (
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {shareMsg}
        </span>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        title={t("delete")}
        message={t("deleteConfirm")}
        confirmLabel={t("delete")}
        cancelLabel={tCommon("cancel")}
        variant="danger"
        onConfirm={() => {
          setDeleteOpen(false);
          onDelete?.(row.contactId);
        }}
        onCancel={() => setDeleteOpen(false)}
      />

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
                <h3 id={titleId} className="text-lg font-semibold">
                  {row.contact.name}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {t("creditNotes.outstanding")}:{" "}
                  {formatMoney(row.outstandingTotal, row.currency)}
                </p>
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
            <ul className="space-y-2 text-sm">
              {row.invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-2 last:border-0"
                >
                  <div>
                    <div className="font-mono text-xs">{inv.invoiceNumber}</div>
                    <div className="text-[var(--color-muted)]">
                      {formatDate(isoDate(inv.issuedOn))}
                      {inv.dueOn
                        ? ` · ${t("invoices.dueOn")} ${formatDate(isoDate(inv.dueOn))}`
                        : ""}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={inv.status} />
                    </div>
                  </div>
                  <div className="font-medium">
                    {formatMoney(inv.balanceDue, inv.currency)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CustomerStatementsTable({
  companyId,
  rows,
  canWrite,
  onDelete,
}: {
  companyId: string;
  rows: CustomerStatementRow[];
  canWrite: boolean;
  onDelete: (contactId: string) => void;
}) {
  const t = useTranslations("sales");
  const locale = useLocale();
  const { formatMoney } = useMemo(() => createFormatters(locale), [locale]);

  if (rows.length === 0) {
    return <EmptyState message={t("creditNotes.empty")} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
            <th className="px-2 py-2 font-medium">{t("customer")}</th>
            <th className="px-2 py-2 font-medium">
              {t("creditNotes.openCount")}
            </th>
            <th className="px-2 py-2 font-medium">
              {t("creditNotes.outstanding")}
            </th>
            <th className="px-2 py-2 font-medium">{t("action")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.contactId}
              className="border-b border-[var(--color-border)] last:border-0"
            >
              <td className="px-2 py-2">
                <div className="font-medium">{row.contact.name}</div>
                {row.contact.phone ? (
                  <div className="text-xs text-[var(--color-muted)]">
                    {row.contact.phone}
                  </div>
                ) : null}
              </td>
              <td className="px-2 py-2">{row.invoiceCount}</td>
              <td className="px-2 py-2 font-medium">
                {formatMoney(row.outstandingTotal, row.currency)}
              </td>
              <td className="px-2 py-2">
                <CustomerStatementActions
                  companyId={companyId}
                  row={row}
                  canWrite={canWrite}
                  onDelete={onDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
