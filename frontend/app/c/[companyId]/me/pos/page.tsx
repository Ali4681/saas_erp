import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { PosTerminal } from "@/components/erp/PosTerminal";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function CashierPosPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login/pos");
  if (!can(session.user, "sales.write")) {
    redirect(`/c/${companyId}/me`);
  }
  const t = await getTranslations("pos");

  return (
    <div className="space-y-3">
      <PageHeader title={t("title")} description={t("desc")} />
      <PosTerminal companyId={companyId} />
    </div>
  );
}
