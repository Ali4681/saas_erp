import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportFiltersForm } from "@/components/erp/ReportFiltersForm";
import { ReportExportButtons } from "@/components/erp/ReportExportButtons";
import { apiServer } from "@/lib/api/server";
import {
  buildQuery,
  extractClassificationSheets,
  humanizeReportLabel,
  REPORT_MODULES,
} from "@/lib/erp/reports";
import { getFormatters } from "@/lib/format-server";

type Employee = { id: string; fullName: string; employeeNumber: string };

type RowTable = {
  key: string;
  title: string;
  rows: Array<Record<string, unknown>>;
};

const ROW_KEYS = [
  "rows",
  "balances",
  "purchaseOrders",
  "bills",
  "employees",
  "leaves",
  "projects",
  "notes",
  "rules",
  "runs",
  "invoices",
  "contacts",
  "opportunities",
  "closings",
] as const;

export default async function ModuleReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; module: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    employeeId?: string;
    limit?: string;
  }>;
}) {
  const { companyId, module } = await params;
  const t = await getTranslations("reports");
  const { formatMoney, formatNumber } = await getFormatters();
  const filters = await searchParams;
  const qs = buildQuery(filters);
  const known = REPORT_MODULES.find((m) => m.value === module);
  const label = known
    ? t(`modules.${known.value}` as "modules.sales")
    : module;

  const [data, employees] = await Promise.all([
    apiServer<Record<string, unknown>>(
      `/companies/${companyId}/reports/modules/${module}${qs}`,
      { companyId },
    ).catch(() => null),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const classifications = data
    ? extractClassificationSheets(data).map((sheet) => ({
        key: sheet.name,
        title: resolveGroupTitle(sheet.name, t),
        items: sheet.rows
          .filter((row) => row.category !== "TOTAL")
          .map((row) => ({
            label: humanizeReportLabel(String(row.category ?? "—")),
            value: Number(row.count) || 0,
          })),
        total: sheet.total,
      }))
    : [];
  const tables = extractTables(data, (key) => resolveTableTitle(key, t));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("moduleTitle", { label })}
        actions={
          <>
            <Button href={`/c/${companyId}/reports`} variant="secondary">
              {t("title")}
            </Button>
            <ReportExportButtons
              companyId={companyId}
              kind="module"
              module={module}
              qs={qs}
            />
          </>
        }
      />

      <ReportFiltersForm
        companyId={companyId}
        actionPath={`/c/${companyId}/reports/modules/${module}`}
        employees={employees}
        defaults={filters}
      />

      {!data ? (
        <Card>
          <EmptyState message={t("moduleLoadError")} />
        </Card>
      ) : (
        <>
          {tables.length === 0 && classifications.length === 0 ? (
            <Card title={t("rows", { count: 0 })}>
              <EmptyState message={t("noRows")} />
            </Card>
          ) : null}

          {tables.map((table) => {
            const cols = Object.keys(table.rows[0] ?? {}).slice(0, 8);
            const related = classifications.filter((g) =>
              relatedClassificationKeys(table.key).includes(g.key),
            );
            return (
              <Card key={table.key} title={table.title}>
                {table.rows.length === 0 ? (
                  <EmptyState message={t("noRows")} />
                ) : (
                  <div className="space-y-1">
                    <div className="overflow-x-auto pb-1">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                            {cols.map((col) => (
                              <th key={col} className="px-2 py-2 font-medium">
                                {humanizeReportLabel(col)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.slice(0, 50).map((row, i) => (
                            <tr
                              key={`${table.key}-${i}`}
                              className="border-b border-[var(--color-border)] last:border-0"
                            >
                              {cols.map((col) => (
                                <td key={col} className="px-2 py-2">
                                  {formatCell(row[col], formatMoney)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {related.map((g) => (
                      <div
                        key={g.key}
                        className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-4 text-sm"
                      >
                        {g.items.map((item, idx) => (
                          <span
                            key={`${g.key}-${item.label}-${idx}`}
                            className="inline-flex items-baseline gap-1.5 text-[var(--muted-foreground)]"
                          >
                            {idx > 0 ? (
                              <span className="me-1 text-[var(--border)]" aria-hidden>
                                ·
                              </span>
                            ) : null}
                            <span>{item.label}:</span>
                            <span className="font-semibold tabular-nums text-[var(--foreground)]">
                              {formatNumber(item.value)}
                            </span>
                          </span>
                        ))}
                        <span className="inline-flex items-baseline gap-1.5 text-[var(--muted-foreground)]">
                          <span className="me-1 text-[var(--border)]" aria-hidden>
                            ·
                          </span>
                          <span>{t("total")}:</span>
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">
                            {formatNumber(g.total)}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}

          {classifications
            .filter(
              (g) =>
                !tables.some((table) =>
                  relatedClassificationKeys(table.key).includes(g.key),
                ),
            )
            .map((g) => (
              <Card key={g.key}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {g.items.map((item, idx) => (
                    <span
                      key={`${g.key}-${item.label}-${idx}`}
                      className="inline-flex items-baseline gap-1.5 text-[var(--muted-foreground)]"
                    >
                      {idx > 0 ? (
                        <span className="me-1 text-[var(--border)]" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span>{item.label}:</span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">
                        {formatNumber(item.value)}
                      </span>
                    </span>
                  ))}
                  <span className="inline-flex items-baseline gap-1.5 text-[var(--muted-foreground)]">
                    <span className="me-1 text-[var(--border)]" aria-hidden>
                      ·
                    </span>
                    <span>{t("total")}:</span>
                    <span className="font-semibold tabular-nums text-[var(--foreground)]">
                      {formatNumber(g.total)}
                    </span>
                  </span>
                </div>
              </Card>
            ))}
        </>
      )}
    </div>
  );
}

function relatedClassificationKeys(tableKey: string): string[] {
  const map: Record<string, string[]> = {
    employees: ["employeesByStatus"],
    leaves: ["leavesByStatus"],
    rows: ["invoicesByStatus", "quotesByStatus", "contactsByType", "contactsByStatus"],
    invoices: ["invoicesByStatus", "quotesByStatus"],
    purchaseOrders: ["ordersByStatus"],
    bills: ["billsByStatus"],
    projects: ["projectsByStatus", "tasksByStatus"],
    notes: ["notesByStatus", "notesByPriority"],
    rules: ["rulesByStatus"],
    runs: ["runsByStatus"],
    balances: ["movementsByType"],
    contacts: ["contactsByType", "contactsByStatus"],
    opportunities: ["opportunitiesByStatus"],
  };
  return map[tableKey] ?? [];
}

function extractTables(
  data: Record<string, unknown> | null,
  titleFor: (key: string) => string,
): RowTable[] {
  if (!data) return [];
  const out: RowTable[] = [];
  for (const key of ROW_KEYS) {
    const v = data[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      out.push({
        key,
        title: titleFor(key),
        rows: v as Array<Record<string, unknown>>,
      });
    }
  }
  return out;
}

function resolveGroupTitle(
  key: string,
  t: Awaited<ReturnType<typeof getTranslations<"reports">>>,
): string {
  const known = [
    "employeesByStatus",
    "leavesByStatus",
    "invoicesByStatus",
    "quotesByStatus",
    "ordersByStatus",
    "billsByStatus",
    "projectsByStatus",
    "tasksByStatus",
    "notesByStatus",
    "notesByPriority",
    "rulesByStatus",
    "runsByStatus",
    "opportunitiesByStatus",
    "contactsByType",
    "contactsByStatus",
    "movementsByType",
  ] as const;
  if ((known as readonly string[]).includes(key)) {
    return t(`groups.${key}` as "groups.employeesByStatus");
  }
  return humanizeReportLabel(key);
}

function resolveTableTitle(
  key: string,
  t: Awaited<ReturnType<typeof getTranslations<"reports">>>,
): string {
  const known = [
    "rows",
    "balances",
    "purchaseOrders",
    "bills",
    "employees",
    "leaves",
    "projects",
    "notes",
    "rules",
    "runs",
    "invoices",
    "contacts",
    "opportunities",
  ] as const;
  if ((known as readonly string[]).includes(key)) {
    return t(`tables.${key}` as "tables.employees");
  }
  return humanizeReportLabel(key);
}

function formatCell(
  value: unknown,
  money: (v: string | number | null | undefined) => string,
): string {
  if (value == null) return "—";
  if (typeof value === "object") {
    if ("name" in (value as object)) {
      return String((value as { name: unknown }).name);
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string" && /^[A-Z][A-Z0-9_]*$/.test(value)) {
    return humanizeReportLabel(value);
  }
  if (
    typeof value === "string" &&
    /^\d+(\.\d+)?$/.test(value) &&
    value.includes(".")
  ) {
    return money(value);
  }
  return String(value);
}
