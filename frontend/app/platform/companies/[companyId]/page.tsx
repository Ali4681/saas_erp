import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { CountryCityFields } from "@/components/erp/CountryCityFields";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import {
  cancelSubscription,
  changePlan,
  renewSubscription,
  softDeleteCompany,
  suspendSubscription,
  updateCompanyLocale,
  updateCompanyStatus,
} from "../../actions";
import {
  fetchLocalesLookup,
  lookupLabel,
  lookupSelectOptions,
} from "@/lib/lookups";

type Plan = {
  code: string;
  name: string;
  price: string;
  currency: string;
  billingInterval: string;
};

type Subscription = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  trialEndsAt: string | null;
  plan: Plan;
};

type Invoice = {
  id: string;
  invoiceNumber?: string;
  status: string;
  totalAmount?: string;
  amount?: string;
  currency?: string;
  issuedAt?: string;
  createdAt?: string;
};

type CompanyDetail = {
  id: string;
  displayName: string;
  legalName: string;
  slug: string;
  status: string;
  defaultCurrency: string;
  timezone: string;
  countryCode: string | null;
  city: string | null;
  settings: {
    taxNumber: string | null;
    invoicePrefix: string;
    defaultTaxRate: string;
    emailFromName: string | null;
    emailFromAddress: string | null;
  } | null;
  subscriptions: Array<{
    id: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    plan: Plan;
  }>;
};

export default async function PlatformCompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("platform");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();

  const [company, current, history, plans, invoices, locales] = await Promise.all([
    apiServer<CompanyDetail>(`/companies/${companyId}`, { companyId }).catch(
      () => null,
    ),
    apiServer<Subscription>(
      `/companies/${companyId}/subscriptions/current`,
      { companyId },
    ).catch(() => null),
    apiServer<Subscription[]>(`/companies/${companyId}/subscriptions`, {
      companyId,
    }).catch(() => []),
    apiServer<Plan[]>("/plans").catch(() => []),
    apiServer<Invoice[]>(`/companies/${companyId}/subscriptions/invoices`, {
      companyId,
    }).catch(() => []),
    fetchLocalesLookup(companyId),
  ]);

  void invoices;

  if (!company) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t("companyFallback")}
          description={t("companyLoadError")}
        />
        <Card>
          <EmptyState message={t("companyNotFound")} />
        </Card>
      </div>
    );
  }

  const sub: Subscription | null =
    current ??
    (company.subscriptions?.[0]
      ? { ...company.subscriptions[0], trialEndsAt: null }
      : null);

  const change = changePlan.bind(null, companyId);
  const setStatus = updateCompanyStatus.bind(null, companyId);
  const setLocale = updateCompanyLocale.bind(null, companyId);
  const currencyOptions = lookupSelectOptions(locales.currencies);
  const timezoneOptions = lookupSelectOptions(locales.timezones);

  return (
    <div className="space-y-5">
      <PageHeader
        title={company.displayName}
        description={t("companySubDesc", {
          legal: company.legalName,
          slug: company.slug,
        })}
        actions={
          <>
            <Button href="/platform/companies" variant="primary">
              {t("allCompanies")}
            </Button>
            <Button href={`/c/${companyId}/audit`} variant="secondary">
              {t("auditLog")}
            </Button>
          </>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t("companyData")}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">{t("companyStatus")}</dt>
              <dd className="mt-1">
                <StatusBadge status={company.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("currency")}</dt>
              <dd className="mt-1">
                {lookupLabel(locales.currencies, company.defaultCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("timezone")}</dt>
              <dd className="mt-1">
                {lookupLabel(locales.timezones, company.timezone)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("country")}</dt>
              <dd className="mt-1">
                {lookupLabel(locales.countries, company.countryCode)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("city")}</dt>
              <dd className="mt-1">
                {company.city
                  ? lookupLabel(
                      locales.citiesByCountry[company.countryCode ?? ""] ?? [],
                      company.city,
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("taxNumber")}</dt>
              <dd className="mt-1">{company.settings?.taxNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">{t("invoicePrefix")}</dt>
              <dd className="mt-1">{company.settings?.invoicePrefix ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
            <CreateFormDialog
              title={t("saveLocale")}
              triggerLabel={t("saveLocale")}
              triggerVariant="secondary"
              showPlus={false}
            >
              <form action={setLocale} className="grid gap-3 sm:grid-cols-2">
                <CountryCityFields
                  countries={locales.countries}
                  citiesByCountry={locales.citiesByCountry}
                  cityDefaults={locales.cityDefaults}
                  defaultCountryCode={
                    company.countryCode ?? locales.defaults.countryCode
                  }
                  defaultCity={company.city ?? locales.defaults.city}
                />
                <Select
                  name="defaultCurrency"
                  label={t("currency")}
                  required
                  defaultValue={
                    company.defaultCurrency || locales.defaults.currency
                  }
                  options={currencyOptions}
                />
                <Select
                  name="timezone"
                  label={t("timezone")}
                  required
                  defaultValue={company.timezone || locales.defaults.timezone}
                  options={timezoneOptions}
                />
                <div className="flex items-end sm:col-span-2">
                  <Button type="submit" variant="secondary">
                    {t("saveLocale")}
                  </Button>
                </div>
              </form>
            </CreateFormDialog>

            <CreateFormDialog
              title={t("changeStatus")}
              triggerLabel={t("changeStatus")}
              triggerVariant="secondary"
              showPlus={false}
            >
              <form action={setStatus} className="grid gap-3">
                <Select
                  name="status"
                  label={t("companyStatus")}
                  defaultValue={company.status}
                  options={[
                    { value: "ACTIVE", label: t("statusActive") },
                    { value: "SUSPENDED", label: t("statusSuspended") },
                    { value: "CLOSED", label: t("statusClosed") },
                  ]}
                />
                <Button type="submit" variant="secondary">
                  {t("save")}
                </Button>
              </form>
            </CreateFormDialog>
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            {t("statusHint")}
          </p>
        </Card>

        <Card title={t("currentSubscription")}>
          {!sub ? (
            <EmptyState message={t("noSubscription")} />
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-muted)]">{t("plans")}</span>
                <span className="font-medium">
                  {sub.plan.name} ({sub.plan.code})
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-muted)]">
                  {t("subscriptionStatus")}
                </span>
                <StatusBadge status={sub.status} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-muted)]">{t("price")}</span>
                <span>
                  {Number(sub.plan.price) === 0
                    ? "—"
                    : formatMoney(sub.plan.price, sub.plan.currency)}{" "}
                  / {sub.plan.billingInterval}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-muted)]">{t("starts")}</span>
                <span>{formatDate(sub.startsAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-muted)]">{t("ends")}</span>
                <span>{formatDate(sub.endsAt)}</span>
              </div>
            </dl>
          )}

          <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
            <CreateFormDialog
              title={t("changePlan")}
              triggerLabel={t("changePlan")}
              triggerVariant="secondary"
              showPlus={false}
            >
              <form action={change} className="grid gap-3">
                <Select
                  name="planCode"
                  label={t("plans")}
                  required
                  placeholder={t("selectPlan")}
                  options={plans.map((p) => ({
                    value: p.code,
                    label: `${p.name} (${p.code})`,
                  }))}
                />
                <Button type="submit">{t("apply")}</Button>
              </form>
            </CreateFormDialog>
            <div className="flex flex-wrap gap-2">
              <ActionForm
                label={t("renew")}
                variant="primary"
                action={renewSubscription.bind(null, companyId)}
              />
              <ActionForm
                label={t("suspend")}
                variant="secondary"
                confirm={t("confirmSuspend")}
                action={suspendSubscription.bind(null, companyId)}
              />
              <ActionForm
                label={t("cancel")}
                variant="danger"
                confirm={t("confirmCancel")}
                action={cancelSubscription.bind(null, companyId)}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card title={t("subscriptionHistory")}>
        {history.length === 0 ? (
          <EmptyState message={t("noSubscriptionHistory")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("colPlan")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("from")}</th>
                  <th className="px-2 py-2 font-medium">{t("to")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      {row.plan.name}{" "}
                      <span className="text-xs text-[var(--color-muted)]">
                        ({row.plan.code})
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">{formatDate(row.startsAt)}</td>
                    <td className="px-2 py-2">{formatDate(row.endsAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t("dangerZone")}>
        <p className="mb-3 text-sm text-[var(--color-muted)]">
          {t("softDeleteHint")}
        </p>
        <ActionForm
          label={t("softDelete")}
          variant="danger"
          confirm={t("confirmSoftDelete")}
          action={softDeleteCompany.bind(null, companyId)}
        />
      </Card>
    </div>
  );
}
