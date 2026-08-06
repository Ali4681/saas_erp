import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import {
  groupProvidersByCategory,
  type IntegrationProvider,
} from "@/lib/integrations";

const CATEGORY_KEYS: Record<
  string,
  "delivery" | "installments" | "stores"
> = {
  DELIVERY: "delivery",
  INSTALLMENT: "installments",
  ECOMMERCE: "stores",
};

export async function IntegrationProviderCatalog({
  providers,
}: {
  providers: IntegrationProvider[];
}) {
  const tChannels = await getTranslations("channels");
  const tIntegrations = await getTranslations("integrations");
  const sections = groupProvidersByCategory(providers);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {sections.map((section) => {
        const key = CATEGORY_KEYS[section.code];
        const title = key ? tChannels(key) : section.label;
        return (
          <Card key={section.code} title={title}>
            {section.providers.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                {tIntegrations("emptyCategoryProviders")}
              </p>
            ) : (
              <ul className="space-y-2">
                {section.providers.map((provider) => (
                  <li
                    key={provider.code}
                    className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2.5"
                  >
                    <p className="font-medium">{provider.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--muted-foreground)]">
                      {provider.code}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
