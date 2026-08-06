import Link from "next/link";
import {
  Bell,
  Brain,
  ChartColumnIncreasing,
  Boxes,
  ClipboardList,
  Handshake,
  Megaphone,
  NotebookPen,
  Paperclip,
  Plug,
  Receipt,
  Shield,
  ShoppingCart,
  Users,
  Wallet,
  Workflow,
  ArrowUpLeft,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";
import { can, roleKey } from "@/lib/permissions";
import { apiServer } from "@/lib/api/server";
import { companyLogoUrl } from "@/lib/company-logo";
import { toNumber, getFormatters } from "@/lib/format-server";
import { COMPANY_CHANNEL_SECTIONS } from "@/lib/integrations";
import {
  DistributionPieChart,
  GroupedBarChart,
  RevenueAreaChart,
} from "@/components/charts/ErpCharts";

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

const tileMeta: Record<
  string,
  { icon: typeof Handshake; tone: string }
> = {
  crm: {
    icon: Handshake,
    tone: "bg-[var(--primary)]/15 text-[var(--primary)]",
  },
  sales: {
    icon: Receipt,
    tone: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  },
  purchasing: {
    icon: ShoppingCart,
    tone: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  inventory: {
    icon: Boxes,
    tone: "bg-[var(--chart-2)]/20 text-[var(--primary)]",
  },
  finance: {
    icon: Wallet,
    tone: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  },
  hr: {
    icon: Users,
    tone: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-300",
  },
  work: {
    icon: ClipboardList,
    tone: "bg-slate-500/15 text-slate-800 dark:text-slate-300",
  },
  notebook: {
    icon: NotebookPen,
    tone: "bg-lime-500/15 text-lime-800 dark:text-lime-300",
  },
  marketing: {
    icon: Megaphone,
    tone: "bg-rose-500/15 text-rose-800 dark:text-rose-300",
  },
  ai: {
    icon: Brain,
    tone: "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  },
  reports: {
    icon: ChartColumnIncreasing,
    tone: "bg-[var(--primary)]/15 text-[var(--primary)]",
  },
  automation: {
    icon: Workflow,
    tone: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
  },
  integrations: {
    icon: Plug,
    tone: "bg-blue-500/15 text-blue-800 dark:text-blue-300",
  },
  attachments: {
    icon: Paperclip,
    tone: "bg-stone-500/15 text-stone-800 dark:text-stone-300",
  },
  audit: {
    icon: Shield,
    tone: "bg-zinc-500/15 text-zinc-800 dark:text-zinc-300",
  },
  notifications: {
    icon: Bell,
    tone: "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-300",
  },
};

const CHANNEL_I18N: Record<
  string,
  { label: "delivery" | "installments" | "stores"; desc: "deliveryDesc" | "installmentsDesc" | "storesDesc" }
> = {
  delivery: { label: "delivery", desc: "deliveryDesc" },
  installments: { label: "installments", desc: "installmentsDesc" },
  stores: { label: "stores", desc: "storesDesc" },
};

export default async function CompanyHomePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await getSession();
  const user = session?.user;
  const t = await getTranslations("home");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const tRoles = await getTranslations("roles");

  const company = await apiServer<{
    displayName: string;
    logoAttachmentId?: string | null;
  }>(`/companies/${companyId}`, { companyId }).catch(() => null);

  let unread = 0;
  if (user && can(user, "notifications.read")) {
    try {
      const data = await apiServer<{ count: number }>(
        `/companies/${companyId}/notifications/unread-count`,
        { companyId },
      );
      unread = data.count;
    } catch {
      unread = 0;
    }
  }

  const report = can(user, "reports.read")
    ? await apiServer<ExecutiveReport>(
        `/companies/${companyId}/reports/executive`,
        { companyId },
      ).catch(() => null)
    : null;

  const tileDefs = [
    { key: "crm", href: `/c/${companyId}/crm`, perm: "crm.read" },
    { key: "sales", href: `/c/${companyId}/sales`, perm: "sales.read" },
    { key: "purchasing", href: `/c/${companyId}/purchasing`, perm: "purchasing.read" },
    { key: "inventory", href: `/c/${companyId}/inventory`, perm: "inventory.read" },
    { key: "finance", href: `/c/${companyId}/finance`, perm: "finance.read" },
    { key: "hr", href: `/c/${companyId}/hr`, perm: "hr.read" },
    { key: "work", href: `/c/${companyId}/work`, perm: "work.read" },
    { key: "notebook", href: `/c/${companyId}/notebook`, perm: "notebook.read" },
    { key: "marketing", href: `/c/${companyId}/marketing`, perm: "marketing.read" },
    { key: "ai", href: `/c/${companyId}/ai`, perm: "ai.read" },
    { key: "reports", href: `/c/${companyId}/reports`, perm: "reports.read" },
    { key: "automation", href: `/c/${companyId}/automation`, perm: "automation.read" },
    { key: "integrations", href: `/c/${companyId}/integrations`, perm: "integrations.read" },
    { key: "attachments", href: `/c/${companyId}/attachments`, perm: "attachments.read" },
    { key: "audit", href: `/c/${companyId}/audit`, perm: "audit.read" },
    { key: "notifications", href: `/c/${companyId}/notifications`, perm: "notifications.read" },
  ] as const;

  const tiles = tileDefs
    .filter((tile) => can(user, tile.perm))
    .map((tile) => {
      const label = t(`tiles.${tile.key}` as "tiles.crm");
      const hint =
        tile.key === "notifications"
          ? unread > 0
            ? t("unreadHint", { count: unread })
            : t("notifInbox")
          : t(`tiles.${tile.key}Hint` as "tiles.crmHint");
      return { ...tile, label, hint };
    });

  const productTrend =
    report?.bestProducts.slice(0, 6).map((p) => ({
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
          name: t("chartPerformance"),
          sales: toNumber(report.kpis.totalSales),
          profit: toNumber(report.kpis.totalProfit),
          expenses: toNumber(report.kpis.totalExpenses),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={company?.displayName ?? t("titleFallback")}
        description={t("welcome", {
          name: user?.fullName ?? "",
          role: tRoles(roleKey(user)),
        })}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {company?.logoAttachmentId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={companyLogoUrl(companyId, company.logoAttachmentId) ?? ""}
                alt={company.displayName}
                className="h-12 w-12 rounded-xl border border-[var(--border)] object-cover shadow-sm"
              />
            ) : null}
            {can(user, "reports.read") ? (
              <Button href={`/c/${companyId}/reports`} variant="secondary">
                <ChartColumnIncreasing className="h-4 w-4" />
                {t("openReports")}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("unreadNotifications")}
          value={formatNumber(unread)}
          hint={unread > 0 ? t("needsFollowUp") : t("inboxEmpty")}
          trend={unread > 0 ? "down" : "neutral"}
          icon={<Bell className="h-5 w-5" />}
        />
        {report ? (
          <>
            <StatCard
              label={t("totalSales")}
              value={formatMoney(report.kpis.totalSales, report.currency)}
              hint={t("invoiceCount", {
                count: formatNumber(report.kpis.invoiceCount),
              })}
              icon={<Receipt className="h-5 w-5" />}
            />
            <StatCard
              label={t("approxProfit")}
              value={formatMoney(report.kpis.totalProfit, report.currency)}
              hint={t("profitHint")}
              trend="neutral"
              icon={<Wallet className="h-5 w-5" />}
            />
            <StatCard
              label={t("stockValue")}
              value={formatMoney(report.inventoryStatus.stockValue, report.currency)}
              hint={t("lowItems", { count: report.inventoryStatus.low })}
              icon={<Boxes className="h-5 w-5" />}
            />
          </>
        ) : (
          <StatCard
            label={t("availableModules")}
            value={formatNumber(tiles.length)}
            hint={t("byYourPermissions")}
            icon={<ArrowUpLeft className="h-5 w-5" />}
          />
        )}
      </div>

      {can(user, "integrations.read") ? (
        <div>
          <div className="mb-3">
            <h2 className="text-base font-semibold">{t("opsSections")}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("opsSectionsHint")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {COMPANY_CHANNEL_SECTIONS.map((section) => {
              const keys = CHANNEL_I18N[section.slug];
              return (
                <Link
                  key={section.code}
                  href={`/c/${companyId}/channels/${section.slug}`}
                  className="group"
                >
                  <Card className="h-full p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--primary)] group-hover:shadow-[0_14px_30px_rgba(15,23,32,0.08)]">
                    <p className="text-lg font-semibold">
                      {keys ? t(`channels.${keys.label}`) : section.label}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {keys ? t(`channels.${keys.desc}`) : section.description}
                    </p>
                    <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                      {t("providerCount", { count: section.providers.length })}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {report ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={t("bestProducts")}
            description={t("bestProductsDesc")}
          >
            <RevenueAreaChart data={productTrend} />
          </Card>
          <Card title={t("inventoryStatus")} description={t("inventoryStatusDesc")}>
            <DistributionPieChart data={inventoryPie} />
          </Card>
          <Card
            className="xl:col-span-2"
            title={t("financeSummary")}
            description={t("financeSummaryDesc")}
          >
            <GroupedBarChart
              data={financeBars}
              keys={[
                { key: "sales", label: t("chartSales"), color: "var(--chart-1)" },
                { key: "profit", label: t("chartProfit"), color: "var(--chart-2)" },
                {
                  key: "expenses",
                  label: t("chartExpenses"),
                  color: "var(--chart-4)",
                },
              ]}
            />
          </Card>
          <Card
            title={t("projects")}
            description={t("projectsTotal", { count: report.projectStatus.total })}
          >
            <ul className="space-y-3">
              {Object.entries(report.projectStatus.byStatus).map(
                ([status, count]) => (
                  <li
                    key={status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <Badge variant="outline">{status}</Badge>
                    <span className="font-semibold">{count}</span>
                  </li>
                ),
              )}
              {Object.keys(report.projectStatus.byStatus).length === 0 ? (
                <li className="text-sm text-[var(--muted-foreground)]">
                  {t("noProjectsYet")}
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      ) : null}

      {tiles.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">{t("noModules")}</p>
        </Card>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("modules")}</h2>
            <Badge variant="secondary">
              {t("moduleCount", { count: tiles.length })}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tiles.map((tile, index) => {
              const meta = tileMeta[tile.key] ?? {
                icon: SparklesFallback,
                tone: "bg-[var(--secondary)] text-[var(--foreground)]",
              };
              const Icon = meta.icon;
              return (
                <Link
                  key={tile.href}
                  href={tile.href}
                  className="group animate-fade-up"
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                >
                  <Card className="h-full p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--primary)] group-hover:shadow-[0_14px_30px_rgba(15,23,32,0.08)]">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.tone}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{tile.label}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                          {tile.hint}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SparklesFallback(props: { className?: string }) {
  return <ChartColumnIncreasing {...props} />;
}
