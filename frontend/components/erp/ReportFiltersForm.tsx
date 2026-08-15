import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Option = { id: string; label: string };

const STATUS_BY_MODULE: Record<string, Array<{ value: string; labelKey: string }>> = {
  executive: [
    { value: "ISSUED", labelKey: "statusIssued" },
    { value: "PARTIALLY_PAID", labelKey: "statusPartiallyPaid" },
    { value: "OVERDUE", labelKey: "statusOverdue" },
    { value: "PAID", labelKey: "statusPaid" },
  ],
  sales: [
    { value: "DRAFT", labelKey: "statusDraft" },
    { value: "ISSUED", labelKey: "statusIssued" },
    { value: "PARTIALLY_PAID", labelKey: "statusPartiallyPaid" },
    { value: "OVERDUE", labelKey: "statusOverdue" },
    { value: "PAID", labelKey: "statusPaid" },
    { value: "CANCELLED", labelKey: "statusCancelled" },
  ],
  customers: [
    { value: "ACTIVE", labelKey: "statusActive" },
    { value: "INACTIVE", labelKey: "statusInactive" },
  ],
  purchases: [
    { value: "DRAFT", labelKey: "statusDraft" },
    { value: "SUBMITTED", labelKey: "statusSubmitted" },
    { value: "APPROVED", labelKey: "statusApproved" },
    { value: "RECEIVED", labelKey: "statusReceived" },
    { value: "CANCELLED", labelKey: "statusCancelled" },
  ],
  inventory: [
    { value: "ACTIVE", labelKey: "statusActive" },
    { value: "INACTIVE", labelKey: "statusInactive" },
    { value: "IN", labelKey: "statusMovementIn" },
    { value: "OUT", labelKey: "statusMovementOut" },
  ],
  hr: [
    { value: "ACTIVE", labelKey: "statusActive" },
    { value: "ON_LEAVE", labelKey: "statusOnLeave" },
    { value: "SUSPENDED", labelKey: "statusSuspended" },
    { value: "TERMINATED", labelKey: "statusTerminated" },
    { value: "PENDING", labelKey: "statusPending" },
    { value: "APPROVED", labelKey: "statusApproved" },
    { value: "REJECTED", labelKey: "statusRejected" },
  ],
  finance: [
    { value: "OPEN", labelKey: "statusOpen" },
    { value: "CLOSED", labelKey: "statusClosed" },
  ],
  projects: [
    { value: "ACTIVE", labelKey: "statusActive" },
    { value: "ON_HOLD", labelKey: "statusOnHold" },
    { value: "COMPLETED", labelKey: "statusCompleted" },
    { value: "CANCELLED", labelKey: "statusCancelled" },
  ],
  notes: [
    { value: "OPEN", labelKey: "statusOpen" },
    { value: "IN_PROGRESS", labelKey: "statusInProgress" },
    { value: "DONE", labelKey: "statusDone" },
  ],
  automation: [
    { value: "ACTIVE", labelKey: "statusActive" },
    { value: "INACTIVE", labelKey: "statusInactive" },
    { value: "SUCCESS", labelKey: "statusSuccess" },
    { value: "FAILED", labelKey: "statusFailed" },
  ],
};

function scopesFor(module?: string) {
  const m = module ?? "executive";
  return {
    showEmployee: ["executive", "sales", "purchases", "hr", "projects", "notes"].includes(m),
    showCustomer: ["executive", "sales", "customers"].includes(m),
    showProduct: ["executive", "sales", "inventory"].includes(m),
    showStatus: true,
  };
}

export async function ReportFiltersForm({
  actionPath,
  module,
  employees = [],
  customers = [],
  products = [],
  defaults,
}: {
  companyId: string;
  actionPath: string;
  module?: string;
  employees?: Option[];
  customers?: Option[];
  products?: Option[];
  defaults: {
    from?: string;
    to?: string;
    employeeId?: string;
    customerId?: string;
    productId?: string;
    status?: string;
    period?: string;
  };
}) {
  const t = await getTranslations("reports.filters");
  const scopes = scopesFor(module);
  const statusOpts = STATUS_BY_MODULE[module ?? "executive"] ?? STATUS_BY_MODULE.executive;

  return (
    <form
      method="get"
      action={actionPath}
      className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-3 lg:grid-cols-4"
    >
      <p className="text-xs text-[var(--muted-foreground)] md:col-span-3 lg:col-span-4">
        {t("periodHint")}
      </p>
      <Select
        name="period"
        label={t("period")}
        defaultValue={defaults.period ?? ""}
        placeholder={t("periodCustom")}
        options={[
          { value: "this_month", label: t("periodThisMonth") },
          { value: "last_month", label: t("periodLastMonth") },
          { value: "this_quarter", label: t("periodThisQuarter") },
          { value: "this_year", label: t("periodThisYear") },
        ]}
      />
      <Input
        name="from"
        label={t("from")}
        type="date"
        defaultValue={defaults.from ?? ""}
      />
      <Input
        name="to"
        label={t("to")}
        type="date"
        defaultValue={defaults.to ?? ""}
      />
      {scopes.showEmployee ? (
        <Select
          name="employeeId"
          label={t("employee")}
          placeholder={t("all")}
          defaultValue={defaults.employeeId ?? ""}
          options={employees.map((e) => ({ value: e.id, label: e.label }))}
        />
      ) : null}
      {scopes.showCustomer ? (
        <Select
          name="customerId"
          label={t("customer")}
          placeholder={t("all")}
          defaultValue={defaults.customerId ?? ""}
          options={customers.map((c) => ({ value: c.id, label: c.label }))}
        />
      ) : null}
      {scopes.showProduct ? (
        <Select
          name="productId"
          label={t("product")}
          placeholder={t("all")}
          defaultValue={defaults.productId ?? ""}
          options={products.map((p) => ({ value: p.id, label: p.label }))}
        />
      ) : null}
      {scopes.showStatus ? (
        <Select
          name="status"
          label={t("status")}
          placeholder={t("all")}
          defaultValue={defaults.status ?? ""}
          options={statusOpts.map((s) => ({
            value: s.value,
            label: t(s.labelKey as "statusActive"),
          }))}
        />
      ) : null}
      <div className="flex items-end gap-2 md:col-span-3 lg:col-span-4">
        <Button type="submit">{t("apply")}</Button>
        <Button href={actionPath} variant="secondary">
          {t("reset")}
        </Button>
      </div>
    </form>
  );
}

/** Resolve preset period → from/to (UTC calendar dates). */
export function resolveReportPeriod(input: {
  period?: string;
  from?: string;
  to?: string;
}): { from?: string; to?: string; period?: string } {
  const period = input.period?.trim();
  if (!period) {
    return { from: input.from, to: input.to };
  }

  const today = new Date();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (period === "this_month") {
    return {
      period,
      from: fmt(new Date(Date.UTC(y, m, 1))),
      to: fmt(new Date(Date.UTC(y, m + 1, 0))),
    };
  }
  if (period === "last_month") {
    return {
      period,
      from: fmt(new Date(Date.UTC(y, m - 1, 1))),
      to: fmt(new Date(Date.UTC(y, m, 0))),
    };
  }
  if (period === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return {
      period,
      from: fmt(new Date(Date.UTC(y, qStart, 1))),
      to: fmt(new Date(Date.UTC(y, qStart + 3, 0))),
    };
  }
  if (period === "this_year") {
    return {
      period,
      from: fmt(new Date(Date.UTC(y, 0, 1))),
      to: fmt(new Date(Date.UTC(y, 11, 31))),
    };
  }
  return { from: input.from, to: input.to, period };
}
