import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { fetchLocalesLookup, lookupLabel } from "@/lib/lookups";
import { getAppLocale } from "@/lib/i18n/locale-server";

type CompanyDetail = {
  id: string;
  displayName: string;
  legalName: string;
  slug: string;
  status: string;
  defaultCurrency: string;
  timezone: string;
  countryCode: string | null;
  settings: {
    taxNumber: string | null;
    invoicePrefix: string;
    defaultTaxRate: string;
    emailFromName: string | null;
    emailFromAddress: string | null;
  } | null;
  subscriptions: Array<{
    status: string;
    plan: { code: string; name: string };
  }>;
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("settings");
  const [company, locales, locale] = await Promise.all([
    apiServer<CompanyDetail>(`/companies/${companyId}`, {
      companyId,
    }).catch(() => null),
    fetchLocalesLookup(companyId),
    getAppLocale(),
  ]);

  if (!company) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} />
        <Card>
          <EmptyState message={t("loadError")} />
        </Card>
      </div>
    );
  }

  const plan = company.subscriptions?.[0]?.plan;

  return (
    <div className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("companyCard")}>
          <dl className="space-y-3 text-sm">
            <Row label={t("displayName")} value={company.displayName} />
            <Row label={t("legalName")} value={company.legalName} />
            <Row label={t("slug")} value={company.slug} mono />
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">{t("status")}</dt>
              <dd>
                <StatusBadge status={company.status} />
              </dd>
            </div>
            <Row
              label={t("currency")}
              value={lookupLabel(
                locales.currencies,
                company.defaultCurrency,
                locale,
              )}
            />
            <Row
              label={t("timezone")}
              value={lookupLabel(locales.timezones, company.timezone, locale)}
            />
            <Row
              label={t("country")}
              value={lookupLabel(locales.countries, company.countryCode, locale)}
            />
            <Row
              label={t("plan")}
              value={plan ? `${plan.name} (${plan.code})` : "—"}
            />
          </dl>
        </Card>

        <Card title={t("taxCard")}>
          {!company.settings ? (
            <EmptyState message={t("noSettings")} />
          ) : (
            <dl className="space-y-3 text-sm">
              <Row
                label={t("taxNumber")}
                value={company.settings.taxNumber ?? "—"}
              />
              <Row
                label={t("invoicePrefix")}
                value={company.settings.invoicePrefix}
              />
              <Row
                label={t("defaultTaxRate")}
                value={`${company.settings.defaultTaxRate}%`}
              />
              <Row
                label={t("emailFromName")}
                value={company.settings.emailFromName ?? "—"}
              />
              <Row
                label={t("emailFromAddress")}
                value={company.settings.emailFromAddress ?? "—"}
              />
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "font-medium"}>{value}</dd>
    </div>
  );
}
