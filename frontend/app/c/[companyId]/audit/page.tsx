import {
  Activity,
  Filter,
  Pencil,
  Plus,
  UserRound,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { AccessDenied } from "@/components/erp/AccessDenied";
import {
  DistributionPieChart,
  RankingBarChart,
} from "@/components/charts/ErpCharts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { buildQuery } from "@/lib/erp/reports";

type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityName?: string | null;
  module: string | null;
  operation: string | null;
  createdAt: string;
  actor?: { fullName: string; email: string } | null;
};

const KNOWN_OPS = new Set([
  "CREATE",
  "UPDATE",
  "DELETE",
  "READ",
  "LOGIN",
  "LOGOUT",
  "SUSPEND",
  "CANCEL",
  "RENEW",
  "OTHER",
]);

const KNOWN_MODULES = new Set([
  "sales",
  "crm",
  "purchasing",
  "inventory",
  "finance",
  "hr",
  "work",
  "notebook",
  "automation",
  "marketing",
  "ai",
  "reports",
  "messaging",
  "payments",
  "integrations",
  "departments",
  "subscriptions",
  "audit",
  "attachments",
  "notifications",
  "companies",
  "users",
  "auth",
  "platform",
  "sandbox",
  "general",
]);

const KNOWN_ENTITIES = new Set([
  "subscription",
  "company",
  "plan",
  "user",
  "invoice",
  "contact",
  "opportunity",
  "product",
  "employee",
  "project",
  "note",
  "warehouse",
  "account",
  "company_department",
  "http_request",
  "sales",
  "crm",
  "ai",
]);

const MODULE_PATH_RULES: Array<{ re: RegExp; module: string }> = [
  { re: /\/sales(\/|$)/i, module: "sales" },
  { re: /\/crm(\/|$)/i, module: "crm" },
  { re: /\/purchasing(\/|$)/i, module: "purchasing" },
  { re: /\/inventory(\/|$)/i, module: "inventory" },
  { re: /\/finance(\/|$)/i, module: "finance" },
  { re: /\/hr(\/|$)/i, module: "hr" },
  { re: /\/work(\/|$)/i, module: "work" },
  { re: /\/notebook(\/|$)/i, module: "notebook" },
  { re: /\/automation(\/|$)/i, module: "automation" },
  { re: /\/marketing(\/|$)/i, module: "marketing" },
  { re: /\/ai(\/|$)/i, module: "ai" },
  { re: /\/reports(\/|$)/i, module: "reports" },
  { re: /\/messaging(\/|$)/i, module: "messaging" },
  { re: /\/payment-methods|\/payment-gateways/i, module: "payments" },
  { re: /\/projects|\/integration|\/webhooks|\/mirrors/i, module: "integrations" },
  { re: /\/departments(\/|$)/i, module: "departments" },
  { re: /\/subscriptions(\/|$)/i, module: "subscriptions" },
  { re: /\/audit-logs(\/|$)/i, module: "audit" },
  { re: /\/attachments(\/|$)/i, module: "attachments" },
  { re: /\/notifications(\/|$)/i, module: "notifications" },
  { re: /\/companies(\/|$)/i, module: "companies" },
  { re: /\/users(\/|$)/i, module: "users" },
  { re: /\/auth(\/|$)/i, module: "auth" },
  { re: /\/sandbox(\/|$)/i, module: "sandbox" },
];

type TranslateFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function opLabel(t: TranslateFn, op: string | null | undefined) {
  if (!op) return "—";
  const key = op.toUpperCase();
  if (KNOWN_OPS.has(key)) return t(`operations.${key}`);
  return op;
}

function moduleLabel(t: TranslateFn, moduleName: string | null | undefined) {
  if (!moduleName) return "—";
  const key = moduleName.toLowerCase();
  if (KNOWN_MODULES.has(key)) return t(`modules.${key}`);
  return moduleName;
}

function entityTypeLabel(t: TranslateFn, type: string | null | undefined) {
  if (!type) return "—";
  const key = type.toLowerCase();
  if (KNOWN_ENTITIES.has(key)) return t(`entities.${key}`);
  return type;
}

function operationVariant(
  op: string | null | undefined,
): "success" | "warning" | "danger" | "info" | "secondary" {
  const key = (op ?? "").toUpperCase();
  if (key === "CREATE" || key === "RENEW") return "success";
  if (key === "UPDATE" || key === "SUSPEND") return "warning";
  if (key === "DELETE" || key === "CANCEL") return "danger";
  if (key === "READ" || key === "LOGIN") return "info";
  return "secondary";
}

/** Legacy rows look like: `POST /companies/:id/...` */
function parseLegacyHttpAction(action: string | null | undefined) {
  if (!action) return null;
  const match = action.match(
    /^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i,
  );
  if (!match) return null;
  const method = match[1].toUpperCase();
  const path = match[2];
  const operation =
    method === "POST"
      ? path.includes("/auth/login")
        ? "LOGIN"
        : path.includes("/auth/logout")
          ? "LOGOUT"
          : "CREATE"
      : method === "DELETE"
        ? "DELETE"
        : "UPDATE";
  let moduleName = "platform";
  for (const rule of MODULE_PATH_RULES) {
    if (rule.re.test(path)) {
      moduleName = rule.module;
      break;
    }
  }
  return { operation, module: moduleName };
}

function parseOperation(row: AuditRow) {
  if (row.operation && KNOWN_OPS.has(row.operation.toUpperCase())) {
    return row.operation.toUpperCase();
  }
  const legacy = parseLegacyHttpAction(row.action);
  if (legacy) return legacy.operation;

  const fromAction = row.action?.split(":")[0]?.toUpperCase() ?? "";
  if (KNOWN_OPS.has(fromAction)) return fromAction;
  return "OTHER";
}

function parseModule(row: AuditRow) {
  if (row.module && KNOWN_MODULES.has(row.module.toLowerCase())) {
    return row.module.toLowerCase();
  }
  if (row.module) return row.module.toLowerCase();

  const legacy = parseLegacyHttpAction(row.action);
  if (legacy) return legacy.module;

  const parts = row.action?.split(":") ?? [];
  if (parts.length >= 2 && KNOWN_OPS.has(parts[0].toUpperCase())) {
    return parts[1].toLowerCase();
  }
  return "general";
}

function entityDisplay(t: TranslateFn, row: AuditRow) {
  if (row.entityName?.trim()) return row.entityName.trim();
  return entityTypeLabel(t, row.entityType);
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    module?: string;
    operation?: string;
    entityType?: string;
    limit?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const { companyId } = await params;
  const filters = await searchParams;
  const t = await getTranslations("audit");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();

  if (!can(session?.user, "audit.read")) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <AccessDenied />
      </div>
    );
  }

  const qs = buildQuery({
    from: filters.from,
    to: filters.to,
    module: filters.module,
    operation: filters.operation,
    entityType: filters.entityType,
    limit: filters.limit ?? "100",
  });

  const rows = await apiServer<AuditRow[]>(
    `/companies/${companyId}/audit-logs${qs}`,
    { companyId },
  ).catch(() => []);

  const creates = rows.filter((r) => parseOperation(r) === "CREATE").length;
  const updates = rows.filter((r) => parseOperation(r) === "UPDATE").length;
  const deletes = rows.filter((r) => parseOperation(r) === "DELETE").length;
  const actors = new Set(
    rows.map((r) => r.actor?.email ?? r.actor?.fullName ?? "system"),
  ).size;

  const byModuleMap = rows.reduce<Record<string, number>>((acc, row) => {
    const key = parseModule(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const byModule = Object.entries(byModuleMap)
    .map(([name, value]) => ({ name: moduleLabel(t, name), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const byOpMap = rows.reduce<Record<string, number>>((acc, row) => {
    const key = parseOperation(row);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const byOperation = Object.entries(byOpMap)
    .map(([name, value]) => ({
      name: opLabel(t, name),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          session?.user?.isPlatformAdmin ? (
            <Button
              href={`/platform/companies/${companyId}`}
              variant="secondary"
            >
              {t("companyInPlatform")}
            </Button>
          ) : null
        }
      />
      <FlashFromSearch searchParams={filters} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalEvents")}
          value={formatNumber(rows.length)}
          hint={t("lastNRecords", { count: filters.limit ?? "100" })}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label={t("creates")}
          value={formatNumber(creates)}
          trend="up"
          icon={<Plus className="h-5 w-5" />}
        />
        <StatCard
          label={t("updatesDeletes")}
          value={formatNumber(updates + deletes)}
          hint={t("updatesDeletesHint", {
            updates: formatNumber(updates),
            deletes: formatNumber(deletes),
          })}
          icon={<Pencil className="h-5 w-5" />}
        />
        <StatCard
          label={t("actors")}
          value={formatNumber(actors)}
          icon={<UserRound className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={t("byModule")}
          description={t("byModuleDesc")}
        >
          <RankingBarChart data={byModule} color="var(--chart-1)" />
        </Card>
        <Card title={t("opTypes")} description={t("opTypesDesc")}>
          <DistributionPieChart data={byOperation} />
        </Card>
      </div>

      <Card title={t("filterTitle")} description={t("filterDesc")}>
        <form
          method="get"
          className="grid gap-3 md:grid-cols-3 lg:grid-cols-6"
        >
          <Input
            name="from"
            label={t("from")}
            type="date"
            defaultValue={filters.from ?? ""}
          />
          <Input
            name="to"
            label={t("to")}
            type="date"
            defaultValue={filters.to ?? ""}
          />
          <Input
            name="module"
            label={t("module")}
            placeholder={t("modulePlaceholder")}
            defaultValue={filters.module ?? ""}
          />
          <Select
            name="operation"
            label={t("operation")}
            defaultValue={filters.operation ?? ""}
            placeholder={t("all")}
            options={[
              { value: "CREATE", label: t("operations.CREATE") },
              { value: "UPDATE", label: t("operations.UPDATE") },
              { value: "DELETE", label: t("operations.DELETE") },
              { value: "SUSPEND", label: t("operations.SUSPEND") },
              { value: "CANCEL", label: t("operations.CANCEL") },
              { value: "RENEW", label: t("operations.RENEW") },
            ]}
          />
          <Input
            name="entityType"
            label={t("entityType")}
            placeholder={t("entityTypePlaceholder")}
            defaultValue={filters.entityType ?? ""}
          />
          <Input
            name="limit"
            label={t("limit")}
            defaultValue={filters.limit ?? "100"}
          />
          <div className="flex items-end gap-2 md:col-span-3 lg:col-span-6">
            <Button type="submit" variant="secondary">
              <Filter className="h-4 w-4" />
              {t("applyFilter")}
            </Button>
            <Button href={`/c/${companyId}/audit`} variant="ghost">
              {t("clear")}
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title={t("eventsTitle")}
        description={t("eventsDesc", { count: formatNumber(rows.length) })}
      >
        {rows.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-3 py-2 font-medium">{t("colTime")}</th>
                  <th className="px-3 py-2 font-medium">{t("colActor")}</th>
                  <th className="px-3 py-2 font-medium">{t("colAction")}</th>
                  <th className="px-3 py-2 font-medium">{t("colModule")}</th>
                  <th className="px-3 py-2 font-medium">{t("colEntity")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const operation = parseOperation(r);
                  const moduleName = parseModule(r);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {r.actor?.fullName ?? t("system")}
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {r.actor?.email ?? ""}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={operationVariant(operation)}>
                          {opLabel(t, operation)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline">
                          {moduleLabel(t, moduleName)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{entityDisplay(t, r)}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {entityTypeLabel(t, r.entityType)}
                        </p>
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
