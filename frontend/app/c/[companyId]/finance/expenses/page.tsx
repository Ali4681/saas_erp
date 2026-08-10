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
import { createExpense, setExpenseStatus } from "../actions";

type Category = { id: string; name: string };
type Account = { id: string; name: string };
type Expense = {
  id: string;
  description: string;
  amount: string;
  currency: string;
  expenseDate: string;
  status: string;
  category?: { name: string } | null;
  expenseCategory?: { name: string } | null;
};

export default async function ExpensesPage({
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

  const [expenses, categories, accounts] = await Promise.all([
    apiServer<Expense[]>(`/companies/${companyId}/finance/expenses`, {
      companyId,
    }).catch(() => []),
    apiServer<Category[]>(`/companies/${companyId}/finance/expense-categories`, {
      companyId,
    }).catch(() => []),
    apiServer<Account[]>(`/companies/${companyId}/finance/bank-accounts`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createExpense.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("expensesTitle")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newExpense")}
          triggerLabel={t("addExpense")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="expenseCategoryId"
              label={t("category")}
              required
              placeholder={t("selectPlaceholder")}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input
              name="expenseDate"
              label={t("date")}
              type="date"
              defaultValue={today}
              required
            />
            <Input
              name="description"
              label={t("descriptionLabel")}
              required
              className="md:col-span-2"
            />
            <Input name="amount" label={t("amount")} required />
            <Select
              name="status"
              label={t("status")}
              options={[
                { value: "APPROVED", label: t("expenseApproved") },
                { value: "DRAFT", label: t("expenseDraft") },
                { value: "PAID", label: t("expensePaid") },
              ]}
            />
            <Select
              name="bankAccountId"
              label={t("account")}
              placeholder={t("optional")}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
            <Input name="referenceNumber" label={t("reference")} />
            <div className="md:col-span-2">
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {expenses.length === 0 ? (
          <EmptyState message={t("emptyExpenses")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("descriptionLabel")}</th>
                  <th className="px-2 py-2 font-medium">{t("category")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("amount")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{e.description}</td>
                    <td className="px-2 py-2">
                      {e.expenseCategory?.name ?? e.category?.name ?? "—"}
                    </td>
                    <td className="px-2 py-2">{formatDate(e.expenseDate)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(e.amount, e.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && e.status === "DRAFT" ? (
                        <ActionForm
                          label={t("approve")}
                          action={setExpenseStatus.bind(
                            null,
                            companyId,
                            e.id,
                            "APPROVED",
                          )}
                        />
                      ) : canWrite && e.status === "APPROVED" ? (
                        <ActionForm
                          label={t("pay")}
                          variant="primary"
                          action={setExpenseStatus.bind(
                            null,
                            companyId,
                            e.id,
                            "PAID",
                          )}
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
