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
import { fetchLocalesLookup, lookupSelectOptions } from "@/lib/lookups";
import { upsertPurchaseOperatorEwallet } from "../actions";

type Employee = { id: string; fullName: string; employeeNumber: string };
type Operator = {
  id: string;
  fullName: string;
  employeeNumber: string;
  email: string | null;
  employmentStatus: string;
  ewallet?: {
    id: string;
    walletCode: string;
    balance: string;
    currency: string;
    status: string;
  } | null;
};

export default async function PurchaseOperatorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("purchasing");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "purchasing.write");

  const [operators, employees, locales] = await Promise.all([
    apiServer<Operator[]>(`/companies/${companyId}/hr/purchase-operators`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
    fetchLocalesLookup(companyId),
  ]);

  const upsert = upsertPurchaseOperatorEwallet.bind(null, companyId);
  const currencyOptions = lookupSelectOptions(locales.currencies);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("operators.title")}
        description={t("operators.description")}
        actions={
          <Button href={`/c/${companyId}/purchasing`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("operators.add")}
          triggerLabel={t("operators.add")}
        >
          <form action={upsert} className="grid gap-3 md:grid-cols-2">
            <Select
              name="employeeId"
              label={t("operators.employee")}
              required
              placeholder={t("optional")}
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employeeNumber} — ${e.fullName}`,
              }))}
            />
            <Input name="walletCode" label={t("operators.walletCode")} />
            <Input
              name="balance"
              label={t("operators.balance")}
              defaultValue="0"
            />
            <Select
              name="currency"
              label={t("operators.currency")}
              defaultValue={locales.defaults.currency}
              options={currencyOptions}
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("operators.save")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {operators.length === 0 ? (
          <EmptyState message={t("operators.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("operators.wallet")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("operators.balance")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr
                    key={op.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">
                      {op.employeeNumber}
                    </td>
                    <td className="px-2 py-2">
                      <p className="font-medium">{op.fullName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {op.email ?? ""}
                      </p>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {op.ewallet?.walletCode ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {op.ewallet
                        ? formatMoney(op.ewallet.balance, op.ewallet.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge
                        status={op.ewallet?.status ?? op.employmentStatus}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite ? (
                        <CreateFormDialog
                          title={t("operators.edit")}
                          triggerLabel={t("operators.edit")}
                          triggerVariant="outline"
                          showPlus={false}
                        >
                          <form
                            action={upsert}
                            className="grid gap-3 md:grid-cols-2"
                          >
                            <input type="hidden" name="employeeId" value={op.id} />
                            <Input
                              name="walletCode"
                              label={t("operators.walletCode")}
                              defaultValue={op.ewallet?.walletCode ?? ""}
                            />
                            <Input
                              name="balance"
                              label={t("operators.balance")}
                              defaultValue={op.ewallet?.balance ?? "0"}
                            />
                            <Select
                              name="currency"
                              label={t("operators.currency")}
                              defaultValue={
                                op.ewallet?.currency ??
                                locales.defaults.currency
                              }
                              options={currencyOptions}
                            />
                            <div className="md:col-span-2">
                              <Button type="submit">
                                {t("operators.save")}
                              </Button>
                            </div>
                          </form>
                        </CreateFormDialog>
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
