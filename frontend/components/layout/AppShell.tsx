"use client";

import { useEffect, useState } from "react";
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

const STORAGE_KEY = "saas-erp-sidebar-open";

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
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "0") setOpen(false);
    if (saved === "1") setOpen(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open, hydrated]);

  // Defer AI widget until after first paint so navigation stays responsive.
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

  return (
    <div className="flex min-h-screen">
      <FcmAutoRegister companyId={companyId} />
      <Sidebar
        user={user}
        companyId={companyId}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        open={open}
        onToggle={toggle}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          companyId={companyId}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
        />
        <main className="flex-1 p-5 md:p-7">{children}</main>
      </div>
      {showAi && companyId ? <AiChatWidget companyId={companyId} /> : null}
    </div>
  );
}
