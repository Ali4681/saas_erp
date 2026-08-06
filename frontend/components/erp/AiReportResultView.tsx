"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type ReportAnalysis = {
  scope?: string;
  summary?: string;
  highlights?: string[];
  weaknesses?: string[];
  improvements?: string[];
  recommendations?: string[];
  kpis?: Record<string, string | number | null | undefined>;
  score?: { health?: number; label?: string };
  meta?: {
    mode?: string;
    provider?: string;
    model?: string;
    requestReference?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: string;
  };
};

const KPI_KEYS = [
  "totalSales",
  "totalProfit",
  "totalExpenses",
  "balanceDue",
  "customerCount",
  "invoiceCount",
  "unpaidInvoiceCount",
  "stockValue",
  "lowStock",
  "outOfStock",
  "projectTotal",
  "rowCount",
] as const;

const SCOPE_KEYS = ["sales", "inventory", "hr", "executive"] as const;

function formatKpiValue(
  value: string | number | null | undefined,
  locale: string,
) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(n) && String(value).trim() !== "") {
    return formatNumber(n, locale);
  }
  return String(value);
}

export function AiReportResultView({ data }: { data: unknown }) {
  const t = useTranslations("ai.reportResult");
  const locale = useLocale();
  const report = (data ?? {}) as ReportAnalysis;
  const kpis = Object.entries(report.kpis ?? {}).filter(
    ([, v]) => v != null && v !== "",
  );
  const health = report.score?.health ?? 70;
  const healthTone =
    health >= 75 ? "success" : health >= 50 ? "warning" : "danger";

  function kpiLabel(key: string) {
    return KPI_KEYS.includes(key as (typeof KPI_KEYS)[number])
      ? t(`kpis.${key}`)
      : key;
  }

  function scopeLabel(scope: string) {
    return SCOPE_KEYS.includes(scope as (typeof SCOPE_KEYS)[number])
      ? t(`scopes.${scope}`)
      : scope;
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-l from-[var(--primary)]/10 via-[var(--card)] to-[var(--chart-2)]/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                <Sparkles className="me-1 inline h-3 w-3" />
                {t("smartAnalysis")}
              </Badge>
              {report.scope ? (
                <Badge variant="outline">
                  {scopeLabel(report.scope)}
                </Badge>
              ) : null}
              {report.meta?.mode ? (
                <Badge
                  variant={
                    report.meta.mode === "OPENAI" ? "success" : "secondary"
                  }
                >
                  {report.meta.mode}
                </Badge>
              ) : null}
            </div>
            <h3 className="text-lg font-semibold tracking-tight">
              {t("managerSummary")}
            </h3>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted-foreground)]">
              {report.summary ?? t("noSummary")}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 px-4 py-3 text-center shadow-sm">
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("healthIndex")}
            </p>
            <p
              className={cn(
                "mt-1 text-3xl font-semibold tabular-nums",
                healthTone === "success" &&
                  "text-emerald-700 dark:text-emerald-400",
                healthTone === "warning" &&
                  "text-amber-700 dark:text-amber-400",
                healthTone === "danger" && "text-red-700 dark:text-red-400",
              )}
            >
              {health}
            </p>
            <p className="mt-1 text-xs font-medium text-[var(--muted-foreground)]">
              {report.score?.label ?? t("generalScore")}
            </p>
          </div>
        </div>
      </div>

      {kpis.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.slice(0, 8).map(([key, value]) => (
            <StatCard
              key={key}
              label={kpiLabel(key)}
              value={formatKpiValue(value, locale)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          ))}
        </div>
      ) : null}

      {(report.highlights?.length ?? 0) > 0 ? (
        <Card title={t("highlights")} description={t("highlightsDesc")}>
          <ul className="space-y-2">
            {report.highlights!.map((item, i) => (
              <li
                key={`${item}-${i}`}
                className="flex items-start gap-2 rounded-xl bg-[var(--accent)]/50 px-3 py-2 text-sm"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <InsightList
          title={t("weaknesses")}
          emptyLabel={t("emptyItems")}
          icon={<AlertTriangle className="h-4 w-4" />}
          items={report.weaknesses ?? []}
          tone="danger"
        />
        <InsightList
          title={t("opportunities")}
          emptyLabel={t("emptyItems")}
          icon={<Lightbulb className="h-4 w-4" />}
          items={report.improvements ?? []}
          tone="warning"
        />
        <InsightList
          title={t("recommendations")}
          emptyLabel={t("emptyItems")}
          icon={<Target className="h-4 w-4" />}
          items={report.recommendations ?? []}
          tone="success"
        />
      </div>

      {report.meta ? (
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
          <Badge variant="outline">
            {report.meta.provider}/{report.meta.model}
          </Badge>
          {report.meta.requestReference ? (
            <Badge variant="secondary">{report.meta.requestReference}</Badge>
          ) : null}
          {report.meta.estimatedCost != null ? (
            <Badge variant="outline">
              {t("cost", { cost: report.meta.estimatedCost })}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InsightList({
  title,
  emptyLabel,
  items,
  icon,
  tone,
}: {
  title: string;
  emptyLabel: string;
  items: string[];
  icon: React.ReactNode;
  tone: "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-emerald-500/30 bg-emerald-500/10";

  return (
    <Card title={title} className={cn("border", toneClass)}>
      <div className="mb-3 text-[var(--foreground)]">{icon}</div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</p>
      ) : (
        <ol className="space-y-2 text-sm leading-6">
          {items.map((item, i) => (
            <li key={`${title}-${i}`} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--card)] text-[11px] font-semibold shadow-sm ring-1 ring-[var(--border)]">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
