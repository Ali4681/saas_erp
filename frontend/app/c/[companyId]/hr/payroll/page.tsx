import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createPayrollRun, setPayrollStatus } from "../actions";

type PayrollRun = {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  items?: Array<{
    id: string;
    employeeId: string;
    grossPay: string;
    netPay: string;
  }>;
};

type Employee = { id: string; fullName: string };

export default async function PayrollPage({
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

  const [runs, employees] = await Promise.all([
    apiServer<PayrollRun[]>(`/companies/${companyId}/hr/payroll-runs`, {
      companyId,
    }).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const empName = new Map(employees.map((e) => [e.id, e.fullName]));
  const create = createPayrollRun.bind(null, companyId);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("payrollTitle")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newPayroll")}
          triggerLabel={t("addPayroll")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-3">
            <Input
              name="periodStart"
              label={t("periodStart")}
              type="date"
              defaultValue={start}
              required
            />
            <Input
              name="periodEnd"
              label={t("periodEnd")}
              type="date"
              defaultValue={end}
              required
            />
            <div className="flex items-end">
              <Button type="submit">{t("calculatePayroll")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      {runs.length === 0 ? (
        <Card>
          <EmptyState message={t("emptyPayroll")} />
        </Card>
      ) : (
        runs.map((run) => (
          <Card
            key={run.id}
            title={`${formatDate(run.periodStart)} → ${formatDate(run.periodEnd)}`}
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={run.status} />
              {canWrite && run.status === "CALCULATED" ? (
                <ActionForm
                  label={t("approve")}
                  action={setPayrollStatus.bind(
                    null,
                    companyId,
                    run.id,
                    "APPROVED",
                  )}
                />
              ) : null}
              {canWrite && run.status === "APPROVED" ? (
                <ActionForm
                  label={t("payout")}
                  variant="primary"
                  action={setPayrollStatus.bind(
                    null,
                    companyId,
                    run.id,
                    "PAID",
                  )}
                />
              ) : null}
            </div>
            {!run.items?.length ? (
              <EmptyState message={t("emptyLines")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                      <th className="px-2 py-2 font-medium">{t("employee")}</th>
                      <th className="px-2 py-2 font-medium">{t("gross")}</th>
                      <th className="px-2 py-2 font-medium">{t("net")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        <td className="px-2 py-2">
                          {empName.get(item.employeeId) ?? item.employeeId}
                        </td>
                        <td className="px-2 py-2">
                          {formatMoney(item.grossPay)}
                        </td>
                        <td className="px-2 py-2 font-medium">
                          {formatMoney(item.netPay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
