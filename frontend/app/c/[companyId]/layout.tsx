import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { EmployeeShell } from "@/components/layout/EmployeeShell";
import { companyLogoUrl } from "@/lib/company-logo";
import { getSession } from "@/lib/auth/session";
import { apiServer } from "@/lib/api/server";
import {
  canUseEmployeePortalPath,
  employeePortalBase,
  isCashierPortalUser,
  isCompanyEmployee,
  isEmployeePortalPath,
} from "@/lib/permissions";

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

  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const onOnboarding = pathname.includes(`/c/${companyId}/onboarding`);
  const onEmployeePortal = isEmployeePortalPath(pathname, companyId);
  const employeeUser = isCompanyEmployee(session.user);
  const cashierUser = isCashierPortalUser(session.user);

  // Cashiers / employees use the self-service portal, not company ERP root
  if (
    pathname &&
    (employeeUser || cashierUser) &&
    !onOnboarding &&
    !onEmployeePortal
  ) {
    redirect(employeePortalBase(companyId));
  }

  // Only gate when we know the path. Missing x-pathname on soft RSC navigations
  // would otherwise redirect /onboarding → /onboarding in a loop (blank page).
  if (pathname && !session.user.isPlatformAdmin && !onOnboarding) {
    let incomplete = false;
    try {
      const status = await apiServer<{
        onboarding: { completedAt: string | null };
      }>(`/companies/${companyId}/onboarding`, { companyId });
      incomplete = !status.onboarding.completedAt;
    } catch {
      // If onboarding API unavailable, do not block the app.
    }
    // redirect() throws NEXT_REDIRECT — must stay outside try/catch
    if (incomplete && !cashierUser && !employeeUser) {
      redirect(`/c/${companyId}/onboarding`);
    }
  }

  const user = {
    ...session.user,
    companyId,
    ...(session.user.isPlatformAdmin
      ? { roleCode: "PLATFORM_SUPER_ADMIN" as const, isPlatformAdmin: true }
      : {}),
  };

  // Cookie-only branding — avoid Nest for logo on every soft nav after gate.
  const sameTenant = session.user.companyId === companyId;
  const companyName = sameTenant
    ? session.user.companyName?.trim() || null
    : null;
  const logoAttachmentId = sameTenant
    ? (session.user.logoAttachmentId ?? null)
    : null;
  const logoUrl =
    sameTenant && logoAttachmentId
      ? companyLogoUrl(companyId, logoAttachmentId)
      : sameTenant && onEmployeePortal
        ? `/api/companies/${encodeURIComponent(companyId)}/logo?inline=1`
        : null;

  if (onEmployeePortal) {
    if (!canUseEmployeePortalPath(session.user, pathname, companyId)) {
      redirect(`/c/${companyId}`);
    }

    return (
      <EmployeeShell
        user={user}
        companyId={companyId}
        companyName={companyName}
        companyLogoUrl={logoUrl}
      >
        {children}
      </EmployeeShell>
    );
  }

  return (
    <AppShell
      user={user}
      companyId={companyId}
      companyName={companyName}
      companyLogoUrl={logoUrl}
    >
      {children}
    </AppShell>
  );
}
