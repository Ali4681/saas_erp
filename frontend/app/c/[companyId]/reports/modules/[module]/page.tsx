import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportFiltersForm } from "@/components/erp/ReportFiltersForm";
import { ReportExportButtons } from "@/components/erp/ReportExportButtons";
import { apiServer } from "@/lib/api/server";
import { buildQuery, REPORT_MODULES } from "@/lib/erp/reports";
import { getFormatters } from "@/lib/format-server";

type Employee = { id: string; fullName: string; employeeNumber: string };

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
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
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

  const rows = extractRows(data);
  const groups = extractGroups(data, {
    unspecified: (n) => t("unspecified", { n }),
    summary: t("summary"),
    itemCount: t("itemCount"),
  });

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
          {groups.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((g) => (
                <Card key={g.title} title={g.title}>
                  <ul className="space-y-2 text-sm">
                    {g.items.map((item, idx) => (
                      <li
                        key={`${g.title}-${item.label}-${idx}`}
                        className="flex justify-between gap-2"
                      >
                        <span>{item.label}</span>
                        <span className="font-medium">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          ) : null}

          <Card title={t("rows", { count: rows.length })}>
            {rows.length === 0 ? (
              <EmptyState message={t("noRows")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                      {Object.keys(rows[0])
                        .slice(0, 8)
                        .map((col) => (
                          <th key={col} className="px-2 py-2 font-medium">
                            {col}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 50).map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        {Object.keys(rows[0])
                          .slice(0, 8)
                          .map((col) => (
                            <td key={col} className="px-2 py-2">
                              {formatCell(row[col], formatMoney)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function extractRows(
  data: Record<string, unknown> | null,
): Array<Record<string, unknown>> {
  if (!data) return [];
  for (const key of [
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
  ]) {
    const v = data[key];
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      return v as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function extractGroups(
  data: Record<string, unknown> | null,
  labels: {
    unspecified: (n: number) => string;
    summary: string;
    itemCount: string;
  },
): Array<{ title: string; items: Array<{ label: string; value: string }> }> {
  if (!data) return [];
  const out: Array<{
    title: string;
    items: Array<{ label: string; value: string }>;
  }> = [];
  for (const [key, value] of Object.entries(data)) {
    if (
      key.endsWith("ByStatus") ||
      key.endsWith("ByType") ||
      key.endsWith("ByPriority") ||
      key === "movementsByType"
    ) {
      if (Array.isArray(value)) {
        out.push({
          title: key,
          items: value.map((row, idx) => {
            const r = row as Record<string, unknown>;
            const statusKey =
              Object.keys(r).find((k) =>
                [
                  "status",
                  "employmentStatus",
                  "movementType",
                  "priority",
                  "type",
                ].includes(k),
              ) ?? Object.keys(r).find((k) => k !== "_count" && k !== "count");
            const rawLabel = statusKey ? r[statusKey] : null;
            const count =
              typeof r._count === "number"
                ? r._count
                : typeof r._count === "object" && r._count
                  ? JSON.stringify(r._count)
                  : (r.count ?? "—");
            return {
              label: String(rawLabel ?? labels.unspecified(idx + 1)),
              value: String(count),
            };
          }),
        });
      }
    }
    if (key === "itemCount" && typeof value === "number") {
      out.push({
        title: labels.summary,
        items: [{ label: labels.itemCount, value: String(value) }],
      });
    }
  }
  return out;
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
  if (
    typeof value === "string" &&
    /^\d+(\.\d+)?$/.test(value) &&
    value.includes(".")
  ) {
    return money(value);
  }
  return String(value);
}
