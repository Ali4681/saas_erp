import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function PurchasingHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("purchasing");
  const base = `/c/${companyId}/purchasing`;
  return (
    <ModuleHub
      title={t("hub.title")}
      description={t("hub.description")}
      links={[
        {
          href: `${base}/suppliers`,
          label: t("hub.suppliers"),
          hint: t("hub.suppliersHint"),
        },
        {
          href: `${base}/purchase-orders`,
          label: t("hub.purchaseOrders"),
          hint: t("hub.purchaseOrdersHint"),
        },
        {
          href: `${base}/bills`,
          label: t("hub.bills"),
          hint: t("hub.billsHint"),
        },
        {
          href: `${base}/operators`,
          label: t("hub.operators"),
          hint: t("hub.operatorsHint"),
        },
      ]}
    />
  );
}
