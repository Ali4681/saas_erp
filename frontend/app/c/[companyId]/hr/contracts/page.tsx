import { redirect } from "next/navigation";

/** HR internal contracts replaced by Qiwa fields on the employee profile. */
export default async function HrContractsRedirect({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/hr/employees`);
}
