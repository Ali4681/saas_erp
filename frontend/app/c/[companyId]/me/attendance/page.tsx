import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fetchMyProfile, fetchMyReport } from "@/lib/hr/my-profile";
import { getFormatters } from "@/lib/format-server";

function defaultReportRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

function formatClockTime(
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EmployeeAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const defaults = defaultReportRange();
  const from = flash.from ?? defaults.from;
  const to = flash.to ?? defaults.to;
  const loadReport = Boolean(flash.from && flash.to);

  const t = await getTranslations("employeePortal");
  const tHr = await getTranslations("hr");
  const { formatDate, locale } = await getFormatters();
  const [me, report] = await Promise.all([
    fetchMyProfile(companyId),
    loadReport
      ? fetchMyReport(companyId, from, to)
      : Promise.resolve(null),
  ]);

  const attendance = report?.attendance ?? [];
  const summary = attendance.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-5">
      <PageHeader title={t("attendanceTitle")} description={t("attendanceDesc")} />

      {!me ? (
        <Card>
          <EmptyState message={tHr("meNoProfile")} />
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("attendanceShifts")}</h2>
            {!me.shiftAssignments?.length ? (
              <EmptyState message={t("noShifts")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{tHr("shift")}</th>
                      <th className="px-2 py-2 font-medium">{t("shiftPeriod")}</th>
                      <th className="px-2 py-2 font-medium">{t("shiftHours")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.shiftAssignments.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">{row.shift?.name ?? "—"}</td>
                        <td className="px-2 py-2">
                          {formatDate(row.effectiveFrom)}
                          {row.effectiveTo ? ` → ${formatDate(row.effectiveTo)}` : ""}
                        </td>
                        <td className="px-2 py-2">
                          {row.shift?.startTime && row.shift?.endTime
                            ? `${row.shift.startTime} – ${row.shift.endTime}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-4">
            <h2 className="text-sm font-semibold">{t("attendanceReport")}</h2>
            <form
              action={`/c/${companyId}/me/attendance`}
              method="get"
              className="grid gap-3 sm:grid-cols-3"
            >
              <Input
                name="from"
                label={tHr("reportFrom")}
                type="date"
                defaultValue={from}
                required
              />
              <Input
                name="to"
                label={tHr("reportTo")}
                type="date"
                defaultValue={to}
                required
              />
              <div className="flex items-end">
                <Button type="submit">{tHr("loadReport")}</Button>
              </div>
            </form>

            {loadReport && report ? (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-[var(--muted)] px-3 py-1">
                    {tHr("present")}: {summary.PRESENT ?? 0}
                  </span>
                  <span className="rounded-full bg-[var(--muted)] px-3 py-1">
                    {tHr("absent")}: {summary.ABSENT ?? 0}
                  </span>
                  <span className="rounded-full bg-[var(--muted)] px-3 py-1">
                    {tHr("late")}: {summary.LATE ?? 0}
                  </span>
                  <span className="rounded-full bg-[var(--muted)] px-3 py-1">
                    {tHr("onLeave")}: {summary.LEAVE ?? 0}
                  </span>
                  <span className="rounded-full bg-[var(--muted)] px-3 py-1">
                    {tHr("remote")}: {summary.REMOTE ?? 0}
                  </span>
                </div>

                {attendance.length === 0 ? (
                  <EmptyState message={t("noAttendanceInRange")} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                          <th className="px-2 py-2 font-medium">{tHr("date")}</th>
                          <th className="px-2 py-2 font-medium">{tHr("status")}</th>
                          <th className="px-2 py-2 font-medium">{tHr("checkIn")}</th>
                          <th className="px-2 py-2 font-medium">{tHr("checkOut")}</th>
                          <th className="px-2 py-2 font-medium">{t("workedMinutes")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-[var(--border)] last:border-0"
                          >
                            <td className="px-2 py-2">
                              {formatDate(row.attendanceDate)}
                            </td>
                            <td className="px-2 py-2">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-2 py-2">
                              {formatClockTime(row.checkInAt, locale)}
                            </td>
                            <td className="px-2 py-2">
                              {formatClockTime(row.checkOutAt, locale)}
                            </td>
                            <td className="px-2 py-2">
                              {row.workedMinutes ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : loadReport ? (
              <EmptyState message={tHr("emptyReport")} />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                {tHr("reportPickRange")}
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
