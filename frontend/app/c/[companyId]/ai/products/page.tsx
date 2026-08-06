import { getTranslations } from "next-intl/server";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { AiToolForm } from "@/components/erp/AiToolForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { aiProductGenerate, aiProductImprove } from "@/lib/erp/ai-actions";
import { getSession } from "@/lib/auth/session";
import {
  fetchLocalesLookup,
  lookupSelectOptions,
} from "@/lib/lookups";
import { can } from "@/lib/permissions";
import { apiServer } from "@/lib/api/server";

export default async function AiProductsPage({
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
        <PageHeader title={t("productsTitle")} />
        <AccessDenied />
      </div>
    );
  }

  const [locales, company] = await Promise.all([
    fetchLocalesLookup(companyId),
    apiServer<{ defaultCurrency?: string }>(`/companies/${companyId}`, {
      companyId,
    }).catch(() => null),
  ]);

  const languageOptions = lookupSelectOptions(locales.languages);
  const currencyOptions = lookupSelectOptions(locales.currencies);
  const defaultLanguage = locales.defaults.language ?? "ar";
  const defaultCurrency =
    company?.defaultCurrency ?? locales.defaults.currency ?? "SAR";

  const generate = aiProductGenerate.bind(null, companyId);
  const improve = aiProductImprove.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("productsTitle")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <CreateFormDialog
          title={t("generateProductDesc")}
          triggerLabel={t("generateProductDesc")}
          showPlus={false}
        >
          <AiToolForm action={generate} submitLabel={t("generate")}>
            <div className="md:col-span-2">
              <Textarea
                name="prompt"
                label={t("promptIdea")}
                required
                rows={4}
              />
            </div>
            <Select
              name="language"
              label={t("language")}
              required
              defaultValue={defaultLanguage}
              options={languageOptions}
            />
            <Select
              name="targetCurrency"
              label={t("currency")}
              required
              defaultValue={defaultCurrency}
              options={currencyOptions}
            />
          </AiToolForm>
        </CreateFormDialog>

        <CreateFormDialog
          title={t("improveText")}
          triggerLabel={t("improveText")}
          triggerVariant="secondary"
          showPlus={false}
        >
          <AiToolForm action={improve} submitLabel={t("improve")}>
            <div className="md:col-span-2">
              <Textarea name="text" label={t("text")} required rows={4} />
            </div>
            <Select
              name="goal"
              label={t("goal")}
              options={[
                { value: "improve", label: t("goalImprove") },
                { value: "shorten", label: t("goalShorten") },
                { value: "marketing", label: t("goalMarketing") },
                { value: "formal", label: t("goalFormal") },
              ]}
            />
            <Select
              name="language"
              label={t("language")}
              required
              defaultValue={defaultLanguage}
              options={languageOptions}
            />
          </AiToolForm>
        </CreateFormDialog>
      </div>
    </div>
  );
}
