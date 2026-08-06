"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CategoryRelatedCompanies } from "@/components/erp/CategoryRelatedCompanies";
import { IntegrationProviderApiDetails } from "@/components/erp/IntegrationProviderApiDetails";
import { Select } from "@/components/ui/Select";
import type { AppLocale } from "@/i18n/config";
import {
  CATEGORY_ORDER,
  categoryLabel,
  type IntegrationCategory,
  type IntegrationProvider,
} from "@/lib/integrations";

export function IntegrationProviderPicker({
  categories,
  providers,
}: {
  categories: IntegrationCategory[];
  providers: IntegrationProvider[];
}) {
  const t = useTranslations("integrations.picker");
  const locale = useLocale() as AppLocale;
  const [categoryCode, setCategoryCode] = useState("");
  const [providerCode, setProviderCode] = useState("");

  const filteredProviders = useMemo(
    () =>
      providers
        .filter((p) => p.category.code === categoryCode)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [providers, categoryCode],
  );

  const categoryOptions = CATEGORY_ORDER.map((code) => {
    const category = categories.find((c) => c.code === code);
    if (!category) return null;
    return {
      value: category.code,
      label: categoryLabel(category, locale),
    };
  }).filter((option): option is { value: string; label: string } => option != null);

  const providerOptions = filteredProviders.map((p) => {
    const approval = p.requiresApproval ? t("requiresApprovalSuffix") : "";
    return {
      value: p.code,
      label: `${p.name}${approval}`,
    };
  });

  return (
    <>
      <Select
        name="categoryCode"
        label={t("categoryType")}
        value={categoryCode}
        onChange={(e) => {
          setCategoryCode(e.target.value);
          setProviderCode("");
        }}
        options={categoryOptions}
        required
        placeholder={t("pickCategory")}
      />
      <Select
        key={categoryCode || "no-category"}
        name="providerCode"
        label={t("provider")}
        value={providerCode}
        onChange={(e) => setProviderCode(e.target.value)}
        options={providerOptions}
        required
        disabled={!categoryCode}
        placeholder={
          categoryCode ? t("pickProvider") : t("pickCategoryFirst")
        }
      />
      {categoryCode ? (
        <div className="md:col-span-2 space-y-4">
          <CategoryRelatedCompanies
            providers={filteredProviders}
            selectedCode={providerCode}
            onSelect={setProviderCode}
            title={t("relatedTitle")}
            description={t("relatedDesc")}
          />
          {providerCode ? (
            <IntegrationProviderApiDetails providerCode={providerCode} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
