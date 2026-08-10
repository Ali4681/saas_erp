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
import { createBankAccount } from "../actions";

type Account = {
  id: string;
  name: string;
  accountType: string;
  bankName: string | null;
  iban: string | null;
  currency: string;
  status: string;
};

export default async function AccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const session = await getSession();
  const canWrite = can(session?.user, "finance.write");

  const accounts = await apiServer<Account[]>(
    `/companies/${companyId}/finance/bank-accounts`,
    { companyId },
  ).catch(() => []);

  const create = createBankAccount.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("accountsTitle")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newAccount")}
          triggerLabel={t("addAccount")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Select
              name="accountType"
              label={t("type")}
              required
              options={[
                { value: "CASH", label: t("accountCash") },
                { value: "BANK", label: t("accountBank") },
                { value: "PAYMENT_GATEWAY", label: t("accountGateway") },
              ]}
            />
            <Input name="bankName" label={t("bankName")} />
            <Input name="iban" label="IBAN" />
            <Input name="currency" label={t("currency")} defaultValue="SAR" />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {accounts.length === 0 ? (
          <EmptyState message={t("emptyAccounts")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("bank")}</th>
                  <th className="px-2 py-2 font-medium">{t("currency")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{a.name}</td>
                    <td className="px-2 py-2">{a.accountType}</td>
                    <td className="px-2 py-2">{a.bankName ?? "—"}</td>
                    <td className="px-2 py-2">{a.currency}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={a.status} />
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
