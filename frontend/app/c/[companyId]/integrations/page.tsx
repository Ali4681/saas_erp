import { getTranslations } from "next-intl/server";
import { IntegrationProviderCatalog } from "@/components/erp/IntegrationProviderCatalog";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import type { IntegrationProvider } from "@/lib/integrations";

export default async function IntegrationsHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("integrations");

  const [engine, providers] = await Promise.all([
    apiServer<{ driver: string }>("/integrations/sync-engine", {
      companyId,
    }).catch(() => null),
    apiServer<IntegrationProvider[]>("/integrations/providers", {
      companyId,
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      {engine ? (
        <Card>
          <p className="text-sm text-[var(--color-muted)]">{t("syncEngine")}</p>
          <p className="font-mono text-lg">{engine.driver}</p>
        </Card>
      ) : null}

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t("availableProviders")}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("availableProvidersHint")}
          </p>
        </div>
        <IntegrationProviderCatalog providers={providers} />
      </div>
    </div>
  );
}
