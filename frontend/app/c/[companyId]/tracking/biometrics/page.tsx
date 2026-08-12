import TrackingDevicesPage from "../devices-panel";

export default async function BiometricsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  return (
    <TrackingDevicesPage
      params={params}
      searchParams={searchParams}
      filter="BIOMETRIC"
      titleKey="biometricsTitle"
      descKey="biometricsDesc"
      defaultType="BIOMETRIC"
      segment="biometrics"
    />
  );
}
