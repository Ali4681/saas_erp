import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChannelProviderCatalog } from "@/components/erp/ChannelProviderCatalog";
import { PageHeader } from "@/components/ui/PageHeader";
import { channelBySlug } from "@/lib/integrations";

export default async function CompanyChannelPage({
  params,
}: {
  params: Promise<{ companyId: string; channel: string }>;
}) {
  const { companyId, channel: channelSlug } = await params;
  const channel = channelBySlug(channelSlug);
  if (!channel) notFound();

  const t = await getTranslations("channels");
  const labelKey = channel.slug as "delivery" | "installments" | "stores";
  const descKey = `${channel.slug}Desc` as
    | "deliveryDesc"
    | "installmentsDesc"
    | "storesDesc";
  const baseHref = `/c/${companyId}/channels/${channel.slug}`;

  return (
    <div className="space-y-5">
      <PageHeader title={t(labelKey)} description={t(descKey)} />
      <ChannelProviderCatalog
        providers={[...channel.providers]}
        baseHref={baseHref}
      />
    </div>
  );
}
