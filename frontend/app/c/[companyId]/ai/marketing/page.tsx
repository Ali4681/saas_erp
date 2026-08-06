import { getTranslations } from "next-intl/server";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { AiToolForm } from "@/components/erp/AiToolForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { aiMarketingGenerate } from "@/lib/erp/ai-actions";
import { getSession } from "@/lib/auth/session";
import {
  fetchLocalesLookup,
  lookupSelectOptions,
} from "@/lib/lookups";
import { can } from "@/lib/permissions";

export default async function AiMarketingPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("ai");
  const session = await getSession();
  if (!can(session?.user, "ai.write")) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("marketingTitle")} />
        <AccessDenied />
      </div>
    );
  }

  const locales = await fetchLocalesLookup(companyId);
  const languageOptions = lookupSelectOptions(locales.languages);
  const defaultLanguage = locales.defaults.language ?? "ar";

  const generate = aiMarketingGenerate.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("generateMarketing")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <CreateFormDialog
        title={t("generateMarketing")}
        triggerLabel={t("generateContent")}
        showPlus={false}
      >
        <AiToolForm action={generate} submitLabel={t("generate")}>
          <Input
            name="topic"
            label={t("topic")}
            required
            className="md:col-span-2"
          />
          <Select
            name="channel"
            label={t("channel")}
            options={[
              { value: "INSTAGRAM", label: "Instagram" },
              { value: "FACEBOOK", label: "Facebook" },
              { value: "X", label: "X" },
              { value: "LINKEDIN", label: "LinkedIn" },
              { value: "OTHER", label: t("other") },
            ]}
          />
          <Input
            name="tone"
            label={t("tone")}
            placeholder={t("tonePlaceholder")}
          />
          <Select
            name="language"
            label={t("language")}
            required
            defaultValue={defaultLanguage}
            options={languageOptions}
          />
          <Input name="variants" label={t("variants")} defaultValue="3" />
        </AiToolForm>
      </CreateFormDialog>
    </div>
  );
}
