"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Copy, ExternalLink, FileText } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  approveEmployeeQiwaDocumentation,
  confirmEmployeeQiwaDocumentation,
  markEmployeeQiwaRejected,
  markEmployeeQiwaSent,
  rejectEmployeeQiwaApproval,
  retryEmployeeQiwaDocumentation,
  startEmployeeQiwaDocumentation,
} from "../../actions";

export type QiwaContractView = {
  id: string | null;
  employeeId: string;
  status:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "AWAITING_EMPLOYEE"
    | "PENDING_APPROVAL"
    | "DOCUMENTED"
    | "REJECTED_OR_MODIFICATION";
  qiwaContractReference: string | null;
  contractAttachmentId: string | null;
  contractFile: { id: string; fileName: string } | null;
  startedAt: string | null;
  sentAt: string | null;
  documentedAt: string | null;
  rejectedAt: string | null;
  verifiedBy: { id: string; fullName: string | null } | null;
  lastUpdatedBy: { id: string; fullName: string | null } | null;
  notes: string | null;
  updatedAt: string | null;
};

export type QiwaSummary = {
  fullName: string;
  employeeNumber: string;
  identityType: string | null;
  identityNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  branch: string | null;
  basicSalary: string | null;
  currency: string;
  hireDate: string | null;
  employmentStatus: string | null;
};

type Props = {
  companyId: string;
  employeeId: string;
  canManage: boolean;
  canApprove: boolean;
  qiwaUrl: string;
  contract: QiwaContractView;
  summary: QiwaSummary | null;
};

type Dialog =
  | null
  | "start"
  | "markSent"
  | "confirm"
  | "reject"
  | "confirmFinal"
  | "rejectApproval";

type ActionResult = { ok: true } | { ok: false; error: string };

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function statusLabelKey(status: QiwaContractView["status"]) {
  switch (status) {
    case "NOT_STARTED":
      return "qiwaStatusNotStarted";
    case "IN_PROGRESS":
      return "qiwaStatusInProgress";
    case "AWAITING_EMPLOYEE":
      return "qiwaStatusAwaitingEmployee";
    case "PENDING_APPROVAL":
      return "qiwaStatusPendingApproval";
    case "DOCUMENTED":
      return "qiwaStatusDocumented";
    case "REJECTED_OR_MODIFICATION":
      return "qiwaStatusRejected";
    default:
      return "qiwaStatusNotStarted";
  }
}

/** Real <a target=_blank> — browsers do not treat this as a blocked popup. */
function QiwaSiteLink({
  href,
  variant = "secondary",
  className,
  onNavigate,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant }), className)}
      onClick={() => onNavigate?.()}
    >
      {children}
    </a>
  );
}

export function QiwaContractSection({
  companyId,
  employeeId,
  canManage,
  canApprove,
  qiwaUrl,
  contract,
  summary,
}: Props) {
  const t = useTranslations("hr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [confirmDraft, setConfirmDraft] = useState({
    qiwaContractReference: "",
    documentedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [rejectNotes, setRejectNotes] = useState("");

  const refresh = () => router.refresh();

  const run = (fn: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDialog(null);
      setPdfFile(null);
      refresh();
    });
  };

  /** Fire ERP action without blocking the native link navigation to Qiwa. */
  const startAndKeepDialogUntilDone = () => {
    setError(null);
    startTransition(async () => {
      const result = await startEmployeeQiwaDocumentation(companyId, employeeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDialog(null);
      refresh();
    });
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyHint(label);
      setTimeout(() => setCopyHint(null), 1500);
    } catch {
      setCopyHint(null);
    }
  };

  const summaryLines = useMemo(() => {
    if (!summary) {
      return [] as { label: string; value: string; copyKey?: string }[];
    }
    const lines: { label: string; value: string; copyKey?: string }[] = [
      { label: t("fullName"), value: summary.fullName },
      {
        label: t("identityNumber"),
        value: summary.identityNumber ?? "—",
        copyKey: summary.identityNumber ?? undefined,
      },
      { label: t("identityType"), value: summary.identityType ?? "—" },
      {
        label: t("jobTitle"),
        value: summary.jobTitle ?? "—",
        copyKey: summary.jobTitle ?? undefined,
      },
      { label: t("qiwaDepartment"), value: summary.department ?? "—" },
      { label: t("qiwaBranch"), value: summary.branch ?? "—" },
      {
        label: t("basicSalary"),
        value: formatMoney(summary.basicSalary, summary.currency, locale),
        copyKey: summary.basicSalary ?? undefined,
      },
      {
        label: t("hireDate"),
        value: summary.hireDate ? formatDate(summary.hireDate, locale) : "—",
      },
      { label: t("status"), value: summary.employmentStatus ?? "—" },
    ];
    return lines.filter((l) => l.value && l.value !== "—");
  }, [summary, t, locale]);

  const copyAll = async () => {
    const text = summaryLines.map((l) => `${l.label}: ${l.value}`).join("\n");
    await copyText(t("qiwaCopyAll"), text);
  };

  const status = contract.status;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("qiwaEmploymentContract")}</h3>
        <StatusBadge status={status} label={t(statusLabelKey(status))} />
      </div>

      {error ? (
        <p className="rounded-lg border border-[var(--destructive)]/40 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </p>
      ) : null}

      {status === "NOT_STARTED" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("qiwaNotStartedHint")}
          </p>
          {canManage ? (
            <Button
              type="button"
              onClick={() => setDialog("start")}
              disabled={pending}
            >
              {t("qiwaStart")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {status === "IN_PROGRESS" ? (
        <div className="space-y-3">
          {contract.startedAt ? (
            <Field
              label={t("qiwaStartedAt")}
              value={formatDate(contract.startedAt, locale)}
            />
          ) : null}
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("qiwaInProgressHint")}
          </p>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <QiwaSiteLink href={qiwaUrl}>
                <ExternalLink className="h-4 w-4" />
                {t("qiwaOpen")}
              </QiwaSiteLink>
              <Button
                type="button"
                onClick={() => setDialog("markSent")}
                disabled={pending}
              >
                {t("qiwaMarkSent")}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("qiwaOpenBlockedHint")}{" "}
            <a
              href={qiwaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {qiwaUrl}
            </a>
          </p>
        </div>
      ) : null}

      {status === "AWAITING_EMPLOYEE" ? (
        <div className="space-y-3">
          {contract.sentAt ? (
            <Field label={t("qiwaSentAt")} value={formatDate(contract.sentAt, locale)} />
          ) : null}
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("qiwaAwaitingHint")}
          </p>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <QiwaSiteLink href={qiwaUrl}>
                <ExternalLink className="h-4 w-4" />
                {t("qiwaOpen")}
              </QiwaSiteLink>
              <Button
                type="button"
                onClick={() => setDialog("confirm")}
                disabled={pending}
              >
                {t("qiwaConfirm")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog("reject")}
                disabled={pending}
              >
                {t("qiwaMarkRejected")}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("qiwaOpenBlockedHint")}{" "}
            <a
              href={qiwaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              {qiwaUrl}
            </a>
          </p>
        </div>
      ) : null}

      {status === "PENDING_APPROVAL" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("qiwaPendingApprovalHint")}
          </p>
          {contract.qiwaContractReference ? (
            <Field
              label={t("qiwaContractReference")}
              value={contract.qiwaContractReference}
            />
          ) : null}
          {contract.documentedAt ? (
            <Field
              label={t("qiwaDocumentedAt")}
              value={formatDate(contract.documentedAt, locale)}
            />
          ) : null}
          {contract.lastUpdatedBy?.fullName ? (
            <Field
              label={t("qiwaLastUpdated")}
              value={contract.lastUpdatedBy.fullName}
            />
          ) : null}
          {contract.contractFile ? (
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("qiwaDocument")}
              </p>
              <a
                href={`/api/attachments/${contract.contractFile.id}?companyId=${companyId}`}
                className="inline-flex items-center gap-2 text-sm text-[var(--primary)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4" />
                {contract.contractFile.fileName}
              </a>
            </div>
          ) : null}
          {contract.notes ? (
            <Field label={t("notes")} value={contract.notes} />
          ) : null}
          {canApprove ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    approveEmployeeQiwaDocumentation(companyId, employeeId),
                  )
                }
              >
                {t("qiwaApprove")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setDialog("rejectApproval")}
              >
                {t("qiwaRejectApproval")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "DOCUMENTED" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            {t("qiwaStatusDocumented")}
          </div>
          {contract.qiwaContractReference ? (
            <Field
              label={t("qiwaContractReference")}
              value={contract.qiwaContractReference}
            />
          ) : null}
          {contract.documentedAt ? (
            <Field
              label={t("qiwaDocumentedAt")}
              value={formatDate(contract.documentedAt, locale)}
            />
          ) : null}
          {contract.verifiedBy?.fullName ? (
            <Field
              label={t("qiwaVerifiedBy")}
              value={contract.verifiedBy.fullName}
            />
          ) : null}
          {contract.contractFile ? (
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("qiwaDocument")}
              </p>
              <a
                href={`/api/attachments/${contract.contractFile.id}?companyId=${companyId}`}
                className="inline-flex items-center gap-2 text-sm text-[var(--primary)] underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4" />
                {contract.contractFile.fileName}
              </a>
            </div>
          ) : null}
          {contract.notes ? (
            <Field label={t("notes")} value={contract.notes} />
          ) : null}
          {contract.updatedAt ? (
            <Field
              label={t("qiwaLastUpdated")}
              value={formatDate(contract.updatedAt, locale)}
            />
          ) : null}
        </div>
      ) : null}

      {status === "REJECTED_OR_MODIFICATION" ? (
        <div className="space-y-3">
          {contract.notes ? (
            <Field label={t("notes")} value={contract.notes} />
          ) : null}
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () =>
                    retryEmployeeQiwaDocumentation(companyId, employeeId),
                  )
                }
              >
                {t("qiwaRetry")}
              </Button>
              <QiwaSiteLink href={qiwaUrl}>
                <ExternalLink className="h-4 w-4" />
                {t("qiwaOpen")}
              </QiwaSiteLink>
            </div>
          ) : null}
        </div>
      ) : null}

      {dialog === "start" ? (
        <Modal title={t("qiwaStartDialogTitle")} onClose={() => setDialog(null)}>
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            {t("qiwaStartDialogHint")}
          </p>
          <div className="mb-3 space-y-2 rounded-lg border border-[var(--border)] p-3">
            {summaryLines.map((line) => (
              <div
                key={line.label}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="text-[var(--muted-foreground)]">{line.label}</span>
                <span className="flex items-center gap-2 font-medium">
                  {line.value}
                  {line.copyKey ? (
                    <button
                      type="button"
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      onClick={() => copyText(line.label, line.copyKey!)}
                      aria-label={`Copy ${line.label}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          {copyHint ? (
            <p className="mb-2 text-xs text-[var(--muted-foreground)]">
              {t("qiwaCopied", { field: copyHint })}
            </p>
          ) : null}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={copyAll}>
              {t("qiwaCopyAll")}
            </Button>
          </div>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            {t("qiwaManualNote")}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialog(null)}
            >
              {tc("cancel")}
            </Button>
            <QiwaSiteLink
              href={qiwaUrl}
              variant="primary"
              className={pending ? "pointer-events-none opacity-50" : undefined}
              onNavigate={startAndKeepDialogUntilDone}
            >
              <ExternalLink className="h-4 w-4" />
              {t("qiwaContinue")}
            </QiwaSiteLink>
          </div>
        </Modal>
      ) : null}

      {dialog === "markSent" ? (
        <Modal
          title={t("qiwaMarkSentConfirmTitle")}
          onClose={() => setDialog(null)}
        >
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            {t("qiwaMarkSentConfirmBody")}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialog(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => markEmployeeQiwaSent(companyId, employeeId))
              }
            >
              {t("qiwaMarkSentConfirm")}
            </Button>
          </div>
        </Modal>
      ) : null}

      {dialog === "confirm" || dialog === "confirmFinal" ? (
        <Modal
          title={t("qiwaConfirmTitle")}
          onClose={() => {
            setDialog(null);
            setPdfFile(null);
          }}
        >
          <p className="mb-3 text-sm text-[var(--muted-foreground)]">
            {t("qiwaConfirmDesc")}
          </p>
          {dialog === "confirm" ? (
            <div className="space-y-3">
              <Input
                label={`${t("qiwaContractReference")} *`}
                value={confirmDraft.qiwaContractReference}
                onChange={(e) =>
                  setConfirmDraft((d) => ({
                    ...d,
                    qiwaContractReference: e.target.value,
                  }))
                }
              />
              <Input
                type="date"
                label={`${t("qiwaDocumentedAt")} *`}
                value={confirmDraft.documentedAt}
                onChange={(e) =>
                  setConfirmDraft((d) => ({
                    ...d,
                    documentedAt: e.target.value,
                  }))
                }
              />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{`${t("qiwaDocument")} *`}</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
                />
                {pdfFile ? (
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {pdfFile.name} · {(pdfFile.size / 1024).toFixed(1)} KB{" "}
                    <button
                      type="button"
                      className="ms-2 underline"
                      onClick={() => setPdfFile(null)}
                    >
                      Remove
                    </button>
                  </span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("notes")}</span>
                <textarea
                  rows={3}
                  value={confirmDraft.notes}
                  onChange={(e) =>
                    setConfirmDraft((d) => ({ ...d, notes: e.target.value }))
                  }
                  className="rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm"
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDialog(null)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={
                    pending ||
                    !confirmDraft.qiwaContractReference.trim() ||
                    !confirmDraft.documentedAt ||
                    !pdfFile
                  }
                  onClick={() => setDialog("confirmFinal")}
                >
                  {t("qiwaConfirmSubmit")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("qiwaConfirmFinal")}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDialog("confirm")}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={pending || !pdfFile}
                  onClick={() => {
                    if (!pdfFile) return;
                    const file = pdfFile;
                    run(async () => {
                      const contentBase64 = await fileToBase64(file);
                      return confirmEmployeeQiwaDocumentation(
                        companyId,
                        employeeId,
                        {
                          qiwaContractReference:
                            confirmDraft.qiwaContractReference,
                          documentedAt: confirmDraft.documentedAt,
                          notes: confirmDraft.notes || undefined,
                          fileName: file.name || "qiwa-contract.pdf",
                          mimeType: file.type || "application/pdf",
                          sizeBytes: String(file.size),
                          contentBase64,
                        },
                      );
                    });
                  }}
                >
                  {t("qiwaConfirm")}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      ) : null}

      {dialog === "reject" ? (
        <Modal title={t("qiwaRejectTitle")} onClose={() => setDialog(null)}>
          <label className="mb-3 flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{`${t("qiwaRejectNotes")} *`}</span>
            <textarea
              rows={4}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm"
              required
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialog(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || !rejectNotes.trim()}
              onClick={() =>
                run(() =>
                  markEmployeeQiwaRejected(companyId, employeeId, rejectNotes),
                )
              }
            >
              {t("qiwaRejectSubmit")}
            </Button>
          </div>
        </Modal>
      ) : null}

      {dialog === "rejectApproval" ? (
        <Modal
          title={t("qiwaRejectApprovalTitle")}
          onClose={() => setDialog(null)}
        >
          <label className="mb-3 flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{`${t("qiwaRejectApprovalNotes")} *`}</span>
            <textarea
              rows={4}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              className="rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm"
              required
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDialog(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              disabled={pending || !rejectNotes.trim()}
              onClick={() =>
                run(() =>
                  rejectEmployeeQiwaApproval(
                    companyId,
                    employeeId,
                    rejectNotes,
                  ),
                )
              }
            >
              {t("qiwaRejectApprovalSubmit")}
            </Button>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
