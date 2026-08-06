import { channelBySlug } from "@/lib/integrations";
import { notFound } from "next/navigation";
import { ProviderChannelPage } from "./provider-channel-page";

export default async function CompanyChannelProviderPage({
  params,
  searchParams,
}: {
  params: Promise<{
    companyId: string;
    channel: string;
    providerCode: string;
  }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const {
    companyId,
    channel: channelSlug,
    providerCode: rawCode,
  } = await params;
  const flash = await searchParams;
  const channel = channelBySlug(channelSlug);
  if (!channel) notFound();

  const providerCode = rawCode.toUpperCase();
  if (!channel.providers.some((p) => p.code === providerCode)) notFound();

  return (
    <ProviderChannelPage
      companyId={companyId}
      channelSlug={channelSlug}
      rawCode={rawCode}
      flash={flash}
    />
  );
}
