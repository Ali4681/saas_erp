import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function NotebookHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("notebook");
  const base = `/c/${companyId}/notebook`;
  return (
    <ModuleHub
      title={t("title")}
      description={t("description")}
      links={[
        { href: `${base}/notes`, label: t("notes"), hint: t("notesHint") },
        {
          href: `${base}/categories`,
          label: t("categories"),
          hint: t("categoriesHint"),
        },
      ]}
    />
  );
}
