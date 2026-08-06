import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createCreditNote } from "../actions";

type Invoice = {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
};
type CreditNote = {
  id: string;
  creditNoteNumber: string;
  status: string;
  issuedOn: string;
  totalAmount: string;
  currency: string;
  salesInvoice?: { invoiceNumber: string } | null;
};

export default async function CreditNotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("sales");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");

  const [notes, invoices] = await Promise.all([
    apiServer<CreditNote[]>(`/companies/${companyId}/sales/credit-notes`, {
      companyId,
    }).catch(() => []),
    apiServer<Invoice[]>(`/companies/${companyId}/sales/invoices`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createCreditNote.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("creditNotes.title")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("creditNotes.newTitle")}
          triggerLabel={t("creditNotes.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="salesInvoiceId"
              label={t("invoice")}
              required
              placeholder={tCommon("select")}
              options={invoices.map((i) => ({
                value: i.id,
                label: `${i.invoiceNumber} (${i.totalAmount})`,
              }))}
            />
            <Input
              name="issuedOn"
              label={t("date")}
              type="date"
              defaultValue={today}
            />
            <Input
              name="reason"
              label={t("creditNotes.reason")}
              className="md:col-span-2"
            />
            <Input name="description" label={t("lineDescription")} required />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="amount" label={t("amount")} required />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {notes.length === 0 ? (
          <EmptyState message={t("creditNotes.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("invoice")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("amount")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">
                      {n.creditNoteNumber}
                    </td>
                    <td className="px-2 py-2">
                      {n.salesInvoice?.invoiceNumber ?? "—"}
                    </td>
                    <td className="px-2 py-2">{formatDate(n.issuedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(n.totalAmount, n.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={n.status} />
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
