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
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createLeave, decideLeave } from "../actions";

type Employee = { id: string; fullName: string; employeeNumber: string };
type Leave = {
  id: string;
  leaveType: string;
  status: string;
  startsOn: string;
  endsOn: string;
  requestedDays: string | number;
  reason: string | null;
  employee?: { fullName: string } | null;
};

export default async function LeavesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  const [leaves, employees] = await Promise.all([
    apiServer<Leave[]>(`/companies/${companyId}/hr/leaves`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createLeave.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("leavesTitle")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("leaveRequest")}
          triggerLabel={t("leaveRequest")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="employeeId"
              label={t("employee")}
              required
              placeholder={t("selectPlaceholder")}
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employeeNumber} — ${e.fullName}`,
              }))}
            />
            <Select
              name="leaveType"
              label={t("type")}
              required
              options={[
                { value: "ANNUAL", label: t("leaveAnnual") },
                { value: "SICK", label: t("leaveSick") },
                { value: "UNPAID", label: t("leaveUnpaid") },
                { value: "EMERGENCY", label: t("leaveEmergency") },
                { value: "OTHER", label: t("leaveOther") },
              ]}
            />
            <Input name="startsOn" label={t("from")} type="date" required />
            <Input name="endsOn" label={t("to")} type="date" required />
            <Input
              name="requestedDays"
              label={t("days")}
              required
              defaultValue="1"
            />
            <div className="md:col-span-2">
              <Textarea name="reason" label={t("reason")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("submit")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {leaves.length === 0 ? (
          <EmptyState message={t("emptyLeaves")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("employee")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("period")}</th>
                  <th className="px-2 py-2 font-medium">{t("daysCol")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{l.employee?.fullName ?? "—"}</td>
                    <td className="px-2 py-2">{l.leaveType}</td>
                    <td className="px-2 py-2">
                      {formatDate(l.startsOn)} → {formatDate(l.endsOn)}
                    </td>
                    <td className="px-2 py-2">{l.requestedDays}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && l.status === "PENDING" ? (
                        <div className="flex flex-wrap gap-1">
                          <ActionForm
                            label={t("approve")}
                            variant="primary"
                            action={decideLeave.bind(
                              null,
                              companyId,
                              l.id,
                              "APPROVED",
                            )}
                          />
                          <ActionForm
                            label={t("reject")}
                            variant="danger"
                            action={decideLeave.bind(
                              null,
                              companyId,
                              l.id,
                              "REJECTED",
                            )}
                          />
                        </div>
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
