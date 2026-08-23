import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PricingHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("crm");

  const tiles = [
    {
      href: `/c/${companyId}/crm/pricing/price-lists`,
      title: t("pricing.priceListsTitle"),
      hint: t("pricing.priceListsHint"),
    },
    {
      href: `/c/${companyId}/crm/pricing/coupons`,
      title: t("pricing.couponsTitle"),
      hint: t("pricing.couponsHint"),
    },
    {
      href: `/c/${companyId}/crm/pricing/bundles`,
      title: t("pricing.bundlesTitle"),
      hint: t("pricing.bundlesHint"),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("pricing.title")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {tiles.map((tile) => (
          <a key={tile.href} href={tile.href} className="block">
            <Card className="hover:border-[var(--color-primary)] transition-colors">
              <p className="font-semibold">{tile.title}</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">{tile.hint}</p>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
