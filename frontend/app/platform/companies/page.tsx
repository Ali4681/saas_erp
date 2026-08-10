import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { CountryCityFields } from "@/components/erp/CountryCityFields";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { companyLogoUrl } from "@/lib/company-logo";
import { getFormatters } from "@/lib/format-server";
import {
  fetchLocalesLookup,
  lookupSelectOptions,
} from "@/lib/lookups";
import { createCompany } from "../actions";

type Plan = {
  id: string;
  code: string;
  name: string;
  price: string;
  currency: string;
  billingInterval: string;
  isActive: boolean;
};

type Company = {
  id: string;
  displayName: string;
  legalName: string;
  slug: string;
  status: string;
  countryCode?: string | null;
  city?: string | null;
  logoAttachmentId?: string | null;
  subscriptions?: Array<{
    status: string;
    plan: {
      code: string;
      name: string;
      price: string;
      currency: string;
      billingInterval: string;
    };
  }>;
};

export default async function PlatformCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const flash = await searchParams;
  const t = await getTranslations("platform");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const [companies, plans, locales] = await Promise.all([
    apiServer<Company[]>("/companies").catch(() => []),
    apiServer<Plan[]>("/plans").catch(() => []),
    fetchLocalesLookup(),
  ]);

  const activePlans = plans.filter((p) => p.isActive !== false);
  const defaultPlanCode =
    activePlans.find((p) => p.code === "BASIC")?.code ??
    activePlans[0]?.code ??
    "";
  const currencyOptions = lookupSelectOptions(locales.currencies);
  const timezoneOptions = lookupSelectOptions(locales.timezones);

  const intervalLabel = (interval: string) => {
    if (interval === "MONTHLY") return t("monthly");
    if (interval === "QUARTERLY") return t("quarterly");
    if (interval === "YEARLY") return t("yearly");
    return interval;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("companiesTitle")}
        description={t("companiesDesc")}
        actions={
          <CreateFormDialog
            title={t("addCompany")}
            description={t("addCompanyDesc")}
            triggerLabel={t("addCompany")}
          >
            <form
              id="platform-create-company-form"
              action={createCompany}
              className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
            >
              <Input
                name="displayName"
                label={t("displayName")}
                required
                placeholder={t("displayNamePh")}
              />
              <Input
                name="legalName"
                label={t("legalName")}
                required
                placeholder={t("legalNamePh")}
              />
              <Input
                name="slug"
                label={t("slug")}
                required
                placeholder="alnoor"
                pattern="[a-z0-9-]{2,}"
              />
              <Input
                name="ownerFullName"
                label={t("ownerFullName")}
                placeholder={t("ownerFullNamePh")}
              />
              <Input
                name="ownerEmail"
                label={t("ownerEmail")}
                type="email"
                placeholder="owner@company.com"
              />
              <Input
                name="ownerPassword"
                label={t("ownerPassword")}
                type="password"
                minLength={8}
                placeholder={t("ownerPasswordPh")}
              />
              <p className="text-xs text-[var(--muted-foreground)] md:col-span-2 lg:col-span-3">
                {t("ownerHint")}
              </p>
              <CountryCityFields
                countries={locales.countries}
                citiesByCountry={locales.citiesByCountry}
                cityDefaults={locales.cityDefaults}
                defaultCountryCode={locales.defaults.countryCode}
                defaultCity={locales.defaults.city}
              />
              <Select
                name="defaultCurrency"
                label={t("currency")}
                required
                showPlaceholderOption={false}
                defaultValue={locales.defaults.currency}
                options={currencyOptions}
              />
              <Select
                name="timezone"
                label={t("timezone")}
                required
                showPlaceholderOption={false}
                defaultValue={locales.defaults.timezone}
                options={timezoneOptions}
              />
              <Select
                name="planCode"
                label={t("planCode")}
                required
                showPlaceholderOption={false}
                defaultValue={defaultPlanCode}
                options={activePlans.map((p) => ({
                  value: p.code,
                  label: `${p.name} — ${
                    Number(p.price) === 0
                      ? t("free")
                      : formatMoney(p.price, p.currency)
                  } / ${intervalLabel(p.billingInterval)}`,
                }))}
              />
              <Input
                name="defaultTaxRate"
                label={t("defaultTaxRate")}
                type="number"
                required
                min={0}
                max={100}
                step="0.01"
                defaultValue="15"
                placeholder="15"
              />
              <label className="flex flex-col gap-1.5 text-sm md:col-span-2 lg:col-span-3">
                <span className="font-medium text-[var(--foreground)]">
                  {t("logo")}
                </span>
                <input
                  type="file"
                  name="logo"
                  accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                  className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] shadow-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("logoHint")}
                </span>
              </label>
              <div className="flex items-end md:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={activePlans.length === 0}>
                  <Plus className="h-4 w-4" />
                  {t("createCompanySub")}
                </Button>
              </div>
              {activePlans.length === 0 ? (
                <p className="text-sm text-amber-800 md:col-span-2 lg:col-span-3">
                  {t("noActivePlans")}
                </p>
              ) : null}
            </form>
          </CreateFormDialog>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card title={t("companiesList")}>
        {companies.length === 0 ? (
          <EmptyState message={t("noCompanies")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-3 py-2 font-medium">{t("colName")}</th>
                  <th className="px-3 py-2 font-medium">{t("colSlug")}</th>
                  <th className="px-3 py-2 font-medium">{t("colPlan")}</th>
                  <th className="px-3 py-2 font-medium">{t("colSubscription")}</th>
                  <th className="px-3 py-2 font-medium">{t("colCompanyStatus")}</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const sub = c.subscriptions?.[0];
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {c.logoAttachmentId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={companyLogoUrl(c.id, c.logoAttachmentId) ?? undefined}
                              alt=""
                              className="h-8 w-8 rounded-md object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--secondary)]">
                              <Building2 className="h-4 w-4 text-[var(--muted-foreground)]" />
                            </span>
                          )}
                          <div>
                            <p className="font-medium">{c.displayName}</p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {c.legalName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{c.slug}</td>
                      <td className="px-3 py-2">
                        {sub ? (
                          <span>
                            {sub.plan.name}{" "}
                            <span className="text-xs text-[var(--muted-foreground)]">
                              ({sub.plan.code})
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {sub ? <StatusBadge status={sub.status} /> : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2 text-left">
                        <Link
                          href={`/platform/companies/${c.id}`}
                          className="text-sm text-[var(--primary)] hover:underline"
                        >
                          {t("manageSubscription")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
