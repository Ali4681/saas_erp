import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type ActionResult = {
  type?: string;
  ok?: boolean;
  skipped?: boolean;
  reason?: string;
};

type RunResult = {
  event?: string;
  summaryAr?: string;
  actions?: ActionResult[];
};

type Run = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  triggerEntityType: string | null;
  triggerEntityId: string | null;
  errorMessage: string | null;
  result: RunResult | null;
  automationRuleId: string;
  rule?: {
    id: string;
    name: string;
    module: string;
    triggerEvent: string;
  } | null;
};

type Rule = { id: string; name: string };

function summarizeRun(
  run: Run,
  labels: { skipped: string; success: string; failed: string },
): string {
  if (run.errorMessage) return run.errorMessage;
  if (run.result?.summaryAr) return run.result.summaryAr;
  const actions = run.result?.actions;
  if (Array.isArray(actions) && actions.length) {
    return actions
      .map((a) => {
        const state = a.skipped
          ? labels.skipped
          : a.ok
            ? labels.success
            : labels.failed;
        return `${a.type ?? "action"}: ${state}${a.reason ? ` (${a.reason})` : ""}`;
      })
      .join(" · ");
  }
  return "—";
}

export default async function AutomationRunsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; ruleId?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("automation");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const ruleQs = flash.ruleId ? `?ruleId=${flash.ruleId}` : "";

  const [runs, rules] = await Promise.all([
    apiServer<Run[]>(`/companies/${companyId}/automation/runs${ruleQs}`, {
      companyId,
    }).catch(() => []),
    apiServer<Rule[]>(`/companies/${companyId}/automation/rules`, {
      companyId,
    }).catch(() => []),
  ]);

  const ruleName = new Map(rules.map((r) => [r.id, r.name]));
  const failedCount = runs.filter((r) => r.status === "FAILED").length;
  const successCount = runs.filter((r) => r.status === "SUCCEEDED").length;
  const actionLabels = {
    skipped: t("skipped"),
    success: t("successShort"),
    failed: t("failedShort"),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("runsTitle")}
        description={t("runsDesc")}
        actions={
          <Button href={`/c/${companyId}/automation`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)]">{t("shown")}</p>
          <p className="mt-1 text-2xl font-semibold">{runs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)]">{t("success")}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {successCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)]">{t("failed")}</p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">
            {failedCount}
          </p>
        </Card>
      </div>

      <Card>
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <select
            name="ruleId"
            defaultValue={flash.ruleId ?? ""}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          >
            <option value="">{t("allRules")}</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary">
            {t("filter")}
          </Button>
        </form>

        {runs.length === 0 ? (
          <EmptyState message={t("noRuns")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-right text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("colRule")}</th>
                  <th className="px-2 py-2 font-medium">{t("colTrigger")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStarted")}</th>
                  <th className="px-2 py-2 font-medium">{t("colEntity")}</th>
                  <th className="px-2 py-2 font-medium">{t("colResult")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="border-b border-[var(--border)]/60 last:border-0 align-top"
                  >
                    <td className="px-2 py-2 font-medium">
                      {run.rule?.name ??
                        ruleName.get(run.automationRuleId) ??
                        run.automationRuleId.slice(0, 8)}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {run.rule?.triggerEvent ?? run.result?.event ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatDate(run.startedAt)}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {run.triggerEntityType
                        ? `${run.triggerEntityType}:${run.triggerEntityId ?? "—"}`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 max-w-md text-xs leading-relaxed text-[var(--muted-foreground)]">
                      <p className="whitespace-pre-wrap break-words">
                        {summarizeRun(run, actionLabels)}
                      </p>
                      {Array.isArray(run.result?.actions) &&
                      run.result.actions.length > 1 ? (
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {run.result.actions.map((a, i) => (
                            <li key={`${run.id}-${i}`}>
                              <span className="font-medium text-[var(--foreground)]">
                                {a.type}
                              </span>
                              {": "}
                              {a.skipped
                                ? `${t("skipped")}${a.reason ? ` — ${a.reason}` : ""}`
                                : a.ok
                                  ? t("successShort")
                                  : `${t("failedShort")}${a.reason ? ` — ${a.reason}` : ""}`}
                            </li>
                          ))}
                        </ul>
                      ) : null}
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
