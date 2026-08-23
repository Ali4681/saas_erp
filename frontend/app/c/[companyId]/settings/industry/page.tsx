import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getAppLocale } from "@/lib/i18n/locale-server";
import { applyIndustryPack } from "../actions";

type Industry = {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  roleTemplates: Array<{ roleCode: string; roleNameEn: string; roleNameAr: string }>;
  categoryTemplates: Array<{ kind: string; code: string; nameEn: string }>;
};

type Activation = {
  id: string;
  appliedAt: string;
  industry: { code: string; nameEn: string; nameAr: string };
};

export default async function IndustrySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("settings");
  const locale = await getAppLocale();
  const session = await getSession();
  const canWrite = can(session?.user, "companies.write");

  const [industries, activations] = await Promise.all([
    apiServer<Industry[]>(`/companies/${companyId}/industry-activities`, {
      companyId,
    }).catch(() => []),
    apiServer<Activation[]>(`/companies/${companyId}/industry-activations`, {
      companyId,
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("industryTitle")}
        description={t("industryDesc")}
        actions={
          <Button href={`/c/${companyId}/settings`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <Card className="space-y-3 p-4">
          <form
            action={applyIndustryPack.bind(null, companyId)}
            className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
          >
            <Select
              name="industryActivityId"
              label={t("industrySelect")}
              required
              options={industries.map((i) => ({
                value: i.id,
                label: locale === "ar" ? i.nameAr : i.nameEn,
              }))}
            />
            <Button type="submit">{t("industryApply")}</Button>
          </form>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("industryHint")}
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold">{t("industryActive")}</h3>
        {activations.length === 0 ? (
          <EmptyState message={t("industryEmpty")} />
        ) : (
          <ul className="space-y-2 text-sm">
            {activations.map((a) => (
              <li key={a.id}>
                {locale === "ar" ? a.industry.nameAr : a.industry.nameEn} ·{" "}
                {a.appliedAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {industries.map((i) => (
          <Card key={i.id} className="p-4">
            <h3 className="font-medium">
              {locale === "ar" ? i.nameAr : i.nameEn}
            </h3>
            <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
              {i.code}
            </p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {t("industryRoles")}:{" "}
              {i.roleTemplates
                .map((r) => (locale === "ar" ? r.roleNameAr : r.roleNameEn))
                .join(" · ")}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
