import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function SalesHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("sales");
  const base = `/c/${companyId}/sales`;
  return (
    <ModuleHub
      title={t("hub.title")}
      description={t("hub.description")}
      links={[
        {
          href: `${base}/quotes`,
          label: t("hub.quotes"),
          hint: t("hub.quotesHint"),
        },
        {
          href: `${base}/invoices`,
          label: t("hub.invoices"),
          hint: t("hub.invoicesHint"),
        },
        {
          href: `${base}/credit-notes`,
          label: t("hub.creditNotes"),
          hint: t("hub.creditNotesHint"),
        },
        {
          href: `${base}/ar-aging`,
          label: t("hub.arAging"),
          hint: t("hub.arAgingHint"),
        },
        {
          href: `${base}/channels`,
          label: t("hub.channels"),
          hint: t("hub.channelsHint"),
        },
        {
          href: `${base}/customer-pos`,
          label: t("customerPo.title"),
          hint: t("customerPo.title"),
        },
        {
          href: `${base}/ops-reports`,
          label: t("opsReports.title"),
          hint: t("opsReports.description"),
        },
      ]}
    />
  );
}
