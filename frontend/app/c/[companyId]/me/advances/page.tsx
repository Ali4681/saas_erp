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
import { requestMyAdvance } from "../../hr/actions";

export default async function EmployeeAdvancesPage({
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
  const requestAdvance = requestMyAdvance.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader title={tPortal("advances")} description={t("advanceCapHint")} />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <>
          {me.advanceEarnings ? (
            <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("earnedThisMonth")} ({me.advanceEarnings.month})
                </p>
                <p className="font-semibold">
                  {formatMoney(me.advanceEarnings.earnedAmount, "SAR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("daysWorked")}
                </p>
                <p className="font-semibold">{me.advanceEarnings.daysWorked}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("maxAdvanceAmount")}
                </p>
                <p className="font-semibold">
                  {formatMoney(me.advanceEarnings.maxAdvanceAmount, "SAR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("remainingAdvance")}
                </p>
                <p className="font-semibold">
                  {formatMoney(me.advanceEarnings.remainingAdvance, "SAR")}
                </p>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("requestAdvance")}</h2>
            <form
              action={requestAdvance}
              className="mb-6 grid gap-3 md:grid-cols-2"
            >
              <Input name="amount" label={t("amount")} required />
              <div className="md:col-span-2">
                <Textarea name="reason" label={t("reason")} required />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("submit")}</Button>
              </div>
            </form>
            <h3 className="mb-3 text-sm font-semibold">{t("myAdvances")}</h3>
            {!me.salaryAdvances?.length ? (
              <EmptyState message={t("emptyAdvances")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("amount")}</th>
                      <th className="px-2 py-2 font-medium">{t("date")}</th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.salaryAdvances.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">
                          {formatMoney(a.amount, a.currency)}
                        </td>
                        <td className="px-2 py-2">
                          {formatDate(a.requestedAt)}
                        </td>
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
        </>
      )}
    </div>
  );
}
