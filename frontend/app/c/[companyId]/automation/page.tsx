import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { AutomationRuleBuilder } from "@/components/erp/AutomationRuleBuilder";
import { ActionForm } from "@/components/erp/ActionForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import {
  createRule,
  executeRule,
  installTemplate,
  installTemplatesBulk,
  setRuleStatus,
} from "./actions";

type Rule = {
  id: string;
  name: string;
  module: string;
  triggerEvent: string;
  status: string;
  scheduleCron: string | null;
  updatedAt: string;
};

type CompanyUser = {
  id: string;
  user: { id: string; fullName: string; email: string };
  role?: { code: string; name: string } | null;
};

type Catalog = {
  idea?: string;
  ideaAr?: string;
  modules: Record<string, string>;
  currentPhase: number;
  implementedActionTypes: string[];
  verification?: Array<{
    module: string;
    label?: string;
    labelAr: string;
    event: string;
  }>;
  triggers: Array<{
    event: string;
    module: string;
    label?: string;
    labelAr: string;
    description?: string;
    descriptionAr: string;
    phase: number;
  }>;
  actions: Array<{
    type: string;
    label?: string;
    labelAr: string;
    description?: string;
    descriptionAr: string;
    phase: number;
  }>;
  templates: Array<{
    code: string;
    module: string;
    name?: string;
    nameAr: string;
    description?: string;
    descriptionAr: string;
    phase: number;
  }>;
};

type Summary = {
  activeRules: number;
  totalRules: number;
  recentRuns: number;
  failedRuns: number;
};

const MODULE_ORDER = ["crm", "sales", "inventory", "hr", "work", "general"];

export default async function AutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("automation");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "automation.write");

  const [rules, users, catalog, summary] = await Promise.all([
    apiServer<Rule[]>(`/companies/${companyId}/automation/rules`, {
      companyId,
    }).catch(() => []),
    apiServer<CompanyUser[]>(`/companies/${companyId}/users`, {
      companyId,
    }).catch(() => []),
    apiServer<Catalog>(`/companies/${companyId}/automation/catalog`, {
      companyId,
    }).catch(() => null),
    apiServer<Summary>(`/companies/${companyId}/automation/summary`, {
      companyId,
    }).catch(() => null),
  ]);

  const create = createRule.bind(null, companyId);
  const modules = catalog?.modules ?? {};
  const availableTriggers = (catalog?.triggers ?? []).filter(
    (tr) => tr.phase <= (catalog?.currentPhase ?? 1),
  );
  const availableActions = (catalog?.actions ?? []).filter(
    (a) => a.phase <= (catalog?.currentPhase ?? 1),
  );
  const templatesByModule = groupBy(
    catalog?.templates ?? [],
    (tmpl) => tmpl.module,
  );
  const installedNames = new Set(rules.map((r) => r.name));
  const coveredEvents = new Set(rules.map((r) => r.triggerEvent));
  const userOptions = users.map((u) => ({
    value: u.user.id,
    label: `${u.user.fullName} (${u.user.email})`,
  }));

  const orderedModules = [
    ...MODULE_ORDER.filter((m) => templatesByModule[m]),
    ...Object.keys(templatesByModule).filter((m) => !MODULE_ORDER.includes(m)),
  ];

  const phase = catalog?.currentPhase ?? 5;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <form
                action={installTemplatesBulk.bind(null, companyId, null)}
                className="flex flex-wrap items-end gap-2"
              >
                <Select
                  name="assigneeUserId"
                  label={t("defaultAssignee")}
                  placeholder={t("optional")}
                  options={users.map((u) => ({
                    value: u.user.id,
                    label: u.user.fullName,
                  }))}
                />
                <Button type="submit" variant="secondary">
                  {t("activateAllTemplates")}
                </Button>
              </form>
            ) : null}
            <Button href={`/c/${companyId}/automation/runs`} variant="secondary">
              {t("runLog")}
            </Button>
          </div>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card className="border-[var(--border)] bg-gradient-to-l from-[var(--accent)]/40 to-transparent p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          {t("ideaHeading")}
        </p>
        <p className="mt-2 text-base font-medium leading-relaxed text-[var(--foreground)]">
          {t("ideaLine")}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
          {catalog?.idea ?? catalog?.ideaAr ?? t("ideaExample")}
        </p>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          {t("phaseComplete", { phase })}
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("activeRules")}
          value={formatNumber(summary?.activeRules ?? 0)}
        />
        <StatCard
          label={t("totalRules")}
          value={formatNumber(summary?.totalRules ?? 0)}
        />
        <StatCard
          label={t("runs")}
          value={formatNumber(summary?.recentRuns ?? 0)}
        />
        <StatCard
          label={t("failures")}
          value={formatNumber(summary?.failedRuns ?? 0)}
          trend={(summary?.failedRuns ?? 0) > 0 ? "down" : "neutral"}
        />
      </div>

      {catalog?.verification?.length ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">{t("verificationTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t("verificationHint")}
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.verification.map((item) => {
              const covered = coveredEvents.has(item.event);
              return (
                <li
                  key={`${item.module}-${item.event}-${item.label ?? item.labelAr}`}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border)]/70 px-3 py-2 text-sm"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      covered ? "bg-emerald-500" : "bg-[var(--muted-foreground)]/40"
                    }`}
                  />
                  <span>
                    <span className="font-medium">{item.label ?? item.labelAr}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                      {modules[item.module] ?? item.module} · {item.event}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {catalog ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {t("examplesByModule")}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orderedModules.map((mod) => {
              const items = templatesByModule[mod] ?? [];
              return (
                <Card key={mod} className="p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{modules[mod] ?? mod}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{items.length}</Badge>
                      {canWrite ? (
                        <form
                          action={installTemplatesBulk.bind(
                            null,
                            companyId,
                            mod,
                          )}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            {t("activateModuleTemplates")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                  <ul className="space-y-3 text-sm text-[var(--muted-foreground)]">
                    {items.map((tmpl) => {
                      const ready = tmpl.phase <= (catalog.currentPhase ?? 1);
                      const installed = installedNames.has(tmpl.nameAr);
                      return (
                        <li key={tmpl.code} className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                            <span>
                              <span className="font-medium text-[var(--foreground)]">
                                {tmpl.name ?? tmpl.nameAr}
                              </span>
                              {installed ? (
                                <Badge variant="secondary" className="ms-2">
                                  {t("installed")}
                                </Badge>
                              ) : null}
                              <span className="mt-0.5 block text-xs">
                                {tmpl.description ?? tmpl.descriptionAr}
                                {!ready ? (
                                  <Badge variant="outline" className="ms-2">
                                    {t("phaseBadge", { phase: tmpl.phase })}
                                  </Badge>
                                ) : null}
                              </span>
                            </span>
                          </div>
                          {canWrite && ready && !installed ? (
                            <form
                              action={installTemplate.bind(
                                null,
                                companyId,
                                tmpl.code,
                              )}
                              className="ms-3.5 flex flex-wrap items-end gap-2"
                            >
                              <Select
                                name="assigneeUserId"
                                label={t("assignee")}
                                placeholder={t("optional")}
                                options={users.map((u) => ({
                                  value: u.user.id,
                                  label: u.user.fullName,
                                }))}
                              />
                              <Button type="submit" size="sm">
                                {t("activateTemplate")}
                              </Button>
                            </form>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <CreateFormDialog
          title={t("newRuleTitle")}
          description={t("newRuleDesc")}
          triggerLabel={t("addRule")}
        >
          <AutomationRuleBuilder
            action={create}
            modules={Object.entries(modules).map(([value, label]) => ({
              value,
              label,
            }))}
            triggers={(availableTriggers.length
              ? availableTriggers
              : [{ event: "manual", labelAr: t("manualTrigger"), label: t("manualTrigger") }]
            ).map((tr) => ({
              event: tr.event,
              label: tr.label ?? tr.labelAr,
            }))}
            actions={availableActions.map((a) => ({
              type: a.type,
              label: a.label ?? a.labelAr,
            }))}
            users={userOptions}
          />
        </CreateFormDialog>
      ) : null}

      <Card>
        {rules.length === 0 ? (
          <EmptyState message={t("noRules")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("colName")}</th>
                  <th className="px-2 py-2 font-medium">{t("colModule")}</th>
                  <th className="px-2 py-2 font-medium">{t("colTrigger")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colUpdated")}</th>
                  <th className="px-2 py-2 font-medium">{t("colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-[var(--border)]/60 last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{rule.name}</td>
                    <td className="px-2 py-2">
                      {modules[rule.module] ?? rule.module}
                    </td>
                    <td className="px-2 py-2">
                      <p className="font-mono text-xs">{rule.triggerEvent}</p>
                      {rule.scheduleCron ? (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {rule.scheduleCron}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={rule.status} />
                    </td>
                    <td className="px-2 py-2">{formatDate(rule.updatedAt)}</td>
                    <td className="px-2 py-2">
                      {canWrite ? (
                        <div className="flex flex-wrap gap-1">
                          {rule.status !== "ACTIVE" ? (
                            <ActionForm
                              label={t("activate")}
                              action={setRuleStatus.bind(
                                null,
                                companyId,
                                rule.id,
                                "ACTIVE",
                              )}
                            />
                          ) : (
                            <ActionForm
                              label={t("pause")}
                              variant="ghost"
                              action={setRuleStatus.bind(
                                null,
                                companyId,
                                rule.id,
                                "PAUSED",
                              )}
                            />
                          )}
                          {rule.status === "ACTIVE" ? (
                            <ActionForm
                              label={t("execute")}
                              variant="primary"
                              confirm={t("confirmExecute")}
                              action={executeRule.bind(
                                null,
                                companyId,
                                rule.id,
                              )}
                            />
                          ) : null}
                          <Button
                            href={`/c/${companyId}/automation/runs?ruleId=${rule.id}`}
                            variant="ghost"
                            size="sm"
                          >
                            {t("log")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          href={`/c/${companyId}/automation/runs?ruleId=${rule.id}`}
                          variant="ghost"
                          size="sm"
                        >
                          {t("log")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}
