import { PosCashierHub } from "@/components/erp/PosCashierHub";
import { companyLogoUrl } from "@/lib/company-logo";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import {
  canAccessPos,
  isCashierPortalUser,
} from "@/lib/permissions";

export default async function CashierPosPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login/pos");
  if (
    !canAccessPos(session.user) &&
    !isCashierPortalUser(session.user)
  ) {
    redirect(`/c/${companyId}/me`);
  }

  const logoAttachmentId = session.user.logoAttachmentId ?? null;

  return (
    <PosCashierHub
      companyId={companyId}
      companyName={session.user.companyName}
      companyLogoUrl={
        logoAttachmentId
          ? companyLogoUrl(companyId, logoAttachmentId)
          : `/api/companies/${encodeURIComponent(companyId)}/logo?inline=1`
      }
    />
  );
}
