import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { updateAiBotConfig } from "../../actions";

type BotConfig = {
  id: string;
  channel: string;
  status: string;
  settings?: {
    webhookUrl?: string;
    apiUrl?: string;
    token?: string;
  };
};

export default async function CallsBotPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("ai");
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "ai.write");

  const config = await apiServer<BotConfig>(
    `/companies/${companyId}/ai/bots/VOICE_CALL`,
    { companyId },
  ).catch(() => null);

  const save = updateAiBotConfig.bind(null, companyId, "VOICE_CALL");

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
      <FlashFromSearch searchParams={flash} />
      <Card className="space-y-3 p-5">
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("botCallsStub")}
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          {tCommon("comingSoonDetail")}
        </p>
        {canWrite ? (
          <form action={save} className="grid gap-3 md:grid-cols-2">
            <Select
              name="status"
              label={t("botStatus")}
              defaultValue={config?.status ?? "DISABLED"}
              options={[
                { value: "DISABLED", label: "DISABLED" },
                { value: "DRAFT", label: "DRAFT" },
                { value: "ACTIVE", label: "ACTIVE" },
              ]}
            />
            <Input
              name="apiUrl"
              label={t("botApiUrl")}
              defaultValue={
                typeof config?.settings?.apiUrl === "string"
                  ? config.settings.apiUrl
                  : ""
              }
            />
            <Input
              name="webhookUrl"
              label={t("botWebhookUrl")}
              defaultValue={
                typeof config?.settings?.webhookUrl === "string"
                  ? config.settings.webhookUrl
                  : ""
              }
            />
            <Input
              name="token"
              label={t("botApiToken")}
              type="password"
              placeholder={
                typeof config?.settings?.token === "string"
                  ? config.settings.token
                  : "••••••••"
              }
            />
            <div className="md:col-span-2">
              <Button type="submit">{t("botSave")}</Button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("botReadOnly")}
          </p>
        )}
      </Card>
    </div>
  );
}
