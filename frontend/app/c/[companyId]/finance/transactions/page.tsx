import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createTransaction } from "../actions";

type Tx = {
  id: string;
  transactionType: string;
  direction: string;
  amount: string;
  currency: string;
  description: string | null;
  occurredAt: string;
};

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "finance.write");

  const transactions = await apiServer<Tx[]>(
    `/companies/${companyId}/finance/transactions`,
    { companyId },
  ).catch(() => []);

  const create = createTransaction.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("transactionsTitle")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newTransaction")}
          triggerLabel={t("addTransaction")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="transactionType"
              label={t("type")}
              required
              options={[
                { value: "RECEIPT", label: t("txReceipt") },
                { value: "PAYMENT", label: t("txPayment") },
                { value: "EXPENSE", label: t("txExpense") },
                { value: "ADJUSTMENT", label: t("txAdjustment") },
                { value: "INTERNAL_SALE", label: t("txInternalSale") },
                { value: "INTERNAL_PURCHASE", label: t("txInternalPurchase") },
              ]}
            />
            <Select
              name="direction"
              label={t("direction")}
              required
              options={[
                { value: "INFLOW", label: t("directionIn") },
                { value: "OUTFLOW", label: t("directionOut") },
              ]}
            />
            <Input name="amount" label={t("amount")} required />
            <Input name="currency" label={t("currency")} defaultValue="SAR" />
            <div className="md:col-span-2">
              <Textarea name="description" label={t("descriptionLabel")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("register")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {transactions.length === 0 ? (
          <EmptyState message={t("emptyTransactions")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("direction")}</th>
                  <th className="px-2 py-2 font-medium">{t("amount")}</th>
                  <th className="px-2 py-2 font-medium">{t("descriptionLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{formatDate(row.occurredAt)}</td>
                    <td className="px-2 py-2">{row.transactionType}</td>
                    <td className="px-2 py-2">{row.direction}</td>
                    <td className="px-2 py-2 font-medium">
                      {formatMoney(row.amount, row.currency)}
                    </td>
                    <td className="px-2 py-2">{row.description ?? "—"}</td>
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
