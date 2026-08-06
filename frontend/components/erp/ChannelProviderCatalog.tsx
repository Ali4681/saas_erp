import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/i18n/config";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { providerOpsConfig } from "@/lib/provider-ops";

export async function ChannelProviderCatalog({
  providers,
  baseHref,
}: {
  providers: Array<{ code: string; name: string }>;
  baseHref: string;
}) {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("channels");

  if (providers.length === 0) {
    return (
      <Card>
        <EmptyState message={t("emptyProviders")} />
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {providers.map((provider) => {
        const ops = providerOpsConfig(provider.code, locale);
        return (
          <Link
            key={provider.code}
            href={`${baseHref}/${provider.code.toLowerCase()}`}
            className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)] hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{provider.name}</p>
              <Badge variant={ops.ready ? "success" : "warning"}>
                {ops.ready ? t("ready") : t("comingSoon")}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
              {provider.code}
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-[var(--muted-foreground)]">
              {ops.setupHint}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
