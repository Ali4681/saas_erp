import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { LeaveDaysAutoField } from "@/components/erp/LeaveDaysAutoField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { fetchMyProfile } from "@/lib/hr/my-profile";
import { getFormatters } from "@/lib/format-server";
import { requestMyLeave } from "../../hr/actions";

export default async function EmployeeLeavesPage({
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
  const { formatDate } = await getFormatters();
  const me = await fetchMyProfile(companyId);
  const requestLeave = requestMyLeave.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader title={tPortal("leaves")} />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">{t("requestLeave")}</h2>
          <form action={requestLeave} className="mb-6 grid gap-3 md:grid-cols-2">
            <Select
              name="leaveType"
              label={t("type")}
              required
              defaultValue="ANNUAL"
              showPlaceholderOption={false}
              options={[
                { value: "ANNUAL", label: t("leaveAnnual") },
                { value: "SICK", label: t("leaveSick") },
                { value: "UNPAID", label: t("leaveUnpaid") },
                { value: "EMERGENCY", label: t("leaveEmergency") },
                { value: "OTHER", label: t("leaveOther") },
              ]}
            />
            <LeaveDaysAutoField
              labels={{
                from: t("from"),
                to: t("to"),
                days: t("days"),
              }}
            />
            <div className="md:col-span-2">
              <Textarea name="reason" label={t("reason")} required />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
          <h3 className="mb-3 text-sm font-semibold">{t("myLeaves")}</h3>
          {!me.leaveRequests?.length ? (
            <EmptyState message={t("emptyLeaves")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                    <th className="px-2 py-2 font-medium">{t("type")}</th>
                    <th className="px-2 py-2 font-medium">{t("period")}</th>
                    <th className="px-2 py-2 font-medium">{t("daysCol")}</th>
                    <th className="px-2 py-2 font-medium">{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {me.leaveRequests.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-2 py-2">{l.leaveType}</td>
                      <td className="px-2 py-2">
                        {formatDate(l.startsOn)} → {formatDate(l.endsOn)}
                      </td>
                      <td className="px-2 py-2">{l.requestedDays}</td>
                      <td className="px-2 py-2">
                        <StatusBadge status={l.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
