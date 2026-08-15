import Link from "next/link";
import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
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
import { cn } from "@/lib/utils";
import {
  assignEmployeeShift,
  decideSalesSubmission,
  setEmployeeAdvanceAllowance,
  setEmployeeFinancialSettings,
  uploadEmployeeInsurance,
} from "../../actions";
import { AppLoginCredentials } from "../AppLoginCredentials";
import {
  QiwaContractSection,
  type QiwaContractView,
  type QiwaSummary,
} from "./QiwaContractSection";

type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
  isActive: boolean;
};

type Sale = {
  id: string;
  saleDate: string;
  amount: string;
  paymentMethod: string;
  status: string;
  notes?: string | null;
};

type ShiftAssignment = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  shift?: Shift | null;
};

type AdvanceEarnings = {
  month: string;
  basicSalary: string;
  dailyRate: string;
  daysWorked: number;
  earnedAmount: string;
  advanceAllowancePercent: string | null;
  maxAdvanceAmount: string;
  advancesUsed: string;
  remainingAdvance: string;
  currency: string;
};

type SalesProgress = {
  month: string;
  salesTargetMode?: string | null;
  salesTargetAmount: string | null;
  targetPercent?: string | null;
  approvedSalesSum: string;
  salesCommission?: string;
  targetCompletedPercent: string;
  overTarget: boolean;
  currency: string;
};

type EmployeeDetail = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  employmentStatus: string;
  basicSalary: string | null;
  salesTargetMode?: string | null;
  salesTargetAmount?: string | null;
  targetPercent?: string | null;
  targetCompletedPercent?: string | null;
  lateDiscountAmount?: string | null;
  absenceDiscountPerDay?: string | null;
  identityType?: string | null;
  identityNumber?: string | null;
  identityExpiresOn?: string | null;
  ibanLast4?: string | null;
  advanceAllowancePercent?: string | null;
  advanceAllowanceMonthly?: string | null;
  advanceAllowanceMonth?: string | null;
  attendanceBadgeId?: string | null;
  approvalStatus?: string | null;
  qiwaContractUrl?: string | null;
  qiwaContractRef?: string | null;
  insuranceAttachmentId?: string | null;
  hasInsurance?: boolean;
  hasIdentity?: boolean;
  hasIban?: boolean;
  hasQiwa?: boolean;
  profileComplete?: boolean;
  advanceEarnings?: AdvanceEarnings;
  salesProgress?: SalesProgress;
  ewallet?: { balance: string; currency: string; walletCode: string } | null;
  shiftAssignments?: ShiftAssignment[];
  salesSubmissions?: Sale[];
  currency: string;
};

type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
};

type PersonalReport = {
  leaves: unknown[];
  advances: unknown[];
  sales: Sale[];
  attendance: unknown[];
  targetProgress?: {
    salesTargetAmount?: string | null;
    approvedSalesSum?: string;
    computedPercent?: string | number | null;
    targetCompletedPercent?: string | null;
  };
};

const TABS = [
  "personal",
  "shifts",
  "financial",
  "targets",
  "reports",
] as const;

type Tab = (typeof TABS)[number];

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; employeeId: string }>;
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    ok?: string;
    error?: string;
    loginEmail?: string;
    loginPassword?: string;
  }>;
}) {
  const { companyId, employeeId } = await params;
  const flash = await searchParams;
  const tab = (TABS.includes(flash.tab as Tab) ? flash.tab : "personal") as Tab;
  const t = await getTranslations("hr");
  const tc = await getTranslations("common");
  const { formatMoney, formatDate } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");
  const canApproveCash = can(session?.user, "hr.sales_cash.approve");
  const canManageQiwa = can(session?.user, "hr.qiwa.manage");
  const canApproveQiwa = can(session?.user, "hr.qiwa.approve");
  const qiwaUrl =
    process.env.NEXT_PUBLIC_QIWA_URL?.trim() || "https://www.qiwa.sa/";

  const employee =
    (await apiServer<EmployeeDetail>(
      `/companies/${companyId}/hr/employees/${employeeId}`,
      { companyId },
    ).catch(() => null)) ?? null;

  const [insuranceFiles, shifts, report, qiwaContract, qiwaSummary] =
    await Promise.all([
      apiServer<Attachment[]>(
        `/companies/${companyId}/attachments?entityType=employee_insurance&entityId=${employeeId}`,
        { companyId },
      ).catch(() => []),
      apiServer<Shift[]>(`/companies/${companyId}/hr/shifts`, {
        companyId,
      }).catch(() => []),
      tab === "reports" && flash.from && flash.to
        ? apiServer<PersonalReport>(
            `/companies/${companyId}/hr/employees/${employeeId}/personal-report?from=${encodeURIComponent(flash.from)}&to=${encodeURIComponent(flash.to)}`,
            { companyId },
          ).catch(() => null)
        : Promise.resolve(null),
      apiServer<QiwaContractView>(
        `/companies/${companyId}/hr/employees/${employeeId}/qiwa-contract`,
        { companyId },
      ).catch(
        () =>
          ({
            id: null,
            employeeId,
            status: "NOT_STARTED",
            qiwaContractReference: null,
            contractAttachmentId: null,
            contractFile: null,
            startedAt: null,
            sentAt: null,
            documentedAt: null,
            rejectedAt: null,
            verifiedBy: null,
            lastUpdatedBy: null,
            notes: null,
            updatedAt: null,
          }) satisfies QiwaContractView,
      ),
      canManageQiwa
        ? apiServer<QiwaSummary>(
            `/companies/${companyId}/hr/employees/${employeeId}/qiwa-contract/summary`,
            { companyId },
          ).catch(() => null)
        : Promise.resolve(null),
    ]);

  const insurance =
    insuranceFiles[0] ??
    (employee?.insuranceAttachmentId
      ? ({
          id: employee.insuranceAttachmentId,
          entityType: "employee_insurance",
          entityId: employeeId,
          fileName: t("insuranceCertificate"),
        } satisfies Attachment)
      : null);

  const tabHref = (key: Tab) =>
    `/c/${companyId}/hr/employees/${employeeId}?tab=${key}`;

  if (!employee) {
    return (
      <div className="space-y-5">
        <PageHeader title={t("employeeDetail")} />
        <Card>
          <EmptyState message={t("emptyEmployees")} />
        </Card>
      </div>
    );
  }

  const qiwaDocumented = qiwaContract.status === "DOCUMENTED";
  const incompleteProfile = !(
    Boolean(employee.hasInsurance || insurance) &&
    Boolean(employee.hasIdentity ?? employee.identityNumber) &&
    Boolean(employee.hasIban ?? employee.ibanLast4)
  );
  const detailPath = `/c/${companyId}/hr/employees/${employeeId}?tab=targets`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={employee.fullName}
        description={`${employee.employeeNumber} · ${employee.jobTitle ?? "—"}`}
        actions={
          <Button href={`/c/${companyId}/hr/employees`} variant="secondary">
            {t("employeesTitle")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      {flash.loginEmail && flash.loginPassword ? (
        <AppLoginCredentials
          email={flash.loginEmail}
          password={flash.loginPassword}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          status={qiwaDocumented ? "DOCUMENTED" : qiwaContract.status}
          label={
            qiwaDocumented
              ? t("qiwaStatusDocumented")
              : qiwaContract.status === "IN_PROGRESS"
                ? t("qiwaStatusInProgress")
                : qiwaContract.status === "AWAITING_EMPLOYEE"
                  ? t("qiwaStatusAwaitingEmployee")
                  : qiwaContract.status === "PENDING_APPROVAL"
                    ? t("qiwaStatusPendingApproval")
                    : qiwaContract.status === "REJECTED_OR_MODIFICATION"
                      ? t("qiwaStatusRejected")
                      : t("qiwaStatusNotStarted")
          }
        />
        <span className="text-sm text-[var(--muted-foreground)]">
          {t("qiwaEmploymentContract")}
        </span>
      </div>

      {incompleteProfile ? (
        <Card className="border-[var(--destructive)]/40 bg-[var(--destructive)]/5 p-4 text-sm">
          {t("profileIncomplete")}
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {(
          [
            ["personal", t("tabPersonal")],
            ["shifts", t("tabShifts")],
            ["financial", t("tabFinancial")],
            ["targets", t("tabTargets")],
            ["reports", t("tabReports")],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={tabHref(key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition",
              tab === key
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--accent)]",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "personal" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("email")}
              </p>
              <p className="mt-1 font-medium">{employee.email ?? "—"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("phone")}
              </p>
              <p className="mt-1 font-medium">{employee.phone ?? "—"}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("identityType")}
              </p>
              <p className="mt-1 font-medium">
                {employee.identityType ?? "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("identityNumber")}
              </p>
              <p className="mt-1 font-mono text-sm">
                {employee.identityNumber ?? "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("identityExpiresOn")}
              </p>
              <p className="mt-1 font-medium">
                {employee.identityExpiresOn
                  ? formatDate(employee.identityExpiresOn)
                  : "—"}
              </p>
            </Card>
          </div>

          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">
              {t("insuranceCertificate")}
            </h3>
            {insurance ? (
              <a
                href={`/api/attachments/${insurance.id}?companyId=${companyId}`}
                className="inline-flex items-center gap-2 text-sm text-[var(--primary)] underline-offset-2 hover:underline"
              >
                <FileText className="h-4 w-4" />
                {insurance.fileName}
              </a>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("insuranceMissing")}
              </p>
            )}
            {canWrite ? (
              <form
                action={uploadEmployeeInsurance.bind(
                  null,
                  companyId,
                  employeeId,
                )}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                  <span className="font-medium">
                    {t("uploadInsuranceHrOnly")}
                  </span>
                  <input
                    type="file"
                    name="insurance"
                    required
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf"
                    className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
                  />
                </label>
                <Button type="submit">{t("save")}</Button>
              </form>
            ) : null}
          </Card>

          <QiwaContractSection
            companyId={companyId}
            employeeId={employeeId}
            canManage={canManageQiwa}
            canApprove={canApproveQiwa}
            qiwaUrl={qiwaUrl}
            contract={qiwaContract}
            summary={
              qiwaSummary ?? {
                fullName: employee.fullName,
                employeeNumber: employee.employeeNumber,
                identityType: employee.identityType ?? null,
                identityNumber: employee.identityNumber ?? null,
                jobTitle: employee.jobTitle ?? null,
                department: null,
                branch: null,
                basicSalary: employee.basicSalary ?? null,
                currency: employee.currency,
                hireDate: employee.hireDate ?? null,
                employmentStatus: employee.employmentStatus,
              }
            }
          />
        </div>
      ) : null}

      {tab === "shifts" ? (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("shiftsStub")}
            </p>
          </Card>
          {employee.shiftAssignments?.length ? (
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">
                {t("assignedShifts")}
              </h3>
              <ul className="space-y-2 text-sm">
                {employee.shiftAssignments.map((a) => (
                  <li key={a.id}>
                    {a.shift?.name ?? "—"} · {a.shift?.startTime}–
                    {a.shift?.endTime} · {formatDate(a.effectiveFrom)}
                    {a.effectiveTo ? ` → ${formatDate(a.effectiveTo)}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {canWrite && shifts.length > 0 ? (
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">{t("assignShift")}</h3>
              <form
                action={assignEmployeeShift.bind(null, companyId, employeeId)}
                className="grid gap-3 md:grid-cols-3"
              >
                <Select
                  name="shiftId"
                  label={t("shift")}
                  required
                  options={shifts.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.startTime}–${s.endTime})`,
                  }))}
                />
                <Input
                  name="effectiveFrom"
                  label={t("from")}
                  type="date"
                  required
                />
                <Input name="effectiveTo" label={t("to")} type="date" />
                <div className="md:col-span-3">
                  <Button type="submit">{t("save")}</Button>
                </div>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "financial" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("basicSalary")} (SAR)
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(employee.basicSalary, "SAR")}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("lateDiscountAmount")} / {t("day")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(
                  employee.lateDiscountAmount ??
                    (employee.basicSalary
                      ? String(Number(employee.basicSalary) / 30)
                      : null),
                  "SAR",
                )}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {t("lateDiscountDefaultHint")}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("iban")}
              </p>
              <p className="mt-1 font-mono text-sm">
                {employee.ibanLast4 ? `•••• ${employee.ibanLast4}` : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("ewallet")}
              </p>
              <p className="mt-1 font-semibold">
                {employee.ewallet
                  ? formatMoney(
                      employee.ewallet.balance,
                      employee.ewallet.currency,
                    )
                  : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("attendanceBadgeId")}
              </p>
              <p className="mt-1 font-mono text-sm">
                {employee.attendanceBadgeId ?? "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("qiwaVerifiedStatus")}
              </p>
              <p className="mt-1 font-semibold">
                {employee.approvalStatus === "APPROVED"
                  ? t("qiwaVerified")
                  : t("qiwaNotVerified")}
              </p>
            </Card>
          </div>

          {canWrite ? (
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">
                {t("editFinancialSettings")}
              </h3>
              <form
                action={setEmployeeFinancialSettings.bind(
                  null,
                  companyId,
                  employeeId,
                )}
                className="grid gap-3 md:grid-cols-2"
              >
                <Input
                  name="basicSalary"
                  label={`${t("basicSalary")} (SAR)`}
                  defaultValue={employee.basicSalary ?? ""}
                />
                <Input
                  name="lateDiscountAmount"
                  label={`${t("lateDiscountAmount")} (SAR / ${t("day")})`}
                  defaultValue={
                    employee.lateDiscountAmount ??
                    (employee.basicSalary
                      ? (Number(employee.basicSalary) / 30).toFixed(2)
                      : "")
                  }
                />
                <Input
                  name="absenceDiscountPerDay"
                  label={`${t("absenceDiscountPerDay")} (SAR)`}
                  defaultValue={
                    employee.absenceDiscountPerDay ??
                    (employee.basicSalary
                      ? (Number(employee.basicSalary) / 30).toFixed(2)
                      : "")
                  }
                />
                <Select
                  name="salesTargetMode"
                  label={t("salesTargetMode")}
                  defaultValue={employee.salesTargetMode ?? "AMOUNT"}
                  options={[
                    { value: "AMOUNT", label: t("salesTargetModeAmount") },
                    { value: "PERCENT", label: t("salesTargetModePercent") },
                    { value: "BOTH", label: t("salesTargetModeBoth") },
                  ]}
                />
                <Input
                  name="salesTargetAmount"
                  label={`${t("salesTargetAmount")} (SAR)`}
                  defaultValue={employee.salesTargetAmount ?? ""}
                />
                <Input
                  name="targetPercent"
                  label={t("salesCommissionPercent")}
                  defaultValue={employee.targetPercent ?? ""}
                />
                <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
                  {t("lateDiscountDefaultHint")}
                </p>
                <div className="md:col-span-2">
                  <Button type="submit">{t("save")}</Button>
                </div>
              </form>
            </Card>
          ) : null}

          {employee.advanceEarnings ? (
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">
                {t("earnedThisMonth")} ({employee.advanceEarnings.month})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("daysWorked")}
                  </p>
                  <p className="font-semibold">
                    {employee.advanceEarnings.daysWorked}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("earnedAmount")}
                  </p>
                  <p className="font-semibold">
                    {formatMoney(
                      employee.advanceEarnings.earnedAmount,
                      "SAR",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("advanceAllowancePercent")}
                  </p>
                  <p className="font-semibold">
                    {employee.advanceEarnings.advanceAllowancePercent != null
                      ? `${employee.advanceEarnings.advanceAllowancePercent}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("maxAdvanceAmount")}
                  </p>
                  <p className="font-semibold">
                    {formatMoney(
                      employee.advanceEarnings.maxAdvanceAmount,
                      "SAR",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("advancesUsed")}
                  </p>
                  <p className="font-semibold">
                    {formatMoney(
                      employee.advanceEarnings.advancesUsed,
                      "SAR",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t("remainingAdvance")}
                  </p>
                  <p className="font-semibold">
                    {formatMoney(
                      employee.advanceEarnings.remainingAdvance,
                      "SAR",
                    )}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("advanceAllowanceHint")}
              </p>
            </Card>
          ) : null}

          {canWrite ? (
            <Card className="space-y-3 p-4">
              <h3 className="text-sm font-semibold">
                {t("setAdvanceAllowance")}
              </h3>
              <form
                action={setEmployeeAdvanceAllowance.bind(
                  null,
                  companyId,
                  employeeId,
                )}
                className="grid gap-3 md:grid-cols-3"
              >
                <Input
                  name="percent"
                  label={t("advanceAllowancePercent")}
                  required
                  defaultValue={
                    employee.advanceAllowancePercent ??
                    employee.advanceEarnings?.advanceAllowancePercent ??
                    ""
                  }
                />
                <div className="flex items-end md:col-span-2">
                  <Button type="submit">{t("save")}</Button>
                </div>
              </form>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "targets" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("salesTargetMode")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {(employee.salesProgress?.salesTargetMode ??
                  employee.salesTargetMode) === "PERCENT"
                  ? t("salesTargetModePercent")
                  : (employee.salesProgress?.salesTargetMode ??
                        employee.salesTargetMode) === "BOTH"
                    ? t("salesTargetModeBoth")
                    : t("salesTargetModeAmount")}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("salesTargetAmount")} (SAR)
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(
                  employee.salesProgress?.salesTargetAmount ??
                    employee.salesTargetAmount,
                  "SAR",
                )}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("salesCommissionPercent")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {(employee.salesProgress?.targetPercent ??
                  employee.targetPercent) != null
                  ? `${employee.salesProgress?.targetPercent ?? employee.targetPercent}%`
                  : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("approvedSalesSum")} (
                {employee.salesProgress?.month ?? "—"})
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(
                  employee.salesProgress?.approvedSalesSum,
                  "SAR",
                )}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("salesCommissionEarned")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(
                  employee.salesProgress?.salesCommission,
                  "SAR",
                )}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("targetCompletedPercent")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {employee.salesProgress?.targetCompletedPercent != null
                  ? `${employee.salesProgress.targetCompletedPercent}%`
                  : employee.targetCompletedPercent != null
                    ? `${employee.targetCompletedPercent}%`
                    : "—"}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("overTarget")}
              </p>
              <p className="mt-1 font-semibold">
                {employee.salesProgress?.overTarget ? tc("yes") : tc("no")}
              </p>
            </Card>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("salesProgressHint")}
          </p>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {t("salesSubmissions")}
            </h3>
            {!employee.salesSubmissions?.length ? (
              <EmptyState message={t("emptySales")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("date")}</th>
                      <th className="px-2 py-2 font-medium">{t("amount")}</th>
                      <th className="px-2 py-2 font-medium">
                        {t("paymentMethod")}
                      </th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                      <th className="px-2 py-2 font-medium">{t("action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employee.salesSubmissions.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">{formatDate(s.saleDate)}</td>
                        <td className="px-2 py-2">
                          {formatMoney(s.amount, "SAR")}
                        </td>
                        <td className="px-2 py-2">{s.paymentMethod}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-2 py-2">
                          {canWrite &&
                          (s.status === "PENDING_CASH_APPROVAL" ||
                            s.status === "SUBMITTED") ? (
                            <div className="flex flex-wrap gap-1">
                              {(s.paymentMethod !== "CASH" ||
                                canApproveCash) && (
                                <ActionForm
                                  label={t("approve")}
                                  action={decideSalesSubmission.bind(
                                    null,
                                    companyId,
                                    s.id,
                                    "APPROVED",
                                    detailPath,
                                  )}
                                />
                              )}
                              <ActionForm
                                label={t("reject")}
                                variant="danger"
                                action={decideSalesSubmission.bind(
                                  null,
                                  companyId,
                                  s.id,
                                  "REJECTED",
                                  detailPath,
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
      ) : null}

      {tab === "reports" ? (
        <Card className="space-y-4 p-5">
          <form
            action={`/c/${companyId}/hr/employees/${employeeId}`}
            method="get"
            className="grid gap-3 sm:grid-cols-3"
          >
            <input type="hidden" name="tab" value="reports" />
            <Input
              name="from"
              label={t("reportFrom")}
              type="date"
              defaultValue={flash.from ?? ""}
              required
            />
            <Input
              name="to"
              label={t("reportTo")}
              type="date"
              defaultValue={flash.to ?? ""}
              required
            />
            <div className="flex items-end">
              <Button type="submit">{t("loadReport")}</Button>
            </div>
          </form>
          {report ? (
            <div className="space-y-3 text-sm">
              <p>
                {t("salesTargetAmount")}:{" "}
                {formatMoney(
                  report.targetProgress?.salesTargetAmount,
                  "SAR",
                )}{" "}
                · {t("approvedSalesSum")}:{" "}
                {formatMoney(report.targetProgress?.approvedSalesSum, "SAR")} ·
                %: {report.targetProgress?.computedPercent ?? "—"}
              </p>
              <p>
                {t("leaves")}: {report.leaves.length} · {t("advances")}:{" "}
                {report.advances.length} · {t("salesSubmissions")}:{" "}
                {report.sales.length} · {t("attendance")}:{" "}
                {report.attendance.length}
              </p>
            </div>
          ) : flash.from && flash.to ? (
            <EmptyState message={t("emptyReport")} />
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("reportPickRange")}
            </p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
