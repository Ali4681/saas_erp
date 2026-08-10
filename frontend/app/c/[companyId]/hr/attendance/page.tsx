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
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createAttendance } from "../actions";

type Employee = { id: string; fullName: string; employeeNumber: string };
type Attendance = {
  id: string;
  attendanceDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  notes: string | null;
  employee?: { fullName: string } | null;
};

export default async function AttendancePage({
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

  const [rows, employees] = await Promise.all([
    apiServer<Attendance[]>(`/companies/${companyId}/hr/attendance`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createAttendance.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("attendanceTitle")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("recordAttendance")}
          triggerLabel={t("recordAttendance")}
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
            <Input
              name="attendanceDate"
              label={t("date")}
              type="date"
              defaultValue={today}
              required
            />
            <Select
              name="status"
              label={t("status")}
              required
              options={[
                { value: "PRESENT", label: t("present") },
                { value: "ABSENT", label: t("absent") },
                { value: "LATE", label: t("late") },
                { value: "LEAVE", label: t("onLeave") },
                { value: "REMOTE", label: t("remote") },
                { value: "HOLIDAY", label: t("holiday") },
              ]}
            />
            <Input name="checkInAt" label={t("checkIn")} type="datetime-local" />
            <Input
              name="checkOutAt"
              label={t("checkOut")}
              type="datetime-local"
            />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("notes")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {rows.length === 0 ? (
          <EmptyState message={t("emptyAttendance")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("employee")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("notes")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{formatDate(r.attendanceDate)}</td>
                    <td className="px-2 py-2">{r.employee?.fullName ?? "—"}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2">{r.notes ?? "—"}</td>
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
