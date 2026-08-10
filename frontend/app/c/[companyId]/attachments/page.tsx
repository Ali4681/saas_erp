import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { uploadAttachment } from "./actions";

type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: string;
  createdAt: string;
};

export default async function AttachmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("attachments");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "attachments.write");

  const attachments = await apiServer<Attachment[]>(
    `/companies/${companyId}/attachments`,
    { companyId },
  ).catch(() => []);

  const upload = uploadAttachment.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("uploadTitle")}
          triggerLabel={t("uploadTrigger")}
        >
          <form action={upload} className="grid gap-3 md:grid-cols-2">
            <Select
              name="entityType"
              label={t("entityType")}
              required
              options={[
                { value: "crm_contact", label: t("entityContact") },
                { value: "sales_invoice", label: t("entityInvoice") },
                { value: "work_project", label: t("entityProject") },
                { value: "business_note", label: t("entityNote") },
                { value: "employee", label: t("entityEmployee") },
                { value: "other", label: t("entityOther") },
              ]}
            />
            <Input
              name="entityId"
              label={t("entityId")}
              required
              placeholder="019f…"
            />
            <div className="md:col-span-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("file")}</span>
                <input
                  type="file"
                  name="file"
                  required
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("upload")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {attachments.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("colFile")}</th>
                  <th className="px-2 py-2 font-medium">{t("colEntity")}</th>
                  <th className="px-2 py-2 font-medium">{t("colSize")}</th>
                  <th className="px-2 py-2 font-medium">{t("colDate")}</th>
                  <th className="px-2 py-2 font-medium">{t("colDownload")}</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <p className="font-medium">{a.fileName}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {a.mimeType}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <p>{a.entityType}</p>
                      <p className="font-mono text-xs text-[var(--color-muted)]">
                        {a.entityId}
                      </p>
                    </td>
                    <td className="px-2 py-2">{a.sizeBytes} B</td>
                    <td className="px-2 py-2">{formatDate(a.createdAt)}</td>
                    <td className="px-2 py-2">
                      <a
                        href={`/api/attachments/${a.id}?companyId=${companyId}`}
                        className="text-xs text-[var(--color-accent)] underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("download")}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
