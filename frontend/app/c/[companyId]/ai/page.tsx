import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";

type AiStatus = {
  companyId: string;
  provider: string;
  model: string;
  liveProviderConfigured: boolean;
  mode: string;
  planFeature: string;
  requiresPlan: string;
};

type UsageSummary = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string | number;
  byModule?: Record<string, number>;
};

export default async function AiHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("ai");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  if (!can(session?.user, "ai.read")) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <AccessDenied message={t("accessDenied")} />
      </div>
    );
  }

  const base = `/c/${companyId}/ai`;
  const [status, summary] = await Promise.all([
    apiServer<AiStatus>(`/companies/${companyId}/ai/status`, {
      companyId,
    }).catch(() => null),
    apiServer<UsageSummary>(`/companies/${companyId}/ai-usage/summary`, {
      companyId,
    }).catch(() => null),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      {status ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-xs text-[var(--color-muted)]">{t("mode")}</p>
            <p className="mt-1 font-mono text-sm">{status.mode}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--color-muted)]">
              {t("providerModel")}
            </p>
            <p className="mt-1 text-sm">
              {status.provider} · {status.model}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--color-muted)]">
              {t("requiredPlan")}
            </p>
            <p className="mt-1 text-sm">{status.requiresPlan}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--color-muted)]">{t("liveApi")}</p>
            <div className="mt-1">
              <StatusBadge
                status={status.liveProviderConfigured ? "ACTIVE" : "DISABLED"}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {summary ? (
        <Card title={t("usageSummary")}>
          <dl className="grid gap-3 sm:grid-cols-4 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">{t("requests")}</dt>
              <dd className="text-lg font-semibold">
                {formatNumber(summary.requests)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("inputTokens")}</dt>
              <dd className="text-lg font-semibold">
                {formatNumber(summary.inputTokens)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("outputTokens")}</dt>
              <dd className="text-lg font-semibold">
                {formatNumber(summary.outputTokens)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("estimatedCost")}</dt>
              <dd className="text-lg font-semibold">{summary.estimatedCost}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      <ModuleHub
        title={t("tools")}
        links={[
          {
            href: `${base}/assistant`,
            label: t("assistant"),
            hint: t("assistantHint"),
          },
          {
            href: `${base}/products`,
            label: t("products"),
            hint: t("productsHint"),
          },
          {
            href: `${base}/reports`,
            label: t("reportAnalysis"),
            hint: t("reportAnalysisHint"),
          },
          {
            href: `${base}/notes`,
            label: t("notes"),
            hint: t("notesHint"),
          },
          {
            href: `${base}/marketing`,
            label: t("marketing"),
            hint: t("marketingHint"),
          },
          {
            href: `${base}/bots/whatsapp`,
            label: t("botWhatsappTitle"),
            hint: t("botWhatsappDesc"),
          },
        ]}
      />
    </div>
  );
}
