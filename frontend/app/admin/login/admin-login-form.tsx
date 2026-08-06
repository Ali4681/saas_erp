"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Shield } from "lucide-react";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/lib/toast";
import type { AuthUser } from "@/lib/types/auth";
import { isAppLocale } from "@/i18n/config";
import { applyThemeClass, isAppTheme } from "@/lib/theme";

export default function AdminLoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { user?: AuthUser; message?: string };
      if (!res.ok || !data.user) {
        toast.error(data.message ?? t("loginFailed"));
        return;
      }
      toast.success(t("adminSuccess"));
      if (isAppLocale(data.user.locale)) {
        await fetch("/api/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: data.user.locale }),
        });
      }
      if (isAppTheme(data.user.theme)) {
        applyThemeClass(data.user.theme);
      }
      const next = search.get("next");
      const dest =
        next && next.startsWith("/platform") ? next : "/platform";
      router.replace(dest);
      router.refresh();
    } catch {
      toast.error(t("serverError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_80%_0%,rgba(46,84,182,0.28),transparent_55%),radial-gradient(700px_400px_at_10%_100%,rgba(61,122,214,0.18),transparent_50%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(28,53,66,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(28,53,66,0.9) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[18%] select-none text-center text-[clamp(4rem,18vw,12rem)] font-semibold leading-none tracking-tight text-white/[0.04]"
      >
        PLATFORM
      </p>

      <header className="relative z-10 flex items-center justify-between border-b border-[var(--sidebar-border)] px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="SaaS ERP"
            className="h-9 w-9 rounded-lg bg-white object-contain p-0.5"
          />
          <div>
            <p className="text-sm font-semibold">SaaS ERP</p>
            <p className="text-[11px] text-[var(--sidebar-muted)]">
              {t("platformConsole")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageToggle />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--sidebar-muted)] transition hover:text-white"
          >
            {t("companyLoginLink")}
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px] animate-fade-up">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--sidebar-active-soft)] ring-1 ring-[var(--sidebar-active)]/40">
              <Shield className="h-5 w-5 text-[var(--sidebar-active)]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {t("adminTitle")}
              </h1>
              <p className="mt-0.5 text-sm text-[var(--sidebar-muted)]">
                {t("adminSubtitle")}
              </p>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/80 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
          >
            <div className="flex flex-col gap-3 [&_label]:text-[var(--sidebar-muted)] [&_input]:border-[var(--sidebar-border)] [&_input]:bg-[var(--sidebar)] [&_input]:text-white [&_input]:placeholder:text-[var(--sidebar-muted)]/70 [&_input]:focus-visible:ring-[var(--sidebar-active)]">
              <Input
                label={t("email")}
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@…"
              />
              <Input
                label={t("password")}
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-[var(--sidebar-active)] text-white hover:brightness-110"
              >
                {loading ? t("adminSubmitting") : t("adminSubmit")}
              </Button>
            </div>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--sidebar-muted)]">
            {t("adminFooter")}
          </p>
        </div>
      </main>

      <div className="relative z-10 h-1 w-full bg-[linear-gradient(90deg,transparent,var(--sidebar-active),transparent)]" />
    </div>
  );
}
