import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { SalesCustomerField } from "@/components/erp/SalesCustomerField";
import { SalesDocActions } from "@/components/erp/SalesDocActions";
import { SalesLineItemFields } from "@/components/erp/SalesLineItemFields";
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
import { InvoiceIssueDueFields } from "@/components/erp/InvoiceIssueDueFields";
import { InvoicePaymentMethodField } from "@/components/erp/InvoicePaymentMethodField";
import { PosSaleFields } from "@/components/erp/PosSaleFields";
import {
  createInvoice,
  deleteInvoice,
  issueHeldInvoice,
  recordPayment,
  updateInvoice,
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

type Contact = { id: string; name: string; phone?: string | null };
type InventoryItem = {
  id: string;
  name: string;
  sku?: string | null;
  salePrice?: string | null;
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedOn: string;
  dueOn?: string | null;
  subtotal?: string;
  taxAmount?: string;
  totalAmount: string;
  balanceDue: string;
  currency: string;
  saleChannel?: string | null;
  paymentMethod?: string | null;
  pointOfSale?: { id: string; code: string; name: string } | null;
  posCashier?: {
    id: string;
    displayName?: string | null;
    employee?: { fullName: string } | null;
  } | null;
  salesQuoteId?: string | null;
  quoteNumber?: string | null;
  quote?: { id: string; quoteNumber: string } | null;
  contact?: { id?: string; name: string; phone?: string | null } | null;
  items?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxAmount?: string;
    totalAmount?: string;
    itemId?: string | null;
  }>;
  creditNotes?: Array<{
    id: string;
    creditNoteNumber: string;
    status: string;
    issuedOn: string;
    reason?: string | null;
    totalAmount: string;
    currency: string;
    items?: Array<{
      description: string;
      quantity: string;
      amount: string;
    }>;
  }>;
};
type BankAccount = { id: string; name: string };

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
  const { formatDate, formatMoney } = await getFormatters();
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");

  const [invoices, contacts, accounts, company, points, inventoryItems] =
    await Promise.all([
    apiServer<Invoice[]>(`/companies/${companyId}/sales/invoices`, {
      companyId,
    }).catch(() => []),
    apiServer<Contact[]>(`/companies/${companyId}/crm/contacts`, {
      companyId,
    }).catch(() => []),
    apiServer<BankAccount[]>(`/companies/${companyId}/finance/bank-accounts`, {
      companyId,
    }).catch(() => []),
    apiServer<{
      defaultCurrency?: string;
      settings?: { defaultTaxRate?: string } | null;
    }>(`/companies/${companyId}`, { companyId }).catch(() => null),
    apiServer<
      Array<{
        id: string;
        code: string;
        name: string;
        cashiers: Array<{
          id: string;
          displayName?: string | null;
          employee: { fullName: string };
        }>;
      }>
    >(`/companies/${companyId}/sales/pos`, { companyId }).catch(() => []),
    apiServer<InventoryItem[]>(
      `/companies/${companyId}/inventory/items?sellableOnly=true`,
      {
      companyId,
    },
    ).catch(() => []),
  ]);

  const create = createInvoice.bind(null, companyId);
  const pay = recordPayment.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);
  const openInvoices = invoices.filter((i) => Number(i.balanceDue) > 0);
  const defaultCurrency = company?.defaultCurrency ?? "SAR";
  const defaultTaxRate = Number(company?.settings?.defaultTaxRate ?? 0);

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
              <SalesCustomerField
                companyId={companyId}
                contacts={contacts}
                label={t("customer")}
              />
              <InvoiceIssueDueFields
                issuedLabel={t("issuedOn")}
                dueLabel={t("invoices.dueOn")}
                defaultIssuedOn={today}
              />
              <Select
                name="currency"
                label={t("currency")}
                defaultValue={defaultCurrency}
                showPlaceholderOption={false}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              <Select
                name="saleChannel"
                label={t("channel")}
                defaultValue="POS"
                options={[
                  { value: "POS", label: t("channels.pos") },
                  { value: "ECOMMERCE", label: t("channels.ecommerce") },
                  { value: "DELIVERY", label: t("channels.delivery") },
                  { value: "BNPL", label: t("channels.bnpl") },
                ]}
              />
              <InvoicePaymentMethodField defaultValue="CASH" />
              <PosSaleFields points={points} />
              <Select
                name="status"
                label={t("status")}
                options={[
                  { value: "ISSUED", label: t("invoices.issued") },
                  { value: "ON_HOLD", label: t("invoices.onHold") },
                  { value: "DRAFT", label: t("invoices.draft") },
                ]}
              />
              <SalesLineItemFields
                items={inventoryItems}
                defaultTaxRate={defaultTaxRate}
                defaultMode={defaultTaxRate > 0 ? "COMPANY" : "NONE"}
              />
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
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("quoteNumber")}</th>
                  <th className="px-2 py-2 font-medium">{t("customer")}</th>
                  <th className="px-2 py-2 font-medium">{t("pos.pointOfSale")}</th>
                  <th className="px-2 py-2 font-medium">{t("pos.cashier")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("total")}</th>
                  <th className="px-2 py-2 font-medium">{t("balanceDue")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
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
                    <td className="px-2 py-2 font-mono text-xs">
                      {inv.quote?.quoteNumber ?? inv.quoteNumber ?? "—"}
                    </td>
                    <td className="px-2 py-2">{inv.contact?.name ?? "—"}</td>
                    <td className="px-2 py-2 text-xs">
                      {inv.pointOfSale
                        ? `${inv.pointOfSale.code}`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {inv.posCashier?.displayName ||
                        inv.posCashier?.employee?.fullName ||
                        "—"}
                    </td>
                    <td className="px-2 py-2">{formatDate(inv.issuedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(inv.totalAmount, inv.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(inv.balanceDue, inv.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge
                          status={inv.status}
                          label={
                            inv.status === "ON_HOLD"
                              ? t("invoices.onHold")
                              : inv.status === "DRAFT"
                                ? t("invoices.draft")
                                : undefined
                          }
                        />
                        {inv.paymentMethod === "MIXED" ? (
                          <span className="text-[10px] text-[var(--color-muted)]">
                            {t("invoices.mixed")}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <SalesDocActions
                        kind="invoice"
                        companyId={companyId}
                        contacts={contacts}
                        inventoryItems={inventoryItems}
                        defaultTaxRate={defaultTaxRate}
                        canWrite={canWrite}
                        pdfUrl={`/api/sales/invoices/${inv.id}/pdf?companyId=${companyId}`}
                        zatcaUrl={`/api/sales/invoices/${inv.id}/zatca?companyId=${companyId}`}
                        onUpdate={updateInvoice.bind(null, companyId, inv.id)}
                        onDelete={deleteInvoice.bind(null, companyId, inv.id)}
                        onIssue={issueHeldInvoice.bind(null, companyId, inv.id)}
                        doc={{
                          id: inv.id,
                          number: inv.invoiceNumber,
                          status: inv.status,
                          issuedOn: inv.issuedOn,
                          dueOn: inv.dueOn,
                          currency: inv.currency,
                          subtotal: inv.subtotal,
                          taxAmount: inv.taxAmount,
                          totalAmount: inv.totalAmount,
                          balanceDue: inv.balanceDue,
                          saleChannel: inv.saleChannel,
                          paymentMethod: inv.paymentMethod,
                          contact: inv.contact,
                          items: inv.items,
                          creditNotes: inv.creditNotes,
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
