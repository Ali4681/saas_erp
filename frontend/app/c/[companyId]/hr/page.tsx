import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function HrHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("hr");
  const base = `/c/${companyId}/hr`;
  return (
    <ModuleHub
      title={t("title")}
      description={t("description")}
      links={[
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
          href: `${base}/attendance`,
          label: t("attendance"),
          hint: t("attendanceHint"),
        },
        {
          href: `/c/${companyId}/tracking`,
          label: t("devices"),
          hint: t("devicesHint"),
        },
        { href: `${base}/leaves`, label: t("leaves"), hint: t("leavesHint") },
        {
          href: `${base}/payroll`,
          label: t("payroll"),
          hint: t("payrollHint"),
        },
        {
          href: `${base}/me`,
          label: t("me"),
          hint: t("meHint"),
        },
      ]}
    />
  );
}
