import { channelBySlug } from "@/lib/integrations";
import { notFound } from "next/navigation";
import {
  isHsHubSection,
  ProviderChannelPage,
} from "../provider-channel-page";

export default async function HungerStationHubSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{
    companyId: string;
    channel: string;
    providerCode: string;
    hubSection: string;
  }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const {
    companyId,
    channel: channelSlug,
    providerCode: rawCode,
    hubSection,
  } = await params;
  const flash = await searchParams;
  const channel = channelBySlug(channelSlug);
  if (!channel) notFound();

  const providerCode = rawCode.toUpperCase();
  if (providerCode !== "HUNGERSTATION") notFound();
  if (!channel.providers.some((p) => p.code === providerCode)) notFound();
  if (!isHsHubSection(hubSection)) notFound();

  return (
    <ProviderChannelPage
      companyId={companyId}
      channelSlug={channelSlug}
      rawCode={rawCode}
      hubSection={hubSection}
      flash={flash}
    />
  );
}
