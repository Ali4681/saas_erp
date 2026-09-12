import { getLocale, getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { AllowanceTypesManager } from "@/components/erp/AllowanceTypesManager";
import { EmployeeAllowancesFields } from "@/components/erp/EmployeeAllowancesFields";
import { EmployeeCommissionFields } from "@/components/erp/EmployeeCommissionFields";
import { EmployeeQiwaContractFields } from "@/components/erp/EmployeeQiwaContractFields";
import { EmployeeShiftPatternFields } from "@/components/erp/EmployeeShiftPatternFields";
import { PhoneWithDialCodeField } from "@/components/erp/PhoneWithDialCodeField";
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
import {
  createAllowanceType,
  createEmployee,
  deleteAllowanceType,
  updateEmployeeCompensation,
} from "../actions";
import { EmployeeIdentityFields } from "./EmployeeIdentityFields";

type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  hireDate?: string | null;
  employmentStatus: string;
  employmentCategory?: string | null;
  trialStartsOn?: string | null;
  trialEndsOn?: string | null;
  basicSalary: string | null;
  salesTargetMode?: string | null;
  salesTargetAmount?: string | null;
  salesRewardAmount?: string | null;
  targetPercent: string | null;
  lateDiscountAmount?: string | null;
  identityType?: string | null;
  identityNumber?: string | null;
  identityExpiresOn?: string | null;
  identityAttachmentId?: string | null;
  approvalStatus?: string | null;
  qiwaContractUrl?: string | null;
  qiwaContractRef?: string | null;
  qiwaStatus?: string | null;
  advanceAllowanceMonthly?: string | null;
  advanceAllowanceMonth?: string | null;
  advanceAllowancePercent?: string | null;
  attendanceBadgeId?: string | null;
  hasInsurance?: boolean;
  ibanMasked?: string | null;
  shiftPatternMode?: string | null;
  shiftWindows?: Array<{ start: string; end: string }>;
  allowances?: Array<{
    id: string;
    amount: string;
    allowanceTypeId: string;
    allowanceType?: {
      id: string;
      code: string;
      nameAr: string;
      nameEn: string;
    };
  }>;
  workShift?: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
  } | null;
  currency: string;
};
type AllowanceType = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
};
type HrSummary = {
  total: number;
  active: number;
  onLeave: number;
  suspended: number;
  terminated: number;
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
  const locale = (await getLocale()) === "en" ? "en" : "ar";
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");
  const qiwaUrl =
    process.env.NEXT_PUBLIC_QIWA_URL?.trim() || "https://www.qiwa.sa/";

  const [employees, summary, allowanceTypes] = await Promise.all([
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
    apiServer<HrSummary>(`/companies/${companyId}/hr/summary`, {
      companyId,
    }).catch(() => null),
    apiServer<AllowanceType[]>(
      `/companies/${companyId}/hr/allowance-types`,
      { companyId },
    ).catch(() => []),
  ]);

  const nextEmployeeNumber = suggestNextEmployeeNumber(employees);
  const create = createEmployee.bind(null, companyId);
  const addAllowanceType = createAllowanceType.bind(null, companyId);
  const removeAllowanceType = deleteAllowanceType.bind(null, companyId);

  const now = new Date();
  const trialAlerts = employees.filter((e) => {
    const ends = (e as { trialEndsOn?: string | null }).trialEndsOn;
    if (!ends || e.employmentCategory !== "TRIAL_PERIOD") return false;
    const end = new Date(ends);
    if (Number.isNaN(end.getTime())) return false;
    const days = Math.ceil(
      (end.getTime() - now.getTime()) / 86_400_000,
    );
    return days <= 14;
  });

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

      {trialAlerts.length > 0 ? (
        <Card className="border-[var(--warning, #b45309)]/40 bg-[var(--secondary)]/50 p-4">
          <p className="text-sm font-semibold">{t("trialEndingTitle")}</p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--muted-foreground)]">
            {trialAlerts.map((e) => (
              <li key={e.id}>
                <a
                  href={`/c/${companyId}/hr/employees/${e.id}`}
                  className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                >
                  {e.fullName}
                </a>
                {" — "}
                {t("trialEndingItem", {
                  date: e.trialEndsOn?.slice(0, 10) ?? "—",
                })}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {t("trialEndingHint")}{" "}
            <a
              href={qiwaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
            >
              {t("goToQiwa")}
            </a>
          </p>
        </Card>
      ) : null}

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

      {canWrite ? (
        <>
          <Card className="p-4">
            <AllowanceTypesManager
              types={allowanceTypes}
              createAction={addAllowanceType}
              deleteAction={removeAllowanceType}
              locale={locale}
              labels={{
                heading: t("allowanceTypesHeading"),
                hint: t("allowanceTypesHint"),
                code: t("allowanceTypeCode"),
                nameAr: t("allowanceTypeNameAr"),
                nameEn: t("allowanceTypeNameEn"),
                add: t("allowanceTypeAdd"),
                remove: t("allowanceRemove"),
              }}
            />
          </Card>
          <CreateFormDialog
            title={t("newEmployee")}
            description={t("newEmployeeDesc")}
            triggerLabel={t("addEmployee")}
          >
            <form action={create} className="space-y-5">
              <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {t("sectionPersonal")}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {t("sectionPersonalHint")}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    name="employeeNumber"
                    label={t("employeeNumber")}
                    required
                    defaultValue={nextEmployeeNumber}
                  />
                  <Input name="fullName" label={t("fullName")} required />
                <Input name="email" label={t("email")} type="email" required />
                <PhoneWithDialCodeField name="phone" label={t("phone")} />
                <div className="rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 p-3 md:col-span-2">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="createAppLogin"
                      value="on"
                      defaultChecked
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block font-semibold text-[var(--foreground)]">
                        {t("createAppLogin")}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--muted-foreground)]">
                        {t("createAppLoginHint")}
                      </span>
                    </span>
                  </label>
                </div>
                <Input name="jobTitle" label={t("jobTitle")} />
                <Input name="hireDate" label={t("hireDate")} type="date" />
                <EmployeeQiwaContractFields
                  qiwaUrl={qiwaUrl}
                  labels={{
                    qiwaRegistered: t("qiwaRegistered"),
                    qiwaYes: t("qiwaRegisteredYes"),
                    qiwaNo: t("qiwaRegisteredNo"),
                    qiwaFile: t("qiwaProofFile"),
                    qiwaFileHint: t("qiwaProofFileHint"),
                    goQiwa: t("goToQiwa"),
                    contractType: t("employmentCategory"),
                    employment: t("employmentCategoryContract"),
                    ajeer: t("employmentCategoryWage"),
                    trial: t("employmentCategoryTrial"),
                    trialStart: t("trialStartsOn"),
                    trialEnd: t("trialEndsOn"),
                    trialHint: t("trialPeriodHint"),
                    workContract: t("workContract"),
                    workContractHint: t("workContractHint"),
                  }}
                />
                <EmployeeIdentityFields />
                <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
                  <span className="font-medium text-[var(--foreground)]">
                    {t("identityPhoto")}
                  </span>
                  <input
                    type="file"
                    name="identityPhoto"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] shadow-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  />
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {t("identityPhotoHint")}
                  </span>
                </label>
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
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {t("sectionFinancial")}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {t("sectionFinancialHint")}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  name="basicSalary"
                  label={`${t("basicSalary")} (SAR)`}
                />
                <EmployeeCommissionFields
                  labels={{
                    plan: t("commissionPlan"),
                    withTarget: t("commissionWithTarget"),
                    noTarget: t("commissionNoTarget"),
                    targetAmount: `${t("salesTargetAmount")} (SAR)`,
                    rewardType: t("commissionRewardType"),
                    rewardFixed: t("commissionRewardFixed"),
                    rewardPercent: t("commissionRewardPercent"),
                    rewardAmount: `${t("salesRewardAmount")} (SAR)`,
                    commissionPercent: t("salesCommissionPercent"),
                    hintTarget: t("commissionHintTarget"),
                    hintNoTarget: t("commissionHintNoTarget"),
                  }}
                />
                <EmployeeAllowancesFields
                  allowanceTypes={allowanceTypes}
                  locale={locale}
                  labels={{
                    heading: t("allowancesHeading"),
                    hint: t("allowancesHint"),
                    select: t("allowanceSelect"),
                    amount: `${t("allowanceAmount")} (SAR)`,
                    add: t("allowanceAdd"),
                    remove: t("allowanceRemove"),
                    empty: t("allowancesEmpty"),
                  }}
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
                <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
                  {t("advanceAllowanceHint")}
                </p>
                <input type="hidden" name="currency" value="SAR" />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  {t("sectionShifts")}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {t("sectionShiftsHint")}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <EmployeeShiftPatternFields
                  labels={{
                    pattern: t("shiftPattern"),
                    one: t("shiftPatternOne"),
                    two: t("shiftPatternTwo"),
                    flexible: t("shiftPatternFlexible"),
                    hint: t("shiftPatternHint"),
                    start: t("shiftStart"),
                    end: t("shiftEnd"),
                    addShift: t("shiftAdd"),
                    remove: t("allowanceRemove"),
                    shiftN: t("shiftLabel"),
                  }}
                />
                <Input
                  name="attendanceBadgeId"
                  label={t("attendanceBadgeId")}
                  placeholder={t("attendanceBadgeHint")}
                />
              </div>
            </section>

            <div>
              <Button type="submit">{t("createEmployee")}</Button>
            </div>
          </form>
        </CreateFormDialog>
        </>
      ) : null}

      <Card>
        {employees.length === 0 ? (
          <EmptyState message={t("emptyEmployees")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("titleCol")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("employmentCategory")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("workShift")}</th>
                  <th className="px-2 py-2 font-medium">{t("salary")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("salesTargetAmount")}
                  </th>
                  <th className="px-2 py-2 font-medium">
                    {t("identityNumber")}
                  </th>
                  <th className="px-2 py-2 font-medium">
                    {t("qiwaRegisteredColumn")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
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
                        {e.employmentCategory === "WAGE_WORKER"
                          ? t("employmentCategoryWage")
                          : e.employmentCategory === "TRIAL_PERIOD"
                            ? t("employmentCategoryTrial")
                            : e.employmentCategory === "EMPLOYMENT_CONTRACT"
                              ? t("employmentCategoryContract")
                              : "—"}
                      </td>
                      <td className="px-2 py-2">
                        {formatEmployeeShiftHours(e)}
                      </td>
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
                          status={
                            e.approvalStatus === "APPROVED"
                              ? "APPROVED"
                              : "PENDING"
                          }
                          label={
                            e.approvalStatus === "APPROVED"
                              ? t("qiwaRegisteredYesShort")
                              : t("qiwaRegisteredNoShort")
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={e.employmentStatus} />
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
                              title={t("editEmployeeTitle", {
                                name: e.fullName,
                              })}
                              description={t("editEmployeeDesc")}
                              triggerLabel={t("edit")}
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
                                className="space-y-5"
                              >
                                <input
                                  type="hidden"
                                  name="previousApprovalStatus"
                                  value={e.approvalStatus ?? "PENDING"}
                                />
                                <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                                  <div>
                                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                                      {t("sectionPersonal")}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                      {t("sectionPersonalHint")}
                                    </p>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <Input
                                      name="employeeNumber"
                                      label={t("employeeNumber")}
                                      defaultValue={e.employeeNumber}
                                      disabled
                                    />
                                    <Input
                                      name="fullName"
                                      label={t("fullName")}
                                      required
                                      defaultValue={e.fullName}
                                    />
                                    <Input
                                      name="email"
                                      label={t("email")}
                                      type="email"
                                      defaultValue={e.email ?? ""}
                                    />
                                    <PhoneWithDialCodeField
                                      name="phone"
                                      label={t("phone")}
                                      defaultValue={e.phone ?? ""}
                                    />
                                    <Input
                                      name="jobTitle"
                                      label={t("jobTitle")}
                                      defaultValue={e.jobTitle ?? ""}
                                    />
                                    <Input
                                      name="hireDate"
                                      label={t("hireDate")}
                                      type="date"
                                      defaultValue={
                                        e.hireDate?.slice(0, 10) ?? ""
                                      }
                                    />
                                    <EmployeeQiwaContractFields
                                      qiwaUrl={qiwaUrl}
                                      defaultQiwaRegistered={
                                        e.approvalStatus === "APPROVED"
                                          ? "yes"
                                          : "no"
                                      }
                                      defaultEmploymentCategory={
                                        e.employmentCategory ===
                                          "WAGE_WORKER" ||
                                        e.employmentCategory ===
                                          "TRIAL_PERIOD" ||
                                        e.employmentCategory ===
                                          "EMPLOYMENT_CONTRACT"
                                          ? e.employmentCategory
                                          : "EMPLOYMENT_CONTRACT"
                                      }
                                      defaultTrialStartsOn={e.trialStartsOn}
                                      defaultTrialEndsOn={e.trialEndsOn}
                                      labels={{
                                        qiwaRegistered: t("qiwaRegistered"),
                                        qiwaYes: t("qiwaRegisteredYes"),
                                        qiwaNo: t("qiwaRegisteredNo"),
                                        qiwaFile: t("qiwaProofFile"),
                                        qiwaFileHint: t("qiwaProofFileHint"),
                                        goQiwa: t("goToQiwa"),
                                        contractType: t("employmentCategory"),
                                        employment: t(
                                          "employmentCategoryContract",
                                        ),
                                        ajeer: t("employmentCategoryWage"),
                                        trial: t("employmentCategoryTrial"),
                                        trialStart: t("trialStartsOn"),
                                        trialEnd: t("trialEndsOn"),
                                        trialHint: t("trialPeriodHint"),
                                        workContract: t("workContract"),
                                        workContractHint: t("workContractHint"),
                                      }}
                                    />
                                    <EmployeeIdentityFields
                                      defaultType={
                                        e.identityType === "CITIZEN"
                                          ? "CITIZEN"
                                          : "RESIDENT"
                                      }
                                      defaultNumber={e.identityNumber ?? ""}
                                      defaultExpiresOn={
                                        e.identityExpiresOn?.slice(0, 10) ?? ""
                                      }
                                    />
                                    <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
                                      <span className="font-medium text-[var(--foreground)]">
                                        {t("identityPhoto")}
                                      </span>
                                      {e.identityAttachmentId ? (
                                        <a
                                          href={`/api/attachments/${e.identityAttachmentId}?companyId=${companyId}&inline=1`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="mb-1 block max-w-xs"
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={`/api/attachments/${e.identityAttachmentId}?companyId=${companyId}&inline=1`}
                                            alt={t("identityPhoto")}
                                            className="max-h-40 w-full rounded-lg border border-[var(--border)] object-contain"
                                          />
                                        </a>
                                      ) : null}
                                      <input
                                        type="file"
                                        name="identityPhoto"
                                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                                        className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] shadow-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
                                      />
                                      <span className="text-xs text-[var(--muted-foreground)]">
                                        {t("identityPhotoHint")}
                                      </span>
                                    </label>
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
                                  </div>
                                </section>

                                <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                                  <div>
                                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                                      {t("sectionFinancial")}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                      {t("sectionFinancialHint")}
                                    </p>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <Input
                                      name="basicSalary"
                                      label={`${t("basicSalary")} (SAR)`}
                                      defaultValue={e.basicSalary ?? ""}
                                    />
                                    <EmployeeCommissionFields
                                      defaultSalesTargetMode={
                                        e.salesTargetMode
                                      }
                                      defaultSalesTargetAmount={
                                        e.salesTargetAmount
                                      }
                                      defaultSalesRewardAmount={
                                        e.salesRewardAmount
                                      }
                                      defaultTargetPercent={e.targetPercent}
                                      labels={{
                                        plan: t("commissionPlan"),
                                        withTarget: t("commissionWithTarget"),
                                        noTarget: t("commissionNoTarget"),
                                        targetAmount: `${t("salesTargetAmount")} (SAR)`,
                                        rewardType: t("commissionRewardType"),
                                        rewardFixed: t(
                                          "commissionRewardFixed",
                                        ),
                                        rewardPercent: t(
                                          "commissionRewardPercent",
                                        ),
                                        rewardAmount: `${t("salesRewardAmount")} (SAR)`,
                                        commissionPercent: t(
                                          "salesCommissionPercent",
                                        ),
                                        hintTarget: t("commissionHintTarget"),
                                        hintNoTarget: t(
                                          "commissionHintNoTarget",
                                        ),
                                      }}
                                    />
                                    <EmployeeAllowancesFields
                                      allowanceTypes={allowanceTypes}
                                      locale={locale}
                                      defaultAllowances={(
                                        e.allowances ?? []
                                      ).map((a) => ({
                                        allowanceTypeId: a.allowanceTypeId,
                                        amount: String(a.amount ?? ""),
                                      }))}
                                      labels={{
                                        heading: t("allowancesHeading"),
                                        hint: t("allowancesHint"),
                                        select: t("allowanceSelect"),
                                        amount: `${t("allowanceAmount")} (SAR)`,
                                        add: t("allowanceAdd"),
                                        remove: t("allowanceRemove"),
                                        empty: t("allowancesEmpty"),
                                      }}
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
                                      defaultValue={
                                        e.advanceAllowancePercent ?? ""
                                      }
                                    />
                                    <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
                                      {t("advanceAllowanceHint")}
                                    </p>
                                    <input
                                      type="hidden"
                                      name="currency"
                                      value="SAR"
                                    />
                                  </div>
                                </section>

                                <section className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                                  <div>
                                    <h3 className="text-sm font-semibold text-[var(--foreground)]">
                                      {t("sectionShifts")}
                                    </h3>
                                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                      {t("sectionShiftsHint")}
                                    </p>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <EmployeeShiftPatternFields
                                      defaultMode={e.shiftPatternMode}
                                      defaultWindows={
                                        e.shiftWindows &&
                                        e.shiftWindows.length > 0
                                          ? e.shiftWindows
                                          : e.workShift
                                            ? [
                                                {
                                                  start: e.workShift.startTime,
                                                  end: e.workShift.endTime,
                                                },
                                              ]
                                            : null
                                      }
                                      labels={{
                                        pattern: t("shiftPattern"),
                                        one: t("shiftPatternOne"),
                                        two: t("shiftPatternTwo"),
                                        flexible: t("shiftPatternFlexible"),
                                        hint: t("shiftPatternHint"),
                                        start: t("shiftStart"),
                                        end: t("shiftEnd"),
                                        addShift: t("shiftAdd"),
                                        remove: t("allowanceRemove"),
                                        shiftN: t("shiftLabel"),
                                      }}
                                    />
                                    <Input
                                      name="attendanceBadgeId"
                                      label={t("attendanceBadgeId")}
                                      placeholder={t("attendanceBadgeHint")}
                                      defaultValue={e.attendanceBadgeId ?? ""}
                                    />
                                  </div>
                                </section>

                                <div>
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

function formatEmployeeShiftHours(e: {
  shiftWindows?: Array<{ start: string; end: string }> | null;
  workShift?: { startTime: string; endTime: string } | null;
}): string {
  const windows =
    e.shiftWindows && e.shiftWindows.length > 0
      ? e.shiftWindows
      : e.workShift
        ? [
            {
              start: e.workShift.startTime,
              end: e.workShift.endTime,
            },
          ]
        : [];
  if (windows.length === 0) return "—";
  return windows
    .map((w) => `${w.start.slice(0, 5)}–${w.end.slice(0, 5)}`)
    .join(" · ");
}
