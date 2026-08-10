import Link from "next/link";
import {
  Boxes,
  ChartColumnIncreasing,
  CircleAlert,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { ReportFiltersForm } from "@/components/erp/ReportFiltersForm";
import { ReportExportButtons } from "@/components/erp/ReportExportButtons";
import {
  DistributionPieChart,
  GroupedBarChart,
  RankingBarChart,
  RevenueAreaChart,
} from "@/components/charts/ErpCharts";
import { apiServer } from "@/lib/api/server";
import { buildQuery, REPORT_MODULES } from "@/lib/erp/reports";
import { toNumber, getFormatters } from "@/lib/format-server";

type ExecutiveReport = {
  currency: string;
  kpis: {
    totalSales: string;
    totalProfit: string;
    totalExpenses: string;
    customerCount: number;
    invoiceCount: number;
    unpaidInvoiceCount: number;
    balanceDue: string;
  };
  bestProducts: Array<{ name: string; revenue: string }>;
  bestEmployees: Array<{ name: string; revenue: string }>;
  inventoryStatus: {
    ok: number;
    low: number;
    outOfStock: number;
    stockValue: string;
  };
  projectStatus: {
    byStatus: Record<string, number>;
    total: number;
  };
};

type Employee = { id: string; fullName: string; employeeNumber: string };

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    employeeId?: string;
    limit?: string;
  }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("reports");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const filters = await searchParams;
  const qs = buildQuery(filters);

  const [report, employees] = await Promise.all([
    apiServer<ExecutiveReport>(
      `/companies/${companyId}/reports/executive${qs}`,
      { companyId },
    ).catch(() => null),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  const productChart =
    report?.bestProducts.map((p) => ({
      name: p.name,
      value: toNumber(p.revenue),
    })) ?? [];
  const employeeChart =
    report?.bestEmployees.map((p) => ({
      name: p.name,
      value: toNumber(p.revenue),
    })) ?? [];
  const inventoryPie = report
    ? [
        { name: t("stockOk"), value: report.inventoryStatus.ok },
        { name: t("stockLow"), value: report.inventoryStatus.low },
        { name: t("stockOut"), value: report.inventoryStatus.outOfStock },
      ]
    : [];
  const financeBars = report
    ? [
        {
          name: t("summary"),
          sales: toNumber(report.kpis.totalSales),
          profit: toNumber(report.kpis.totalProfit),
          expenses: toNumber(report.kpis.totalExpenses),
          due: toNumber(report.kpis.balanceDue),
        },
      ]
    : [];
  const projectPie = report
    ? Object.entries(report.projectStatus.byStatus).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <ReportExportButtons
            companyId={companyId}
            kind="executive"
            qs={qs}
          />
        }
      />

      <ReportFiltersForm
        companyId={companyId}
        actionPath={`/c/${companyId}/reports`}
        employees={employees}
        defaults={filters}
      />

      <Card title={t("moduleReports")} description={t("moduleReportsDesc")}>
        <div className="flex flex-wrap gap-2">
          {REPORT_MODULES.map((m) => (
            <Link
              key={m.value}
              href={`/c/${companyId}/reports/modules/${m.value}${qs}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5 text-sm transition hover:border-[var(--primary)] hover:bg-[var(--card)]"
            >
              {t(`modules.${m.value}` as "modules.sales")}
            </Link>
          ))}
        </div>
      </Card>

      {!report ? (
        <Card>
          <EmptyState message={t("loadError")} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t("totalSales")}
              value={formatMoney(report.kpis.totalSales, report.currency)}
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label={t("approxProfit")}
              value={formatMoney(report.kpis.totalProfit, report.currency)}
              trend="neutral"
              icon={<ChartColumnIncreasing className="h-5 w-5" />}
            />
            <StatCard
              label={t("expenses")}
              value={formatMoney(report.kpis.totalExpenses, report.currency)}
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label={t("balanceDue")}
              value={formatMoney(report.kpis.balanceDue, report.currency)}
              hint={t("unpaidInvoicesHint", {
                count: formatNumber(report.kpis.unpaidInvoiceCount),
              })}
              trend="down"
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label={t("customers")}
              value={formatNumber(report.kpis.customerCount)}
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label={t("invoices")}
              value={formatNumber(report.kpis.invoiceCount)}
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label={t("unpaid")}
              value={formatNumber(report.kpis.unpaidInvoiceCount)}
              icon={<CircleAlert className="h-5 w-5" />}
            />
            <StatCard
              label={t("stockValue")}
              value={formatMoney(
                report.inventoryStatus.stockValue,
                report.currency,
              )}
              icon={<Boxes className="h-5 w-5" />}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title={t("productRevenueTrend")}
              description={t("productRevenueDesc")}
            >
              <RevenueAreaChart data={productChart} />
            </Card>
            <Card
              title={t("inventoryStatus")}
              description={t("inventoryStatusDesc", {
                count:
                  report.inventoryStatus.ok +
                  report.inventoryStatus.low +
                  report.inventoryStatus.outOfStock,
              })}
            >
              <DistributionPieChart data={inventoryPie} />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card title={t("financeCompare")}>
              <GroupedBarChart
                data={financeBars}
                keys={[
                  {
                    key: "sales",
                    label: t("chartSales"),
                    color: "var(--chart-1)",
                  },
                  {
                    key: "profit",
                    label: t("chartProfit"),
                    color: "var(--chart-2)",
                  },
                  {
                    key: "expenses",
                    label: t("chartExpenses"),
                    color: "var(--chart-4)",
                  },
                  {
                    key: "due",
                    label: t("chartDue"),
                    color: "var(--chart-3)",
                  },
                ]}
              />
            </Card>
            <Card
              title={t("projectStatus")}
              description={t("projectTotal", {
                count: report.projectStatus.total,
              })}
            >
              <DistributionPieChart data={projectPie} />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card
              className="overflow-hidden"
              title={t("bestProducts")}
              description={t("bestProductsDesc")}
            >
              <RankingBarChart
                data={productChart.slice(0, 5)}
                color="var(--chart-1)"
              />
            </Card>
            <Card
              className="overflow-hidden"
              title={t("bestEmployees")}
              description={t("bestEmployeesDesc")}
            >
              <RankingBarChart
                data={employeeChart.slice(0, 5)}
                color="var(--chart-2)"
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
