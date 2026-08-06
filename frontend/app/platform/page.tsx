import Link from "next/link";
import {
  Activity,
  Building2,
  Database,
  Package,
  ShieldCheck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PermissionGate } from "@/components/auth/PermissionGate";
import {
  DistributionPieChart,
  GroupedBarChart,
} from "@/components/charts/ErpCharts";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { nestFetch } from "@/lib/api/client";

type Company = { id: string; displayName: string; slug: string; status: string };
type Plan = { code: string; name: string; price: string };

export default async function PlatformHomePage() {
  const t = await getTranslations("platform");
  const session = await getSession();
  const companies = await apiServer<Company[]>("/companies").catch(() => []);
  const plans = await apiServer<Plan[]>("/plans").catch(() => []);

  const [health, healthDb] = await Promise.all([
    nestFetch<{ status: string }>("/health").catch(() => null),
    nestFetch<{ status: string; database?: string }>("/health/db").catch(
      () => null,
    ),
  ]);

  const statusCounts = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusPie = Object.entries(statusCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const planBars = plans.slice(0, 6).map((p) => ({
    name: p.code || p.name,
    price: Number(p.price) || 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("homeTitle")} description={t("homeDesc")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="API"
          value={<StatusBadge status={health?.status === "ok" ? "ACTIVE" : "ERROR"} />}
          hint={health?.status === "ok" ? t("apiOk") : t("apiDown")}
          icon={<Activity className="h-5 w-5" />}
          className={health?.status === "ok" ? "" : "ring-1 ring-red-200"}
        />
        <StatCard
          label={t("database")}
          value={
            <StatusBadge
              status={healthDb?.database === "up" ? "ACTIVE" : "ERROR"}
            />
          }
          hint={healthDb?.database === "up" ? t("dbUp") : t("dbDown")}
          icon={<Database className="h-5 w-5" />}
        />
        <StatCard
          label={t("companies")}
          value={companies.length}
          hint={t("statusVariants", { count: statusPie.length })}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label={t("plans")}
          value={plans.length}
          hint={t("plansHint")}
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={t("statusDistribution")}
          description={t("statusDistributionDesc")}
        >
          {statusPie.length ? (
            <DistributionPieChart data={statusPie} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("noCompaniesYet")}
            </p>
          )}
        </Card>
        <Card title={t("planPrices")} description={t("planPricesDesc")}>
          {planBars.length ? (
            <GroupedBarChart
              data={planBars}
              keys={[{ key: "price", label: t("price"), color: "var(--chart-1)" }]}
            />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
              {t("noPlans")}
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title={t("companies")} description={t("companiesCardDesc")}>
          <PermissionGate user={session?.user} permissions={["companies.read"]}>
            <div className="flex flex-wrap items-center gap-2">
              <Button href="/platform/companies" variant="secondary" size="sm">
                <Building2 className="h-4 w-4" />
                {t("viewCompanies")}
              </Button>
              <Badge variant="secondary">{companies.length}</Badge>
            </div>
          </PermissionGate>
        </Card>
        <Card title={t("plans")} description={t("plansCardDesc")}>
          <PermissionGate user={session?.user} permissions={["plans.read"]}>
            <Button href="/platform/plans" variant="secondary" size="sm">
              <Package className="h-4 w-4" />
              {t("viewPlans")}
            </Button>
          </PermissionGate>
        </Card>
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{t("opsTitle")}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {t("opsDesc")}
            </p>
            <Link
              href="/platform/companies"
              className="mt-2 inline-block text-sm text-[var(--primary)] underline-offset-4 hover:underline"
            >
              {t("startFromCompanies")}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
