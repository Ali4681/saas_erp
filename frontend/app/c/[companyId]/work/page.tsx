import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function WorkHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("work");
  return (
    <ModuleHub
      title={t("title")}
      description={t("description")}
      links={[
        {
          href: `/c/${companyId}/work/projects`,
          label: t("projects"),
          hint: t("projectsHint"),
        },
      ]}
    />
  );
}
