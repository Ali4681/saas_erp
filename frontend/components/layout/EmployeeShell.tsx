"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Banknote,
  CalendarDays,
  Clock,
  Home,
  LogOut,
  Menu,
  Settings,
  ShoppingCart,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/types/auth";
import { BFF_AUTH } from "@/lib/auth/bff-paths";
import {
  can,
  employeePortalBase,
  isCashierPortalUser,
} from "@/lib/permissions";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { NotificationBellDropdown } from "@/components/layout/NotificationBellDropdown";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: string;
  icon: typeof Home;
  exact?: boolean;
};

export function EmployeeShell({
  user,
  companyId,
  companyName,
  companyLogoUrl,
  children,
}: {
  user: AuthUser;
  companyId: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("employeePortal");
  const pathname = usePathname();
  const base = employeePortalBase(companyId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const showPos = can(user, "sales.write") || isCashierPortalUser(user);
  const onPos =
    pathname === `${base}/pos` || pathname.startsWith(`${base}/pos/`);

  useEffect(() => {
    setLogoFailed(false);
  }, [companyLogoUrl]);

  const nav: NavItem[] = [
    { href: base, labelKey: "home", icon: Home, exact: true },
    ...(showPos
      ? [{ href: `${base}/pos`, labelKey: "pos", icon: ShoppingCart }]
      : []),
    { href: `${base}/profile`, labelKey: "profile", icon: User },
    { href: `${base}/attendance`, labelKey: "attendance", icon: Clock },
    { href: `${base}/sales`, labelKey: "sales", icon: TrendingUp },
    { href: `${base}/leaves`, labelKey: "leaves", icon: CalendarDays },
    { href: `${base}/advances`, labelKey: "advances", icon: Banknote },
    { href: `${base}/wallet`, labelKey: "walletWithdraw", icon: Wallet },
    { href: `${base}/settings`, labelKey: "settings", icon: Settings },
  ];

  const primaryMobile = showPos
    ? [nav[0]!, nav[1]!, ...nav.filter((n) => !showPos || (n.labelKey !== "pos" && n.labelKey !== "home")).slice(0, 2)]
    : nav.slice(0, 4);
  const moreMobile = nav.filter(
    (n) => !primaryMobile.some((p) => p.href === n.href),
  );

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
    const Icon = item.icon;
    const active = isActive(item.href, item.exact);
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          active
            ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{t(item.labelKey)}</span>
      </Link>
    );
  }

  async function logout() {
    try {
      await fetch(BFF_AUTH.logout, { method: "POST", credentials: "include" });
    } catch {
      /* still redirect */
    }
    window.location.assign("/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
        <div
          className={cn(
            "mx-auto flex h-14 items-center justify-between gap-3 px-4",
            onPos ? "max-w-[1600px]" : "max-w-5xl",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            {companyLogoUrl && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={companyLogoUrl}
                alt=""
                className="h-9 w-9 rounded-lg border border-[var(--border)] object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                {(companyName ?? "Co").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {companyName ?? t("portalTitle")}
              </p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {user.fullName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {can(user, "notifications.read") ? (
              <NotificationBellDropdown companyId={companyId} />
            ) : null}
            <LanguageToggle />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              aria-label={t("logout")}
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] lg:hidden"
              aria-label={t("menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto flex w-full flex-1 gap-6 px-4 py-5",
          onPos ? "max-w-[1600px] pb-5" : "max-w-5xl pb-24 lg:pb-5",
        )}
      >
        {!onPos ? (
          <aside className="hidden w-52 shrink-0 lg:block">
            <nav className="sticky top-20 space-y-1">
              {nav.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </nav>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {!onPos ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 py-2">
            {primaryMobile.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium",
                    active
                      ? "text-[var(--primary)]"
                      : "text-[var(--muted-foreground)]",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium",
                moreMobile.some((item) => isActive(item.href, item.exact))
                  ? "text-[var(--primary)]"
                  : "text-[var(--muted-foreground)]",
              )}
            >
              <Menu className="h-5 w-5" />
              <span>{t("more")}</span>
            </button>
          </div>
        </nav>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl">
            <p className="mb-3 text-sm font-semibold">{t("menu")}</p>
            <nav className="space-y-1">
              {(onPos ? nav : moreMobile).map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
