import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
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
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { fetchLocalesLookup, lookupSelectOptions } from "@/lib/lookups";
import { createEmployee, setEmployeeStatus } from "../actions";

type Employee = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentStatus: string;
  basicSalary: string | null;
  currency: string;
};
type Attachment = {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
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
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");

  const [employees, locales, attachments] = await Promise.all([
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
    fetchLocalesLookup(companyId),
    apiServer<Attachment[]>(
      `/companies/${companyId}/attachments?entityType=employee`,
      { companyId },
    ).catch(() => []),
  ]);

  const cvByEmployee = new Map<string, Attachment>();
  for (const a of attachments) {
    if (!cvByEmployee.has(a.entityId)) {
      cvByEmployee.set(a.entityId, a);
    }
  }

  const create = createEmployee.bind(null, companyId);
  const currencyOptions = lookupSelectOptions(locales.currencies);

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

      {canWrite ? (
        <CreateFormDialog
          title={t("newEmployee")}
          description={t("newEmployeeDesc")}
          triggerLabel={t("addEmployee")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="employeeNumber" label={t("employeeNumber")} required />
            <Input name="fullName" label={t("fullName")} required />
            <Input name="email" label={t("email")} type="email" />
            <Input name="phone" label={t("phone")} />
            <Input name="jobTitle" label={t("jobTitle")} />
            <Input name="hireDate" label={t("hireDate")} type="date" />
            <Input name="basicSalary" label={t("basicSalary")} />
            <Select
              name="currency"
              label={t("currency")}
              defaultValue={locales.defaults.currency}
              options={currencyOptions}
            />
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
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("titleCol")}</th>
                  <th className="px-2 py-2 font-medium">{t("salary")}</th>
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
                        {canWrite && e.employmentStatus === "ACTIVE" ? (
                          <ActionForm
                            label={t("suspend")}
                            variant="danger"
                            action={setEmployeeStatus.bind(
                              null,
                              companyId,
                              e.id,
                              "SUSPENDED",
                            )}
                          />
                        ) : canWrite && e.employmentStatus === "SUSPENDED" ? (
                          <ActionForm
                            label={t("activate")}
                            action={setEmployeeStatus.bind(
                              null,
                              companyId,
                              e.id,
                              "ACTIVE",
                            )}
                          />
                        ) : null}
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
