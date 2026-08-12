import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function CallsBotPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("ai");
  const tCommon = await getTranslations("common");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("botCallsTitle")}
        description={t("botCallsDesc")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <Card className="p-5">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("botCallsStub")}
        </p>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {tCommon("comingSoonDetail")}
        </p>
      </Card>
    </div>
  );
}
