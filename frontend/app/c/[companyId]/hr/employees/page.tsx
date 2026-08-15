import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
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
import { createEmployee, updateEmployeeCompensation } from "../actions";

type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentStatus: string;
  basicSalary: string | null;
  salesTargetMode?: string | null;
  salesTargetAmount?: string | null;
  targetPercent: string | null;
  lateDiscountAmount?: string | null;
  identityNumber?: string | null;
  identityExpiresOn?: string | null;
  approvalStatus?: string | null;
  qiwaContractUrl?: string | null;
  qiwaContractRef?: string | null;
  qiwaStatus?: string | null;
  advanceAllowanceMonthly?: string | null;
  advanceAllowanceMonth?: string | null;
  advanceAllowancePercent?: string | null;
  attendanceBadgeId?: string | null;
  hasInsurance?: boolean;
  currency: string;
};
type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
};
type HrSummary = {
  total: number;
  active: number;
  onLeave: number;
  suspended: number;
  terminated: number;
  qiwa?: {
    NOT_STARTED: number;
    IN_PROGRESS: number;
    AWAITING_EMPLOYEE: number;
    PENDING_APPROVAL: number;
    DOCUMENTED: number;
    REJECTED_OR_MODIFICATION: number;
  };
};

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  const [employees, attachments, summary] = await Promise.all([
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
    apiServer<Attachment[]>(
      `/companies/${companyId}/attachments?entityType=employee`,
      { companyId },
    ).catch(() => []),
    apiServer<HrSummary>(`/companies/${companyId}/hr/summary`, {
      companyId,
    }).catch(() => null),
  ]);

  const cvByEmployee = new Map<string, Attachment>();
  for (const a of attachments) {
    if (!cvByEmployee.has(a.entityId)) {
      cvByEmployee.set(a.entityId, a);
    }
  }

  const nextEmployeeNumber = suggestNextEmployeeNumber(employees);
  const create = createEmployee.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("employeesTitle")}
        description={t("employeesDesc")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("summaryTotal")}
            </p>
            <p className="mt-1 text-lg font-semibold">{summary.total}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("summaryActive")}
            </p>
            <p className="mt-1 text-lg font-semibold">{summary.active}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("onLeave")}
            </p>
            <p className="mt-1 text-lg font-semibold">{summary.onLeave}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("summarySuspended")}
            </p>
            <p className="mt-1 text-lg font-semibold">{summary.suspended}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("summaryTerminated")}
            </p>
            <p className="mt-1 text-lg font-semibold">{summary.terminated}</p>
          </Card>
        </div>
      ) : null}

      {summary?.qiwa ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusNotStarted")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {summary.qiwa.NOT_STARTED}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusInProgress")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {summary.qiwa.IN_PROGRESS}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusAwaitingEmployee")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {summary.qiwa.AWAITING_EMPLOYEE}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusPendingApproval")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {summary.qiwa.PENDING_APPROVAL}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusDocumented")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {summary.qiwa.DOCUMENTED}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusRejected")}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {summary.qiwa.REJECTED_OR_MODIFICATION}
            </p>
          </Card>
        </div>
      ) : null}

      {canWrite ? (
        <CreateFormDialog
          title={t("newEmployee")}
          description={t("newEmployeeDesc")}
          triggerLabel={t("addEmployee")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input
              name="employeeNumber"
              label={t("employeeNumber")}
              required
              defaultValue={nextEmployeeNumber}
            />
            <Input name="fullName" label={t("fullName")} required />
            <Input name="email" label={t("email")} type="email" />
            <Input name="phone" label={t("phone")} />
            <Input name="jobTitle" label={t("jobTitle")} />
            <Input name="hireDate" label={t("hireDate")} type="date" />
            <Input name="basicSalary" label={`${t("basicSalary")} (SAR)`} />
            <Select
              name="salesTargetMode"
              label={t("salesTargetMode")}
              defaultValue="AMOUNT"
              options={[
                { value: "AMOUNT", label: t("salesTargetModeAmount") },
                { value: "PERCENT", label: t("salesTargetModePercent") },
                { value: "BOTH", label: t("salesTargetModeBoth") },
              ]}
            />
            <Input
              name="salesTargetAmount"
              label={`${t("salesTargetAmount")} (SAR)`}
            />
            <Input
              name="targetPercent"
              label={t("salesCommissionPercent")}
              placeholder="e.g. 5"
            />
            <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
              {t("salesIncentiveHint")}
            </p>
            <Select
              name="approvalStatus"
              label={t("qiwaVerifiedStatus")}
              defaultValue="PENDING"
              options={[
                { value: "PENDING", label: t("qiwaNotVerified") },
                { value: "APPROVED", label: t("qiwaVerified") },
              ]}
            />
            <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
              {t("qiwaVerifiedHint")}
            </p>
            <Select
              name="identityType"
              label={t("identityType")}
              required
              options={[
                { value: "RESIDENT", label: t("identityResident") },
                { value: "CITIZEN", label: t("identityCitizen") },
              ]}
            />
            <div>
              <Input
                name="identityNumber"
                label={t("identityNumber")}
                required
                inputMode="numeric"
                pattern="[12][0-9]{9}"
                maxLength={10}
                placeholder={t("identityNumberPlaceholder")}
              />
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                {t("identityNumberHint")}
              </p>
            </div>
            <Input
              name="identityExpiresOn"
              label={t("identityExpiresOn")}
              type="date"
              required
            />
            <div>
              <Input
                name="iban"
                label={t("iban")}
                placeholder="SA0380000000608010167519"
                autoComplete="off"
                spellCheck={false}
                pattern="SA[0-9]{22}"
                maxLength={34}
              />
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                {t("ibanOptionalHint")}
              </p>
            </div>
            <Input
              name="advanceAllowancePercent"
              label={t("advanceAllowancePercent")}
              placeholder="e.g. 30"
            />
            <Input
              name="attendanceBadgeId"
              label={t("attendanceBadgeId")}
              placeholder={t("attendanceBadgeHint")}
            />
            <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
              {t("advanceAllowanceHint")}
            </p>
            <input type="hidden" name="currency" value="SAR" />
            <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
              <span className="font-medium text-[var(--foreground)]">
                {t("insuranceCertificate")}
              </span>
              <input
                type="file"
                name="insurance"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf"
                className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] shadow-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
              <span className="font-medium text-[var(--foreground)]">
                {t("cvLabel")}
              </span>
              <input
                type="file"
                name="cv"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf"
                className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] shadow-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              <span className="text-xs text-[var(--muted-foreground)]">
                {t("cvFormats")}
              </span>
            </label>
            <div className="md:col-span-2">
              <Button type="submit">{t("createEmployee")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {employees.length === 0 ? (
          <EmptyState message={t("emptyEmployees")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("titleCol")}</th>
                  <th className="px-2 py-2 font-medium">{t("salary")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("salesTargetAmount")}
                  </th>
                  <th className="px-2 py-2 font-medium">
                    {t("identityNumber")}
                  </th>
                  <th className="px-2 py-2 font-medium">
                    {t("qiwaEmploymentContract")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("cv")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const cv = cvByEmployee.get(e.id);
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-2 py-2 font-mono text-xs">
                        {e.employeeNumber}
                      </td>
                      <td className="px-2 py-2">
                        <p className="font-medium">{e.fullName}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {e.email ?? ""}
                        </p>
                      </td>
                      <td className="px-2 py-2">{e.jobTitle ?? "—"}</td>
                      <td className="px-2 py-2">
                        {formatMoney(e.basicSalary, e.currency)}
                      </td>
                      <td className="px-2 py-2">
                        {formatMoney(e.salesTargetAmount, "SAR")}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {e.identityNumber ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge
                          status={e.qiwaStatus ?? "NOT_STARTED"}
                          label={
                            e.qiwaStatus === "IN_PROGRESS"
                              ? t("qiwaStatusInProgress")
                              : e.qiwaStatus === "AWAITING_EMPLOYEE"
                                ? t("qiwaStatusAwaitingEmployee")
                                : e.qiwaStatus === "PENDING_APPROVAL"
                                  ? t("qiwaStatusPendingApproval")
                                  : e.qiwaStatus === "DOCUMENTED"
                                    ? t("qiwaStatusDocumented")
                                    : e.qiwaStatus === "REJECTED_OR_MODIFICATION"
                                      ? t("qiwaStatusRejected")
                                      : t("qiwaStatusNotStarted")
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={e.employmentStatus} />
                      </td>
                      <td className="px-2 py-2">
                        {cv ? (
                          <a
                            href={`/api/attachments/${cv.id}?companyId=${companyId}`}
                            className="inline-flex items-center gap-1 text-[var(--primary)] underline-offset-2 hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {cv.fileName}
                          </a>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            href={`/c/${companyId}/hr/employees/${e.id}`}
                            variant="outline"
                            className="!px-2 !py-1 text-xs"
                          >
                            {t("viewEmployee")}
                          </Button>
                          {canWrite ? (
                            <CreateFormDialog
                              title={`Compensation — ${e.fullName}`}
                              triggerLabel="Edit"
                              triggerVariant="outline"
                              showPlus={false}
                              className="!px-2 !py-1 text-xs"
                            >
                              <form
                                action={updateEmployeeCompensation.bind(
                                  null,
                                  companyId,
                                  e.id,
                                )}
                                className="grid gap-3 md:grid-cols-2"
                              >
                                <Input
                                  name="basicSalary"
                                  label={`${t("basicSalary")} (SAR)`}
                                  defaultValue={e.basicSalary ?? ""}
                                />
                                <Select
                                  name="salesTargetMode"
                                  label={t("salesTargetMode")}
                                  defaultValue={e.salesTargetMode ?? "AMOUNT"}
                                  options={[
                                    {
                                      value: "AMOUNT",
                                      label: t("salesTargetModeAmount"),
                                    },
                                    {
                                      value: "PERCENT",
                                      label: t("salesTargetModePercent"),
                                    },
                                    {
                                      value: "BOTH",
                                      label: t("salesTargetModeBoth"),
                                    },
                                  ]}
                                />
                                <Input
                                  name="salesTargetAmount"
                                  label={`${t("salesTargetAmount")} (SAR)`}
                                  defaultValue={e.salesTargetAmount ?? ""}
                                />
                                <Input
                                  name="targetPercent"
                                  label={t("salesCommissionPercent")}
                                  defaultValue={e.targetPercent ?? ""}
                                />
                                <Input
                                  name="lateDiscountAmount"
                                  label={`${t("lateDiscountAmount")} (SAR)`}
                                  defaultValue={
                                    e.lateDiscountAmount ??
                                    (e.basicSalary
                                      ? (Number(e.basicSalary) / 30).toFixed(2)
                                      : "")
                                  }
                                />
                                <Select
                                  name="approvalStatus"
                                  label={t("qiwaVerifiedStatus")}
                                  defaultValue={e.approvalStatus ?? "PENDING"}
                                  options={[
                                    {
                                      value: "PENDING",
                                      label: t("qiwaNotVerified"),
                                    },
                                    {
                                      value: "APPROVED",
                                      label: t("qiwaVerified"),
                                    },
                                  ]}
                                />
                                <Input
                                  name="identityNumber"
                                  label={t("identityNumber")}
                                  defaultValue={e.identityNumber ?? ""}
                                />
                                <Input
                                  name="identityExpiresOn"
                                  label={t("identityExpiresOn")}
                                  type="date"
                                  defaultValue={e.identityExpiresOn ?? ""}
                                />
                                <Input
                                  name="advanceAllowancePercent"
                                  label={t("advanceAllowancePercent")}
                                  defaultValue={
                                    e.advanceAllowancePercent ?? ""
                                  }
                                />
                                <Input
                                  name="attendanceBadgeId"
                                  label={t("attendanceBadgeId")}
                                  defaultValue={e.attendanceBadgeId ?? ""}
                                />
                                <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
                                  {t("advanceAllowanceHint")}
                                </p>
                                <Input
                                  name="phone"
                                  label={t("phone")}
                                  defaultValue={e.phone ?? ""}
                                />
                                <Input
                                  name="email"
                                  label={t("email")}
                                  type="email"
                                  defaultValue={e.email ?? ""}
                                />
                                <Input
                                  name="jobTitle"
                                  label={t("jobTitle")}
                                  defaultValue={e.jobTitle ?? ""}
                                  className="md:col-span-2"
                                />
                                <div className="md:col-span-2">
                                  <Button type="submit">{t("save")}</Button>
                                </div>
                              </form>
                            </CreateFormDialog>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Next EMP-### from existing numbers (seed style); falls back to EMP-001. */
function suggestNextEmployeeNumber(
  employees: Array<{ employeeNumber: string }>,
): string {
  let max = 0;
  for (const e of employees) {
    const match = /^EMP-(\d+)$/i.exec(e.employeeNumber.trim());
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}
