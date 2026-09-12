import { redirect } from "next/navigation";

export default async function HrMeRedirectPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/me/profile`);
}
