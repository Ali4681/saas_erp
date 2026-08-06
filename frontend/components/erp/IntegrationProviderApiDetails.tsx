"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import {
  capabilityDirectionLabel,
  capabilitySupportLabel,
  categoryLabel,
  type IntegrationProviderDetail,
} from "@/lib/integrations";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

function supportVariant(
  supportStatus: string,
): "success" | "warning" | "info" | "secondary" {
  if (supportStatus === "VERIFIED") return "success";
  if (supportStatus === "PARTNER_ENABLED") return "info";
  if (supportStatus === "NOT_SUPPORTED") return "secondary";
  return "warning";
}

export function IntegrationProviderApiDetails({
  providerCode,
  className,
}: {
  providerCode: string;
  className?: string;
}) {
  const t = useTranslations("integrations.apiDetails");
  const locale = useLocale() as AppLocale;
  const [provider, setProvider] = useState<IntegrationProviderDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerCode) {
      setProvider(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/integrations/providers/${encodeURIComponent(providerCode)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(payload?.message ?? t("loadError"));
        }
        return res.json() as Promise<IntegrationProviderDetail>;
      })
      .then((data) => setProvider(data))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setProvider(null);
        setError(err instanceof Error ? err.message : t("loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [providerCode]);

  if (!providerCode) return null;

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-4 py-8 text-sm text-[var(--muted-foreground)]",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-300",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (!provider) return null;

  const supportedCount = provider.capabilities.filter(
    (item) => item.supportStatus !== "NOT_SUPPORTED",
  ).length;

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {t("title", { name: provider.name })}
          </p>
          <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">
            {provider.code}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {provider.requiresApproval ? (
            <Badge variant="warning">{t("requiresApproval")}</Badge>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted-foreground)]">{t("section")}</dt>
          <dd className="mt-0.5 font-medium">
            {categoryLabel(provider.category, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted-foreground)]">
            {t("supportedCapabilities")}
          </dt>
          <dd className="mt-0.5 font-medium">
            {supportedCount} / {provider.capabilities.length}
          </dd>
        </div>
        {provider.officialDocsUrl ? (
          <div className="sm:col-span-2">
            <dt className="text-[var(--muted-foreground)]">{t("officialDocs")}</dt>
            <dd className="mt-0.5">
              <a
                href={provider.officialDocsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
              >
                {provider.officialDocsUrl}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <div>
        <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
          {t("capabilitiesTitle")}
        </p>
        {provider.capabilities.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("noCapabilities")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30 text-right text-[var(--muted-foreground)]">
                  <th className="px-3 py-2 font-medium">{t("colCapability")}</th>
                  <th className="px-3 py-2 font-medium">{t("colType")}</th>
                  <th className="px-3 py-2 font-medium">{t("colDirection")}</th>
                  <th className="px-3 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-3 py-2 font-medium">{t("colScope")}</th>
                  <th className="px-3 py-2 font-medium">{t("colNotes")}</th>
                </tr>
              </thead>
              <tbody>
                {provider.capabilities.map((item) => (
                  <tr
                    key={`${provider.code}-${item.capability.code}`}
                    className="border-b border-[var(--border)]/70 last:border-0"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{item.capability.name}</div>
                      <div className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        {item.capability.code}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)]">
                      {item.capability.entityType}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)]">
                      {capabilityDirectionLabel(
                        item.capability.direction,
                        locale,
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={supportVariant(item.supportStatus)}>
                        {capabilitySupportLabel(item.supportStatus, locale)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">
                      {item.requiredScope ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--muted-foreground)]">
                      {item.notes ? (
                        <span>{item.notes}</span>
                      ) : item.sourceUrl ? (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                        >
                          {t("sourceLink")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
