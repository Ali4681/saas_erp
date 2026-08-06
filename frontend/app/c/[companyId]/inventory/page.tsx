import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function InventoryHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("inventory");
  const base = `/c/${companyId}/inventory`;
  return (
    <ModuleHub
      title={t("title")}
      description={t("description")}
      links={[
        { href: `${base}/items`, label: t("items"), hint: t("itemsHint") },
        {
          href: `${base}/warehouses`,
          label: t("warehouses"),
          hint: t("warehousesHint"),
        },
        {
          href: `${base}/movements`,
          label: t("movements"),
          hint: t("movementsHint"),
        },
        { href: `${base}/counts`, label: t("counts"), hint: t("countsHint") },
        {
          href: `${base}/balances`,
          label: t("balances"),
          hint: t("balancesHint"),
        },
      ]}
    />
  );
}
