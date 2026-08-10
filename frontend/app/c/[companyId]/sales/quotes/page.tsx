import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
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
import { convertQuote, createQuote } from "../actions";

type Contact = { id: string; name: string };
type Quote = {
  id: string;
  quoteNumber: string;
  status: string;
  issuedOn: string;
  totalAmount: string;
  currency: string;
  contact?: { name: string } | null;
};

export default async function QuotesPage({
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

  const [quotes, contacts] = await Promise.all([
    apiServer<Quote[]>(`/companies/${companyId}/sales/quotes`, { companyId }).catch(
      () => [],
    ),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createQuote.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("quotes.title")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("quotes.newTitle")}
          triggerLabel={t("quotes.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="contactId"
              label={t("customer")}
              required
              placeholder={tCommon("select")}
              options={contacts.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input
              name="issuedOn"
              label={t("issuedOn")}
              type="date"
              defaultValue={today}
            />
            <Input name="expiresOn" label={t("expiresOn")} type="date" />
            <Input name="currency" label={t("currency")} defaultValue="SAR" />
            <Input
              name="description"
              label={t("lineDescription")}
              required
              className="md:col-span-2"
            />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="unitPrice" label={t("unitPrice")} required />
            <Input name="taxAmount" label={t("taxAmount")} defaultValue="0" />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {quotes.length === 0 ? (
          <EmptyState message={t("quotes.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("customer")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("total")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">{q.quoteNumber}</td>
                    <td className="px-2 py-2">{q.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(q.issuedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(q.totalAmount, q.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite &&
                      !["CANCELLED", "CLOSED", "REJECTED"].includes(q.status) ? (
                        <ActionForm
                          label={t("quotes.convert")}
                          variant="primary"
                          confirm={t("quotes.convertConfirm")}
                          action={convertQuote.bind(null, companyId, q.id)}
                        />
                      ) : null}
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
