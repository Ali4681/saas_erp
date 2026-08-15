import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { companyLogoUrl } from "@/lib/company-logo";
import { getSession } from "@/lib/auth/session";

/** Always render with the current session — never serve a cached empty shell. */
export const dynamic = "force-dynamic";

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

  // Cookie-only branding — never await Nest in this layout (blocks every soft nav).
  // Tenant sessions get companyName/logoAttachmentId at login; old cookies or
  // platform-admin browsing another tenant may show a placeholder until re-login
  // or the page itself loads company details.
  const sameTenant = session.user.companyId === companyId;
  const companyName = sameTenant
    ? session.user.companyName?.trim() || null
    : null;
  const logoAttachmentId = sameTenant
    ? (session.user.logoAttachmentId ?? null)
    : null;

  return (
    <AppShell
      user={user}
      companyId={companyId}
      companyName={companyName}
      companyLogoUrl={companyLogoUrl(companyId, logoAttachmentId)}
    >
      {children}
    </AppShell>
  );
}
