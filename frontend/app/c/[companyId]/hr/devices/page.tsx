import { redirect } from "next/navigation";

/** Devices moved to Tracking module. */
export default async function HrDevicesRedirect({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/tracking`);
}
