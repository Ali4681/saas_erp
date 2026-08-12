import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function WhatsappBotPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("ai");
  const session = await getSession();
  const canWrite = can(session?.user, "ai.write");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("botWhatsappTitle")}
        description={t("botWhatsappDesc")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <Card className="space-y-3 p-5">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("botWhatsappStub")}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("botWebhookUrl")}</span>
            <input
              disabled
              placeholder="https://…"
              className="h-10 rounded-lg border border-[var(--input)] bg-[var(--muted)]/40 px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("botApiToken")}</span>
            <input
              disabled
              type="password"
              placeholder="••••••••"
              className="h-10 rounded-lg border border-[var(--input)] bg-[var(--muted)]/40 px-3 text-sm"
            />
          </label>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {canWrite ? t("botWaitingBackend") : t("botReadOnly")}
        </p>
      </Card>
    </div>
  );
}
