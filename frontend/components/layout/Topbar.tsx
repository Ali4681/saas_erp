"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowRightLeft,
  Building2,
  LogOut,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import type { AuthUser } from "@/lib/types/auth";
import { BFF_AUTH } from "@/lib/auth/bff-paths";
import { can, roleKey } from "@/lib/permissions";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationBellDropdown } from "@/components/layout/NotificationBellDropdown";
import { cn } from "@/lib/utils";

function useSectionTitle(pathname: string, companyId?: string) {
  const t = useTranslations("sections");
  const tCommon = useTranslations("common");

  if (!companyId) {
    if (pathname.startsWith("/platform/companies")) return t("companies");
    if (pathname.startsWith("/platform/plans")) return t("plans");
    if (pathname.startsWith("/platform/retention")) return t("retention");
    return t("platformHome");
  }
  const base = `/c/${companyId}`;
  const rest = pathname.startsWith(base)
    ? pathname.slice(base.length).replace(/^\//, "")
    : "";
  const root = rest.split("/")[0] ?? "";
  const map: Record<string, string> = {
    "": t("home"),
    crm: t("crm"),
    sales: t("sales"),
    purchasing: t("purchasing"),
    inventory: t("inventory"),
    finance: t("finance"),
    hr: t("hr"),
    tracking: t("tracking"),
    work: t("work"),
    notebook: t("notebook"),
    marketing: t("marketing"),
    ai: t("ai"),
    reports: t("reports"),
    automation: t("automation"),
    integrations: t("integrations"),
    attachments: t("attachments"),
    audit: t("audit"),
    settings: t("settings"),
    users: t("users"),
    roles: t("roles"),
    notifications: t("notifications"),
    channels: t("channels"),
  };
  return map[root] ?? tCommon("dashboard");
}

export function Topbar({
  user,
  companyId,
  companyName,
  companyLogoUrl,
  onMenuClick,
  menuOpen,
  showMenuButton = false,
}: {
  user: AuthUser;
  companyId?: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  showMenuButton?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("common");
  const tRoles = useTranslations("roles");
  const title = useSectionTitle(pathname, companyId);
  const displayCompany = companyName?.trim() || null;

  function logout() {
    void fetch(BFF_AUTH.logout, { method: "POST" });
    router.replace(user.isPlatformAdmin ? "/admin/login" : "/login");
  }

  return (
    <header className="topbar-shell">
      <div className="topbar-content flex items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-4 md:gap-4 md:px-6 md:py-3.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
          {showMenuButton && onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label={menuOpen ? t("closeSidebar") : t("openSidebar")}
              aria-expanded={Boolean(menuOpen)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/80 text-[var(--foreground)] transition hover:bg-[var(--accent)]"
            >
              {menuOpen ? (
                <X className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Menu className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          ) : null}

          <div className="relative hidden shrink-0 sm:block">
            <div className="topbar-avatar-ring rounded-2xl p-[2px]">
              {companyLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={companyLogoUrl}
                  alt={displayCompany || user.fullName || t("companyLogo")}
                  className="h-9 w-9 rounded-[14px] object-cover bg-[var(--card)] md:h-11 md:w-11"
                />
              ) : !companyId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/logo.svg"
                  alt="SaaS ERP"
                  className="h-9 w-9 rounded-[14px] object-contain bg-[var(--card)] p-1 md:h-11 md:w-11"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)] md:h-11 md:w-11 md:text-base">
                  {(displayCompany || user.fullName || "U").slice(0, 1)}
                </div>
              )}
            </div>
            <span className="absolute -bottom-0.5 -left-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--primary)] ring-2 ring-[var(--card)] md:h-4 md:w-4">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight text-[var(--foreground)] md:text-lg">
                {title}
              </h1>
              {displayCompany ? (
                <span className="hidden items-center gap-1.5 rounded-full border border-[var(--primary)]/20 bg-[var(--accent)]/70 px-2.5 py-0.5 text-[11px] font-medium text-[var(--primary)] sm:inline-flex">
                  <Building2 className="h-3 w-3" />
                  <span className="max-w-[10rem] truncate">{displayCompany}</span>
                </span>
              ) : (
                <span className="hidden items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-300 sm:inline-flex">
                  <Sparkles className="h-3 w-3" />
                  {t("platform")}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
              {user.fullName}
              <span className="mx-1.5 text-[var(--border)]">•</span>
              <span className="text-[var(--primary)]">
                {tRoles(roleKey(user))}
              </span>
              {user.email ? (
                <>
                  <span className="mx-1.5 hidden text-[var(--border)] sm:inline">
                    •
                  </span>
                  <span className="hidden sm:inline">{user.email}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 md:gap-2">
          <ThemeToggle />
          <LanguageToggle />

          {user.isPlatformAdmin && companyId ? (
            <Link
              href="/platform"
              className={cn(
                "hidden items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 text-xs font-medium text-[var(--foreground)] shadow-sm transition md:inline-flex",
                "hover:-translate-y-0.5 hover:border-[var(--primary)]/30 hover:bg-[var(--accent)] hover:text-[var(--primary)]",
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {t("platform")}
            </Link>
          ) : null}

          {user.isPlatformAdmin && companyId ? (
            <Link
              href={`/platform/companies/${companyId}`}
              className={cn(
                "hidden items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)]/70 px-3 py-2 text-xs font-medium text-[var(--foreground)] shadow-sm transition lg:inline-flex",
                "hover:-translate-y-0.5 hover:border-[var(--primary)]/30 hover:bg-[var(--accent)] hover:text-[var(--primary)]",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              {t("subscription")}
            </Link>
          ) : null}

          {companyId && can(user, "notifications.read") ? (
            <NotificationBellDropdown companyId={companyId} />
          ) : null}

          <button
            type="button"
            onClick={logout}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-xl border border-transparent bg-[var(--primary)] px-2.5 text-xs font-medium text-[var(--primary-foreground)] shadow-[0_10px_24px_-12px_var(--brand-glow)] transition sm:h-10 sm:px-3",
              "hover:-translate-y-0.5 hover:brightness-110",
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("logout")}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
