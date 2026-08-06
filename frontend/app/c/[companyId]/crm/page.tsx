import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function CrmHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("crm");
  const base = `/c/${companyId}/crm`;
  return (
    <ModuleHub
      title={t("hub.title")}
      description={t("hub.description")}
      links={[
        {
          href: `${base}/contacts`,
          label: t("hub.contacts"),
          hint: t("hub.contactsHint"),
        },
        {
          href: `${base}/opportunities`,
          label: t("hub.opportunities"),
          hint: t("hub.opportunitiesHint"),
        },
        {
          href: `${base}/activities`,
          label: t("hub.activities"),
          hint: t("hub.activitiesHint"),
        },
        {
          href: `${base}/contracts`,
          label: t("hub.contracts"),
          hint: t("hub.contractsHint"),
        },
      ]}
    />
  );
}
