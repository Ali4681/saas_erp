"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/types/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { FcmAutoRegister } from "@/components/erp/FcmAutoRegister";
import { can } from "@/lib/permissions";
import dynamic from "next/dynamic";

const AiChatWidget = dynamic(
  () =>
    import("@/components/erp/AiChatWidget").then((m) => m.AiChatWidget),
  { ssr: false },
);

const DESKTOP_MQ = "(min-width: 1024px)";

export function AppShell({
  user,
  companyId,
  companyName,
  companyLogoUrl,
  children,
}: {
  user: AuthUser;
  companyId?: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
  children: React.ReactNode;
}) {
  // Always closed after login / first paint.
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      if (!desktop) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isDesktop) setOpen(false);
  }, [pathname, isDesktop]);

  useEffect(() => {
    if (isDesktop || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isDesktop]);

  useEffect(() => {
    if (!companyId || !can(user, "ai.write")) return;
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setShowAi(true);
    };

    const idle = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof idle === "function") {
      const id = idle(enable, { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const t = setTimeout(enable, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [companyId, user]);

  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);

  const sidebarProps = {
    user,
    companyId,
    companyName,
    companyLogoUrl,
    open,
    onToggle: toggle,
  } as const;

  return (
    <div className="relative min-h-screen">
      <FcmAutoRegister companyId={companyId} />

      {/* Mobile drawer: outside the flex row so it never squeezes page content */}
      {!isDesktop && open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-[var(--background)]/90 backdrop-blur-sm"
            onClick={close}
          />
          <div className="absolute inset-y-0 start-0 z-10 flex w-[min(18rem,88vw)] max-w-full">
            <Sidebar {...sidebarProps} isDesktop={false} forceExpanded />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-screen">
        {/* Desktop rail only — never mount in-flow sidebar on mobile */}
        {isDesktop ? (
          <Sidebar {...sidebarProps} isDesktop />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={user}
            companyId={companyId}
            companyName={companyName}
            companyLogoUrl={companyLogoUrl}
            onMenuClick={toggle}
            menuOpen={open}
            showMenuButton={!isDesktop}
          />
          <main className="flex-1 p-3 sm:p-5 md:p-7">{children}</main>
        </div>
      </div>

      {showAi && companyId ? <AiChatWidget companyId={companyId} /> : null}
    </div>
  );
}
