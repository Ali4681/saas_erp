"use client";

import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/types/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AiChatWidget } from "@/components/erp/AiChatWidget";
import { FcmAutoRegister } from "@/components/erp/FcmAutoRegister";
import { can } from "@/lib/permissions";

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
        <main className="animate-fade-up flex-1 p-5 md:p-7">{children}</main>
      </div>
      {companyId && can(user, "ai.write") ? (
        <AiChatWidget companyId={companyId} />
      ) : null}
    </div>
  );
}
