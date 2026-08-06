import { getTranslations } from "next-intl/server";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";

type UsageRow = {
  id: string;
  module: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string | number;
  requestReference: string | null;
  createdAt: string;
};

export default async function AiUsagePage({
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
        <PageHeader title={t("usageTitle")} />
        <AccessDenied />
      </div>
    );
  }

  const rows = await apiServer<UsageRow[]>(
    `/companies/${companyId}/ai-usage`,
    { companyId },
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("usageTitle")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState message={t("noUsage")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("colTime")}</th>
                  <th className="px-2 py-2 font-medium">{t("colModule")}</th>
                  <th className="px-2 py-2 font-medium">{t("colModel")}</th>
                  <th className="px-2 py-2 font-medium">{t("colTokens")}</th>
                  <th className="px-2 py-2 font-medium">{t("colCost")}</th>
                  <th className="px-2 py-2 font-medium">{t("colRef")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{formatDate(r.createdAt)}</td>
                    <td className="px-2 py-2">{r.module}</td>
                    <td className="px-2 py-2">
                      {r.provider}/{r.model}
                    </td>
                    <td className="px-2 py-2">
                      {formatNumber(r.inputTokens)} /{" "}
                      {formatNumber(r.outputTokens)}
                    </td>
                    <td className="px-2 py-2">{r.estimatedCost}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {r.requestReference ?? "—"}
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
