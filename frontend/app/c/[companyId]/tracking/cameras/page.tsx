import TrackingDevicesPage from "../devices-panel";

export default async function CamerasPage({
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
      filter="CAMERA"
      titleKey="camerasTitle"
      descKey="camerasDesc"
      defaultType="CAMERA"
      segment="cameras"
    />
  );
}
