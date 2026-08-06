import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function MarketingHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("marketing");
  const base = `/c/${companyId}/marketing`;
  return (
    <ModuleHub
      title={t("title")}
      description={t("description")}
      links={[
        { href: `${base}/posts`, label: t("posts"), hint: t("postsHint") },
        {
          href: `${base}/calendar`,
          label: t("calendar"),
          hint: t("calendarHint"),
        },
        {
          href: `${base}/connections`,
          label: t("connections"),
          hint: t("connectionsHint"),
        },
      ]}
    />
  );
}
