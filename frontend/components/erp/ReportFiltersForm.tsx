import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { REPORT_MODULES } from "@/lib/erp/reports";

type Employee = { id: string; fullName: string; employeeNumber: string };

export async function ReportFiltersForm({
  companyId,
  actionPath,
  employees,
  defaults,
  showModule,
}: {
  companyId: string;
  actionPath: string;
  employees: Employee[];
  defaults: {
    from?: string;
    to?: string;
    employeeId?: string;
    module?: string;
    limit?: string;
  };
  showModule?: boolean;
}) {
  const t = await getTranslations("reports.filters");

  return (
    <form
      method="get"
      action={actionPath}
      className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-3 lg:grid-cols-5"
    >
      {showModule ? (
        <Select
          name="module"
          label={t("module")}
          defaultValue={defaults.module ?? "sales"}
          options={REPORT_MODULES.map((m) => ({
            value: m.value,
            label: m.label,
          }))}
        />
      ) : null}
      <Input
        name="from"
        label={t("from")}
        type="date"
        defaultValue={defaults.from ?? ""}
      />
      <Input name="to" label={t("to")} type="date" defaultValue={defaults.to ?? ""} />
      <Select
        name="employeeId"
        label={t("employee")}
        placeholder={t("all")}
        defaultValue={defaults.employeeId ?? ""}
        options={employees.map((e) => ({
          value: e.id,
          label: `${e.employeeNumber} — ${e.fullName}`,
        }))}
      />
      <Input
        name="limit"
        label={t("limit")}
        defaultValue={defaults.limit ?? "20"}
      />
      <div className="flex items-end gap-2 md:col-span-3 lg:col-span-5">
        <Button type="submit">{t("apply")}</Button>
        <Button href={`/c/${companyId}/reports`} variant="secondary">
          {t("reset")}
        </Button>
      </div>
    </form>
  );
}
