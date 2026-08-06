"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { IntegrationProvider } from "@/lib/integrations";

export function CategoryRelatedCompanies({
  providers,
  selectedCode,
  onSelect,
  readOnly = false,
  title,
  description,
}: {
  providers: IntegrationProvider[];
  selectedCode?: string;
  onSelect?: (code: string) => void;
  readOnly?: boolean;
  title?: string;
  description?: string;
}) {
  const t = useTranslations("common");
  const resolvedTitle = title ?? t("availableCompanies");

  if (providers.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        {t("noRelatedCompanies")}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-medium text-[var(--foreground)]">{resolvedTitle}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      <ul
        className={cn(
          "grid gap-2 sm:grid-cols-2",
          readOnly ? "lg:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        {providers.map((provider) => {
          const selected = provider.code === selectedCode;

          if (readOnly) {
            return (
              <li
                key={provider.code}
                className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2.5"
              >
                <p className="font-medium">{provider.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                  {provider.code}
                </p>
              </li>
            );
          }

          return (
            <li key={provider.code}>
              <button
                type="button"
                onClick={() => onSelect?.(provider.code)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-xl border px-3 py-2.5 text-right transition",
                  selected
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-2 ring-[var(--primary)]/20"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]/20",
                )}
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {provider.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                    {provider.code}
                  </p>
                </div>
                {provider.requiresApproval ? (
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {t("partnerApprovalRequired")}
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
