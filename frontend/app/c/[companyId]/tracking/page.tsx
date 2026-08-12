import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";

export default async function TrackingHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("tracking");
  const base = `/c/${companyId}/tracking`;
  return (
    <ModuleHub
      title={t("title")}
      description={t("description")}
      links={[
        {
          href: `${base}/cameras`,
          label: t("cameras"),
          hint: t("camerasHint"),
        },
        {
          href: `${base}/biometrics`,
          label: t("biometrics"),
          hint: t("biometricsHint"),
        },
        {
          href: `${base}/events`,
          label: t("events"),
          hint: t("eventsHint"),
        },
      ]}
    />
  );
}
