import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { SalesCustomerField } from "@/components/erp/SalesCustomerField";
import { SalesDocActions } from "@/components/erp/SalesDocActions";
import { SalesTaxFields } from "@/components/erp/SalesTaxFields";
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
import {
  convertQuote,
  createQuote,
  deleteQuote,
  updateQuote,
  updateQuoteStatus,
} from "../actions";

const CURRENCIES = [
  "SAR",
  "USD",
  "EUR",
  "AED",
  "EGP",
  "BHD",
  "KWD",
  "OMR",
  "QAR",
];

type Contact = { id: string; name: string };
type Quote = {
  id: string;
  quoteNumber: string;
  status: string;
  issuedOn: string;
  expiresOn?: string | null;
  subtotal?: string;
  taxAmount?: string;
  totalAmount: string;
  currency: string;
  contact?: { id?: string; name: string } | null;
  items?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxAmount?: string;
    totalAmount?: string;
  }>;
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
  const { formatDate, formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");

  const [quotes, contacts, company] = await Promise.all([
    apiServer<Quote[]>(`/companies/${companyId}/sales/quotes`, {
      companyId,
    }).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
    apiServer<{
      defaultCurrency?: string;
      settings?: { defaultTaxRate?: string } | null;
    }>(`/companies/${companyId}`, { companyId }).catch(() => null),
  ]);

  const create = createQuote.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);
  const defaultCurrency = company?.defaultCurrency ?? "SAR";
  const defaultTaxRate = Number(company?.settings?.defaultTaxRate ?? 0);

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
            <SalesCustomerField
              companyId={companyId}
              contacts={contacts}
              label={t("customer")}
            />
            <Input
              name="issuedOn"
              label={t("issuedOn")}
              type="date"
              defaultValue={today}
            />
            <Input name="expiresOn" label={t("expiresOn")} type="date" />
            <Select
              name="currency"
              label={t("currency")}
              defaultValue={defaultCurrency}
              showPlaceholderOption={false}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <Input
              name="description"
              label={t("lineDescription")}
              required
              className="md:col-span-2"
            />
            <SalesTaxFields
              defaultTaxRate={defaultTaxRate}
              defaultMode={defaultTaxRate > 0 ? "COMPANY" : "NONE"}
            />
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
            <table className="w-full min-w-[900px] text-sm">
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
                    <td className="px-2 py-2 font-mono text-xs">
                      {q.quoteNumber}
                    </td>
                    <td className="px-2 py-2">{q.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(q.issuedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(q.totalAmount, q.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={q.status} />
                    </td>
                    <td className="px-2 py-2">
                      <SalesDocActions
                        kind="quote"
                        companyId={companyId}
                        contacts={contacts}
                        defaultTaxRate={defaultTaxRate}
                        canWrite={canWrite}
                        pdfUrl={`/api/sales/quotes/${q.id}/pdf?companyId=${companyId}`}
                        onUpdate={updateQuote.bind(null, companyId, q.id)}
                        onDelete={deleteQuote.bind(null, companyId, q.id)}
                        convertAction={convertQuote.bind(null, companyId, q.id)}
                        convertLabel={t("quotes.convert")}
                        convertConfirm={t("quotes.convertConfirm")}
                        onApprove={updateQuoteStatus.bind(
                          null,
                          companyId,
                          q.id,
                          "APPROVED",
                        )}
                        onSend={updateQuoteStatus.bind(
                          null,
                          companyId,
                          q.id,
                          "SENT",
                        )}
                        onAccept={updateQuoteStatus.bind(
                          null,
                          companyId,
                          q.id,
                          "ACCEPTED",
                        )}
                        doc={{
                          id: q.id,
                          number: q.quoteNumber,
                          status: q.status,
                          issuedOn: q.issuedOn,
                          expiresOn: q.expiresOn,
                          currency: q.currency,
                          subtotal: q.subtotal,
                          taxAmount: q.taxAmount,
                          totalAmount: q.totalAmount,
                          contact: q.contact,
                          items: q.items,
                        }}
                      />
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
