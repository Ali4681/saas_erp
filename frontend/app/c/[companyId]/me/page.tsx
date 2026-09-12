import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CalendarDays,
  Clock,
  ShoppingCart,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSession } from "@/lib/auth/session";
import { fetchMyProfile } from "@/lib/hr/my-profile";
import {
  can,
  employeePortalBase,
  isCashierPortalUser,
} from "@/lib/permissions";

export default async function EmployeePortalHomePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("employeePortal");
  const tHr = await getTranslations("hr");
  const session = await getSession();
  const base = employeePortalBase(companyId);
  const me = await fetchMyProfile(companyId);
  const showPos =
    can(session?.user, "sales.write") || isCashierPortalUser(session?.user);

  const links = [
    ...(showPos
      ? [{ href: `${base}/pos`, label: t("pos"), icon: ShoppingCart }]
      : []),
    { href: `${base}/profile`, label: t("profile"), icon: User },
    { href: `${base}/attendance`, label: t("attendance"), icon: Clock },
    { href: `${base}/sales`, label: t("sales"), icon: TrendingUp },
    { href: `${base}/leaves`, label: t("leaves"), icon: CalendarDays },
    { href: `${base}/advances`, label: t("advances"), icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t("homeTitle")} description={t("homeDesc")} />

      {!me ? (
        <Card>
          <EmptyState message={tHr("meNoProfile")} />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-[var(--primary)]/15 via-[var(--card)] to-[var(--card)] p-5">
            <p className="text-sm text-[var(--muted-foreground)]">
              {me.jobTitle ?? tHr("titleCol")}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{me.fullName}</h2>
            <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
              {me.employeeNumber}
            </p>
          </Card>

          <div>
            <h3 className="mb-3 text-sm font-semibold">{t("homeQuickLinks")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--primary)]/40 hover:shadow-sm"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
