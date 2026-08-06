import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth/session";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }
  if (!session.user.isPlatformAdmin) {
    redirect(
      session.user.companyId ? `/c/${session.user.companyId}` : "/login",
    );
  }
  return <AppShell user={session.user}>{children}</AppShell>;
}
