import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";
import { getSession } from "@/lib/auth/session";
import { canAny } from "@/lib/permissions";

export default async function HrHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("hr");
  const session = await getSession();
  const user = session?.user;
  const base = `/c/${companyId}/hr`;
  const canManageHr = canAny(user, "hr.read");
  const canSelf = canAny(user, "hr.self", "hr.read");

  const links = [
    ...(canManageHr
      ? [
          {
            href: `${base}/employees`,
            label: t("employees"),
            hint: t("employeesHint"),
          },
          {
            href: `${base}/advances`,
            label: t("advances"),
            hint: t("advancesHint"),
          },
          {
            href: `${base}/leaves`,
            label: t("leaves"),
            hint: t("leavesHint"),
          },
          {
            href: `${base}/sales-submissions`,
            label: t("salesSubmissions"),
            hint: t("salesSubmissionsHint"),
          },
        ]
      : []),
    ...(canSelf
      ? [
          {
            href: `${base}/me`,
            label: t("me"),
            hint: t("meHint"),
          },
        ]
      : []),
  ];

  return (
    <ModuleHub title={t("title")} description={t("description")} links={links} />
  );
}
