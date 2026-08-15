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
        {
          href: `${base}/problems`,
          label: t("bucketProblems"),
          hint: t("bucketProblemsHint"),
        },
        {
          href: `${base}/dev-ideas`,
          label: t("bucketDevIdeas"),
          hint: t("bucketDevIdeasHint"),
        },
        {
          href: `${base}/work-notes`,
          label: t("bucketWorkNotes"),
          hint: t("bucketWorkNotesHint"),
        },
      ]}
    />
  );
}
