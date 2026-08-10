"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  Boxes,
  Brain,
  ChevronDown,
  ClipboardList,
  Handshake,
  Home,
  Layers,
  Megaphone,
  NotebookPen,
  Package,
  PanelLeft,
  Plug,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  Workflow,
  Bell,
  Paperclip,
  ChartColumnIncreasing,
} from "lucide-react";
import type { AuthUser } from "@/lib/types/auth";
import { can } from "@/lib/permissions";
import { platformNav, tenantNav, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/Separator";
import { useTranslations } from "next-intl";

function useResolveNavLabel() {
  const t = useTranslations("nav");
  return (item: NavItem) =>
    item.labelKey ? t(item.labelKey) : (item.label ?? item.href);
}

function filterItems(user: AuthUser, items: NavItem[]): NavItem[] {
  return items
    .filter((item) => {
      if (item.platformOnly && !user.isPlatformAdmin) return false;
      if (!item.permissions?.length) return true;
      return can(user, ...item.permissions);
    })
    .map((item) =>
      item.children?.length
        ? { ...item, children: filterItems(user, item.children) }
        : item,
    );
}

function iconFor(href: string) {
  if (href === "/platform") return Layers;
  if (href.includes("/companies")) return Building2;
  if (href.includes("/plans")) return Package;
  if (href.includes("/retention")) return Trash2;
  if (href.match(/\/c\/[^/]+$/)) return Home;
  if (href.includes("/channels/delivery")) return Package;
  if (href.includes("/channels/installments")) return Wallet;
  if (href.includes("/channels/stores")) return ShoppingCart;
  if (href.includes("/crm")) return Handshake;
  if (href.includes("/sales")) return Receipt;
  if (href.includes("/purchasing")) return ShoppingCart;
  if (href.includes("/inventory")) return Boxes;
  if (href.includes("/finance")) return Wallet;
  if (href.includes("/hr")) return Users;
  if (href.includes("/work")) return ClipboardList;
  if (href.includes("/notebook")) return NotebookPen;
  if (href.includes("/marketing")) return Megaphone;
  if (href.includes("/ai")) return Brain;
  if (href.includes("/reports")) return ChartColumnIncreasing;
  if (href.includes("/automation")) return Workflow;
  if (href.includes("/integrations")) return Plug;
  if (href.includes("/attachments")) return Paperclip;
  if (href.includes("/audit")) return Shield;
  if (href.includes("/notifications")) return Bell;
  if (href.includes("/roles")) return Shield;
  if (href.includes("/settings") || href.includes("/users")) return Settings;
  return Sparkles;
}

function isPathActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionInPath(pathname: string, item: NavItem): boolean {
  if (isPathActive(pathname, item.href)) return true;
  return Boolean(item.children?.some((c) => sectionInPath(pathname, c)));
}

function BrandMark({
  companyId,
  companyName,
  companyLogoUrl,
  className,
  logoAlt,
}: {
  companyId?: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  className?: string;
  logoAlt?: string;
}) {
  if (companyLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={companyLogoUrl}
        alt={companyName ?? logoAlt ?? "Logo"}
        className={cn(
          "rounded-lg object-cover ring-1 ring-white/10",
          className,
        )}
      />
    );
  }

  // Platform admin — product logo from /public/logo.svg
  if (!companyId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo.svg"
        alt="SaaS ERP"
        className={cn(
          "rounded-lg object-contain bg-white/95 p-0.5 ring-1 ring-white/10",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-[var(--sidebar-active)] text-[var(--primary-foreground)]",
        className,
      )}
    >
      <Building2 className="h-4 w-4" />
    </div>
  );
}

function NavGroup({
  item,
  companyId,
  expandedHref,
  onExpand,
}: {
  item: NavItem;
  companyId?: string;
  /** Accordion: only this sibling href stays open at this level. */
  expandedHref: string | null;
  onExpand: (href: string | null) => void;
}) {
  const pathname = usePathname();
  const resolveNavLabel = useResolveNavLabel();
  const t = useTranslations("common");
  const label = resolveNavLabel(item);
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const isSectionRoot =
    item.href === "/platform" ||
    Boolean(companyId && item.href === `/c/${companyId}`);
  const parentActive = isSectionRoot
    ? pathname === item.href
    : pathname === item.href;
  const sectionActive = isSectionRoot
    ? pathname === item.href
    : sectionInPath(pathname, item);

  const open = hasChildren && expandedHref === item.href;

  const [nestedExpandedHref, setNestedExpandedHref] = useState<string | null>(
    () => {
      const nested = children.find(
        (c) => c.children?.length && sectionInPath(pathname, c),
      );
      return nested?.href ?? null;
    },
  );

  useEffect(() => {
    if (!open) return;
    const nested = children.find(
      (c) => c.children?.length && sectionInPath(pathname, c),
    );
    if (nested) setNestedExpandedHref(nested.href);
  }, [open, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleOpen() {
    onExpand(open ? null : item.href);
  }

  const Icon = iconFor(item.href);
  const active = parentActive || (sectionActive && !hasChildren);
  const rowClass = cn(
    "group flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-200",
    active
      ? "bg-[var(--sidebar-active)] font-medium text-[var(--primary-foreground)] shadow-[0_8px_20px_-12px_var(--sidebar-glow)]"
      : sectionActive
        ? "bg-[var(--sidebar-active-soft)] font-medium text-[var(--sidebar-foreground)]"
        : "text-[var(--sidebar-foreground)]/85 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]",
  );

  return (
    <div className="space-y-0.5">
      {hasChildren ? (
        <div className={rowClass}>
          <Link
            href={item.href}
            className="flex min-w-0 flex-1 items-center gap-2.5"
            onClick={() => onExpand(item.href)}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition",
                active || sectionActive
                  ? "opacity-100"
                  : "opacity-70 group-hover:opacity-100",
              )}
            />
            <span className="min-w-0 flex-1 truncate text-start">{label}</span>
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-label={
              open
                ? `${t("collapse")} ${label}`
                : `${t("expand")} ${label}`
            }
            onClick={toggleOpen}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--sidebar-accent)]"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 opacity-80 transition-transform duration-200",
                open ? "rotate-180" : "rotate-0",
              )}
            />
          </button>
        </div>
      ) : (
        <Link href={item.href} className={rowClass}>
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition",
              active || sectionActive
                ? "opacity-100"
                : "opacity-70 group-hover:opacity-100",
            )}
          />
          <span className="truncate">{label}</span>
        </Link>
      )}

      {hasChildren && open ? (
        <ul className="ms-4 space-y-0.5 border-s border-[var(--sidebar-border)]/80 ps-2">
          {children.map((child) => {
            if (child.children?.length) {
              return (
                <li key={child.href}>
                  <NavGroup
                    item={child}
                    companyId={companyId}
                    expandedHref={nestedExpandedHref}
                    onExpand={setNestedExpandedHref}
                  />
                </li>
              );
            }
            const childActive = pathname === child.href;
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    "block rounded-lg px-3 py-1.5 text-[13px] transition-all duration-200",
                    childActive
                      ? "bg-[var(--sidebar-active)] font-medium text-[var(--primary-foreground)] shadow-sm"
                      : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]",
                  )}
                >
                  {resolveNavLabel(child)}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function CollapsedNavLink({
  item,
  companyId,
}: {
  item: NavItem;
  companyId?: string;
}) {
  const pathname = usePathname();
  const resolveLabel = useResolveNavLabel();
  const label = resolveLabel(item);
  const isSectionRoot =
    item.href === "/platform" ||
    Boolean(companyId && item.href === `/c/${companyId}`);
  const active = isSectionRoot
    ? pathname === item.href
    : isPathActive(pathname, item.href) || sectionInPath(pathname, item);
  const Icon = iconFor(item.href);

  return (
    <Link
      href={item.href}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
        active
          ? "bg-[var(--sidebar-active)] text-[var(--primary-foreground)] shadow-[0_8px_18px_-10px_var(--sidebar-glow)]"
          : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]",
      )}
    >
      <Icon className="h-4 w-4" />
    </Link>
  );
}

export function Sidebar({
  user,
  companyId,
  companyName,
  companyLogoUrl,
  open,
  onToggle,
}: {
  user: AuthUser;
  companyId?: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  // After collapse, ignore hover swap briefly so the logo doesn't flash to PanelLeft
  // while the pointer is still over the toggle button.
  const [hoverReady, setHoverReady] = useState(true);
  const t = useTranslations("common");
  const pathname = usePathname();

  const items = companyId
    ? filterItems(user, tenantNav(companyId))
    : user.isPlatformAdmin
      ? filterItems(user, platformNav())
      : [];

  const [expandedHref, setExpandedHref] = useState<string | null>(() => {
    const active = items.find(
      (item) => item.children?.length && sectionInPath(pathname, item),
    );
    return active?.href ?? null;
  });

  useEffect(() => {
    if (open) {
      setHoverReady(true);
      return;
    }
    setHoverReady(false);
    const id = window.setTimeout(() => setHoverReady(true), 280);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const active = items.find(
      (item) => item.children?.length && sectionInPath(pathname, item),
    );
    if (active) setExpandedHref(active.href);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside
    className={cn(
      "sidebar-shell relative sticky top-0 z-40 flex h-dvh max-h-dvh shrink-0 flex-col border-l border-[var(--sidebar-border)] text-[var(--sidebar-foreground)]",
      "transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
      open ? "w-64" : "w-[3.75rem] items-center",
    )}
  >
    {open ? (
      <div className="relative z-[2] flex h-full min-h-0 w-64 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
          <div className="flex min-w-0 items-center gap-2.5 px-1">
            <BrandMark
              companyId={companyId}
              companyName={companyName}
              companyLogoUrl={companyLogoUrl}
              logoAlt={t("companyLogo")}
              className="h-8 w-8"
            />
            <p className="truncate text-sm font-semibold text-[var(--sidebar-foreground)]">
              SaaS ERP
            </p>
          </div>
  
          <button
            type="button"
            onClick={onToggle}
            aria-label={t("closeSidebar")}
            title={t("closeSidebarShort")}
            className="sidebar-toggle-hit flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
          >
            <PanelLeft className="h-[18px] w-[18px] rtl:rotate-180" strokeWidth={1.75} />
          </button>
        </div>
  
        <Separator className="shrink-0 bg-[var(--sidebar-border)]" />
  
        <nav className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 pe-1.5">
          {items.map((item) => (
            <NavGroup
              key={item.href}
              item={item}
              companyId={companyId}
              expandedHref={expandedHref}
              onExpand={setExpandedHref}
            />
          ))}
        </nav>
  
        <div className="shrink-0 border-t border-[var(--sidebar-border)] px-4 py-3">
          <p
            className="truncate text-sm font-semibold text-[var(--sidebar-foreground)]"
            title={
              companyId
                ? companyName?.trim() || undefined
                : t("platformSpace")
            }
          >
            {companyId ? companyName?.trim() || "—" : t("platformSpace")}
          </p>
        </div>
      </div>
    ) : (
      <div className="relative z-[2] flex h-full min-h-0 w-full flex-col items-center overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          aria-label={t("openSidebar")}
          title={t("openSidebarShort")}
          className={cn(
            "sidebar-toggle-hit group relative mt-3 mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            "transition-colors duration-200 hover:bg-[var(--sidebar-accent)]",
          )}
        >
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out",
              hoverReady ? "group-hover:opacity-0" : "opacity-100",
            )}
          >
            <BrandMark
              companyId={companyId}
              companyName={companyName}
              companyLogoUrl={companyLogoUrl}
              logoAlt={t("companyLogo")}
              className="h-8 w-8"
            />
          </span>
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-200 ease-out",
              hoverReady
                ? "opacity-0 group-hover:opacity-100"
                : "opacity-0",
            )}
            aria-hidden
          >
            <PanelLeft
              className="h-[18px] w-[18px] text-[var(--sidebar-foreground)] rtl:rotate-180"
              strokeWidth={1.75}
            />
          </span>
        </button>
  
        <Separator className="mb-2 w-8 shrink-0 bg-[var(--sidebar-border)]" />
  
        <nav className="sidebar-scroll flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto overscroll-contain px-1.5 pb-3">
          {items.map((item) => (
            <CollapsedNavLink
              key={item.href}
              item={item}
              companyId={companyId}
            />
          ))}
        </nav>
      </div>
    )}
  </aside>  
  );
}
