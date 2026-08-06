import { Package, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/erp/ActionForm";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import { fetchLocalesLookup, lookupSelectOptions } from "@/lib/lookups";
import { createPlan, deletePlan, updatePlan } from "../actions";

type Plan = {
  id: string;
  code: string;
  name: string;
  billingInterval: string;
  price: string;
  currency: string;
  isActive: boolean;
  sortOrder: number;
};

export default async function PlatformPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const flash = await searchParams;
  const t = await getTranslations("platform");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const [plans, locales] = await Promise.all([
    apiServer<Plan[]>("/plans?includeInactive=true").catch(() => []),
    fetchLocalesLookup(),
  ]);
  const currencyOptions = lookupSelectOptions(locales.currencies);
  const intervals = [
    { value: "MONTHLY", label: t("monthly") },
    { value: "QUARTERLY", label: t("quarterly") },
    { value: "YEARLY", label: t("yearly") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("plansTitle")} description={t("plansPageDesc")} />
      <FlashFromSearch searchParams={flash} />

      <CreateFormDialog
        title={t("addPlan")}
        description={t("addPlanDesc")}
        triggerLabel={t("addPlan")}
      >
        <form
          action={createPlan}
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            name="code"
            label={t("planCodeField")}
            required
            placeholder="PRO"
            pattern="[A-Za-z0-9_-]{2,40}"
          />
          <Input
            name="name"
            label={t("planName")}
            required
            placeholder={t("planNamePh")}
          />
          <Input
            name="price"
            label={t("price")}
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
            required
          />
          <Select
            name="currency"
            label={t("currency")}
            defaultValue={locales.defaults.currency}
            options={currencyOptions}
          />
          <Select
            name="billingInterval"
            label={t("billingInterval")}
            defaultValue="MONTHLY"
            options={intervals}
          />
          <Input
            name="sortOrder"
            label={t("sortOrder")}
            type="number"
            defaultValue="0"
          />
          <input type="hidden" name="isActive" value="true" />
          <div className="flex items-end md:col-span-2 lg:col-span-3">
            <Button type="submit">
              <Plus className="h-4 w-4" />
              {t("addPlanSubmit")}
            </Button>
          </div>
        </form>
      </CreateFormDialog>

      {plans.length === 0 ? (
        <Card>
          <EmptyState message={t("noPlansEmpty")} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => {
            const save = updatePlan.bind(null, plan.code);
            const remove = deletePlan.bind(null, plan.code);
            return (
              <Card key={plan.code} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{plan.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{plan.code}</Badge>
                        <StatusBadge
                          status={plan.isActive ? "ACTIVE" : "DISABLED"}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-lg font-semibold">
                    {Number(plan.price) === 0
                      ? t("free")
                      : formatMoney(plan.price, plan.currency)}
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("billingInterval")}
                    </dt>
                    <dd className="mt-0.5">
                      {intervals.find((i) => i.value === plan.billingInterval)
                        ?.label ?? plan.billingInterval}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--muted-foreground)]">
                      {t("orderLabel")}
                    </dt>
                    <dd className="mt-0.5">{plan.sortOrder ?? 0}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <CreateFormDialog
                    title={t("editPlan", { name: plan.name })}
                    triggerLabel={t("edit")}
                    triggerVariant="secondary"
                    showPlus={false}
                  >
                    <form action={save} className="grid gap-3 sm:grid-cols-2">
                      <Input
                        name="name"
                        label={t("name")}
                        defaultValue={plan.name}
                        required
                      />
                      <Input
                        name="price"
                        label={t("price")}
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={String(plan.price)}
                        required
                      />
                      <Select
                        name="currency"
                        label={t("currency")}
                        defaultValue={
                          plan.currency || locales.defaults.currency
                        }
                        options={currencyOptions}
                      />
                      <Select
                        name="billingInterval"
                        label={t("billingInterval")}
                        defaultValue={plan.billingInterval}
                        options={intervals}
                      />
                      <Input
                        name="sortOrder"
                        label={t("orderLabel")}
                        type="number"
                        defaultValue={String(plan.sortOrder ?? 0)}
                      />
                      <Select
                        name="isActive"
                        label={t("status")}
                        defaultValue={plan.isActive ? "true" : "false"}
                        options={[
                          { value: "true", label: t("active") },
                          { value: "false", label: t("disabled") },
                        ]}
                      />
                      <div className="sm:col-span-2">
                        <Button type="submit" variant="secondary">
                          {t("saveEdits")}
                        </Button>
                      </div>
                    </form>
                  </CreateFormDialog>
                  <ActionForm
                    label={t("deleteDisable")}
                    variant="danger"
                    confirm={
                      plan.isActive
                        ? t("confirmDeleteActive")
                        : t("confirmDeleteInactive")
                    }
                    action={remove}
                  />
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("deleteNote")}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
