import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { apiServer } from "@/lib/api/server";
import { companyLogoUrl } from "@/lib/company-logo";
import { getSession } from "@/lib/auth/session";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.isPlatformAdmin) {
    // platform admin can open a company context later; for now allow read shell
  } else if (session.user.companyId !== companyId) {
    redirect(session.user.companyId ? `/c/${session.user.companyId}` : "/login");
  }

  const user = {
    ...session.user,
    companyId,
    ...(session.user.isPlatformAdmin
      ? { roleCode: "PLATFORM_SUPER_ADMIN" as const, isPlatformAdmin: true }
      : {}),
  };

  const company = await apiServer<{
    displayName: string;
    legalName?: string;
    logoAttachmentId?: string | null;
  }>(`/companies/${companyId}`, { companyId }).catch(() => null);

  const companyName =
    company?.displayName?.trim() || company?.legalName?.trim() || null;

  return (
    <AppShell
      user={user}
      companyId={companyId}
      companyName={companyName}
      companyLogoUrl={companyLogoUrl(companyId, company?.logoAttachmentId)}
    >
      {children}
    </AppShell>
  );
}
