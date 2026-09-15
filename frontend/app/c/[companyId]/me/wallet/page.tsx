import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { fetchMyProfile } from "@/lib/hr/my-profile";
import { getFormatters } from "@/lib/format-server";
import { requestMyWalletWithdrawal } from "../../hr/actions";

export default async function EmployeeWalletPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const tPortal = await getTranslations("employeePortal");
  const { formatDate, formatMoney } = await getFormatters();
  const me = await fetchMyProfile(companyId);
  const requestWithdrawal = requestMyWalletWithdrawal.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={tPortal("walletWithdrawTitle")}
        description={tPortal("walletWithdrawDesc")}
      />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <>
          {me.ewallet ? (
            <Card className="grid gap-2 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {tPortal("walletBalance")}
                </p>
                <p className="text-xl font-bold">
                  {formatMoney(me.ewallet.balance, me.ewallet.currency)}
                </p>
              </div>
              {me.ewallet.walletCode ? (
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {tPortal("walletCode")}
                  </p>
                  <p className="font-mono text-sm">{me.ewallet.walletCode}</p>
                </div>
              ) : null}
            </Card>
          ) : (
            <Card>
              <EmptyState message={tPortal("walletEmpty")} />
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              {tPortal("walletWithdrawRequest")}
            </h2>
            <form
              action={requestWithdrawal}
              className="mb-6 grid gap-3 md:grid-cols-2"
            >
              <Input name="amount" label={t("amount")} required />
              <div className="md:col-span-2">
                <Textarea name="reason" label={t("reason")} />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={!me.ewallet}>
                  {t("submit")}
                </Button>
              </div>
            </form>

            <h3 className="mb-3 text-sm font-semibold">
              {tPortal("walletWithdrawHistory")}
            </h3>
            {!me.walletWithdrawals?.length ? (
              <EmptyState message={tPortal("walletWithdrawEmpty")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("amount")}</th>
                      <th className="px-2 py-2 font-medium">{t("date")}</th>
                      <th className="px-2 py-2 font-medium">{t("reason")}</th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.walletWithdrawals.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">
                          {formatMoney(row.amount, row.currency)}
                        </td>
                        <td className="px-2 py-2">
                          {formatDate(row.requestedAt)}
                        </td>
                        <td className="px-2 py-2">{row.reason ?? "—"}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
