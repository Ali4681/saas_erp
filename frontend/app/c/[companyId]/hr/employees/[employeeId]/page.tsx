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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { cn } from "@/lib/utils";
import {
  setEmployeeApproval,
  updateEmployeeQiwa,
  uploadEmployeeInsurance,
} from "../../actions";

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
  targetPercent: string | null;
  salesTargetAmount?: string | null;
  identityType?: string | null;
  identityNumber?: string | null;
  identityExpiresOn?: string | null;
  ibanLast4?: string | null;
  advanceAllowancePercent?: string | null;
  advanceAllowanceMonthly?: string | null;
  approvalStatus?: string | null;
  qiwaContractUrl?: string | null;
  qiwaContractRef?: string | null;
  insuranceAttachmentId?: string | null;
  profileComplete?: boolean;
  currency: string;
};

type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
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
  searchParams: Promise<{ tab?: string; ok?: string; error?: string }>;
}) {
  const { companyId, employeeId } = await params;
  const flash = await searchParams;
  const tab = (TABS.includes(flash.tab as Tab) ? flash.tab : "personal") as Tab;
  const t = await getTranslations("hr");
  const { formatMoney, formatDate } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  let employee =
    (await apiServer<EmployeeDetail>(
      `/companies/${companyId}/hr/employees/${employeeId}`,
      { companyId },
    ).catch(() => null)) ?? null;

  if (!employee) {
    const list = await apiServer<EmployeeDetail[]>(
      `/companies/${companyId}/hr/employees`,
      { companyId },
    ).catch(() => []);
    employee = list.find((e) => e.id === employeeId) ?? null;
  }

  const [insuranceFiles, allEmployeeFiles] = await Promise.all([
    apiServer<Attachment[]>(
      `/companies/${companyId}/attachments?entityType=employee_insurance&entityId=${employeeId}`,
      { companyId },
    ).catch(() => []),
    apiServer<Attachment[]>(
      `/companies/${companyId}/attachments?entityType=employee&entityId=${employeeId}`,
      { companyId },
    ).catch(() => []),
  ]);

  const insurance =
    insuranceFiles[0] ??
    (employee?.insuranceAttachmentId
      ? allEmployeeFiles.find((a) => a.id === employee.insuranceAttachmentId)
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

  // APPROVED = registered on Qiwa (link/ref or HR flag). No REJECTED.
  const onQiwa =
    employee.approvalStatus === "APPROVED" ||
    Boolean(employee.qiwaContractUrl || employee.qiwaContractRef);
  const approval = onQiwa ? "APPROVED" : "PENDING";
  const incomplete = !insurance;
  const targetAmount = employee.salesTargetAmount ?? employee.targetPercent;

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

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={approval} />
        <span className="text-sm text-[var(--muted-foreground)]">
          {t("approvalStatus")}
        </span>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            {approval !== "APPROVED" ? (
              <ActionForm
                label={t("markApproved")}
                action={setEmployeeApproval.bind(
                  null,
                  companyId,
                  employeeId,
                  "APPROVED",
                )}
              />
            ) : null}
            {approval !== "PENDING" ? (
              <ActionForm
                label={t("markPending")}
                variant="secondary"
                action={setEmployeeApproval.bind(
                  null,
                  companyId,
                  employeeId,
                  "PENDING",
                )}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {incomplete ? (
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

          <Card className="space-y-3 p-4">
            <h3 className="text-sm font-semibold">{t("qiwaSection")}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("qiwaStatusNote")}
            </p>
            {employee.qiwaContractUrl ? (
              <a
                href={employee.qiwaContractUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm text-[var(--primary)] underline-offset-2 hover:underline"
              >
                {employee.qiwaContractUrl}
              </a>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">—</p>
            )}
            {canWrite ? (
              <form
                action={updateEmployeeQiwa.bind(null, companyId, employeeId)}
                className="grid gap-3 md:grid-cols-2"
              >
                <Input
                  name="qiwaContractUrl"
                  label={t("qiwaLink")}
                  defaultValue={employee.qiwaContractUrl ?? ""}
                />
                <Input
                  name="qiwaContractRef"
                  label={t("qiwaRef")}
                  defaultValue={employee.qiwaContractRef ?? ""}
                />
                <div className="md:col-span-2">
                  <Button type="submit">{t("save")}</Button>
                </div>
              </form>
            ) : null}
          </Card>
        </div>
      ) : null}

      {tab === "shifts" ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("shiftsStub")}
          </p>
        </Card>
      ) : null}

      {tab === "financial" ? (
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
            <p className="text-xs text-[var(--muted-foreground)]">{t("iban")}</p>
            <p className="mt-1 font-mono text-sm">
              {employee.ibanLast4 ? `•••• ${employee.ibanLast4}` : "—"}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("advanceAllowancePercent")}
            </p>
            <p className="mt-1 font-medium">
              {employee.advanceAllowancePercent != null
                ? `${employee.advanceAllowancePercent}%`
                : "—"}
            </p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {t("advanceAllowanceHint")}
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "targets" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("salesTargetAmount")} (SAR)
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatMoney(targetAmount, "SAR")}
            </p>
          </Card>
        </div>
      ) : null}

      {tab === "reports" ? (
        <Card className="space-y-4 p-5">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("reportStub")}
          </p>
          <form className="grid gap-3 sm:grid-cols-3">
            <Input name="from" label={t("reportFrom")} type="date" />
            <Input name="to" label={t("reportTo")} type="date" />
            <div className="flex items-end">
              <Button type="button" disabled>
                {t("loadReport")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
