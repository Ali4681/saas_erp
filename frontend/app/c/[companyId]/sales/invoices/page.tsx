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
import { createInvoice, recordPayment } from "../actions";

type Contact = { id: string; name: string };
type BankAccount = { id: string; name: string };
type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedOn: string;
  totalAmount: string;
  balanceDue: string;
  currency: string;
  contact?: { name: string } | null;
};

export default async function InvoicesPage({
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

  const [invoices, contacts, accounts] = await Promise.all([
    apiServer<Invoice[]>(`/companies/${companyId}/sales/invoices`, {
      companyId,
    }).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
    apiServer<BankAccount[]>(`/companies/${companyId}/finance/bank-accounts`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createInvoice.bind(null, companyId);
  const pay = recordPayment.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);
  const openInvoices = invoices.filter((i) => Number(i.balanceDue) > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("invoices.title")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CreateFormDialog
            title={t("invoices.newTitle")}
            triggerLabel={t("invoices.add")}
          >
            <form action={create} className="grid gap-3">
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
              <Input name="dueOn" label={t("invoices.dueOn")} type="date" />
              <Select
                name="status"
                label={t("status")}
                options={[
                  { value: "ISSUED", label: t("invoices.issued") },
                  { value: "DRAFT", label: t("invoices.draft") },
                ]}
              />
              <Input name="description" label={t("lineDescription")} required />
              <div className="grid grid-cols-2 gap-3">
                <Input name="quantity" label={t("quantity")} defaultValue="1" />
                <Input name="unitPrice" label={t("unitPrice")} required />
              </div>
              <Button type="submit">{t("create")}</Button>
            </form>
          </CreateFormDialog>

          <CreateFormDialog
            title={t("invoices.recordPaymentTitle")}
            triggerLabel={t("invoices.recordPayment")}
          >
            {openInvoices.length === 0 ? (
              <EmptyState message={t("invoices.noOpen")} />
            ) : (
              <form action={pay} className="grid gap-3">
                <Select
                  name="salesInvoiceId"
                  label={t("invoice")}
                  required
                  placeholder={tCommon("select")}
                  options={openInvoices.map((i) => ({
                    value: i.id,
                    label: t("invoices.invoiceWithBalance", {
                      number: i.invoiceNumber,
                      balance: i.balanceDue,
                    }),
                  }))}
                />
                <Input name="amount" label={t("amount")} required />
                <Select
                  name="method"
                  label={t("invoices.method")}
                  required
                  options={[
                    { value: "CASH", label: t("invoices.cash") },
                    {
                      value: "BANK_TRANSFER",
                      label: t("invoices.bankTransfer"),
                    },
                    { value: "CARD", label: t("invoices.card") },
                    {
                      value: "PAYMENT_GATEWAY",
                      label: t("invoices.paymentGateway"),
                    },
                    { value: "OTHER", label: t("invoices.other") },
                  ]}
                />
                <Select
                  name="bankAccountId"
                  label={t("invoices.bankAccount")}
                  placeholder={t("optional")}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                />
                <Input
                  name="externalReference"
                  label={t("invoices.externalReference")}
                />
                <Button type="submit">{t("invoices.submitPayment")}</Button>
              </form>
            )}
          </CreateFormDialog>
        </div>
      ) : null}

      <Card>
        {invoices.length === 0 ? (
          <EmptyState message={t("invoices.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("customer")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("total")}</th>
                  <th className="px-2 py-2 font-medium">{t("balanceDue")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-2 py-2">{inv.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(inv.issuedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(inv.totalAmount, inv.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(inv.balanceDue, inv.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-2 py-2">
                      <a
                        href={`/api/sales/invoices/${inv.id}/pdf?companyId=${companyId}`}
                        className="text-xs text-[var(--color-accent)] underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("invoices.download")}
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
