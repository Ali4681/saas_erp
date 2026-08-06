"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { homePathFor } from "@/lib/permissions";
import { registerFcmDevice } from "@/lib/fcm/client";
import { toast } from "@/lib/toast";
import type { AuthUser } from "@/lib/types/auth";
import { isAppLocale } from "@/i18n/config";
import { applyThemeClass, isAppTheme } from "@/lib/theme";

export default function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(companySlug.trim()
            ? { companySlug: companySlug.trim().toLowerCase() }
            : {}),
        }),
      });
      const data = (await res.json()) as { user?: AuthUser; message?: string };
      if (!res.ok || !data.user) {
        toast.error(data.message ?? t("loginFailed"));
        return;
      }
      if (data.user.isPlatformAdmin) {
        toast.error(t("useAdminLogin"));
        router.replace("/admin/login");
        return;
      }
      toast.success(t("loginSuccess"));
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
      void registerFcmDevice(data.user.companyId).catch(() => undefined);
      const next = search.get("next");
      const dest =
        next && next.startsWith("/c/") ? next : homePathFor(data.user);
      router.replace(dest);
      router.refresh();
    } catch {
      toast.error(t("serverError"));
    } finally {
      setLoading(false);
    }
  }

  const features = [
    t("featureWorkspace"),
    t("featureIsolation"),
    t("featureRoles"),
    t("featureChannels"),
  ] as const;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute start-4 top-4 z-10 flex items-center gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_85%_-10%,rgba(46,84,182,0.18),transparent_55%),radial-gradient(700px_420px_at_0%_100%,rgba(61,122,214,0.14),transparent_50%)]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-fade-up hidden flex-col justify-center gap-5 rounded-2xl border border-white/40 bg-[linear-gradient(145deg,#0a1020_0%,#152040_55%,#2e54b6_140%)] p-8 text-white shadow-2xl lg:flex">
          <Badge className="w-fit border-white/20 bg-white/10 text-white">
            {t("companyBadge")}
          </Badge>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.svg"
                alt="SaaS ERP"
                className="h-12 w-12 rounded-2xl bg-white/95 object-contain p-1"
              />
              <h1 className="text-3xl font-semibold tracking-tight">SaaS ERP</h1>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/75">
              {t("companyHero")}
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {features.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/85"
              >
                <Building2 className="mb-2 h-4 w-4 text-sky-200" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className="animate-fade-up relative w-full self-center p-6 shadow-[0_20px_50px_rgba(15,23,32,0.12)]">
          <div className="mb-5 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("companyTitle")}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("companySubtitle")}
            </p>
          </div>

          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <Input
              label={t("email")}
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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

            <p className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("companySlugHint")}
            </p>
            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? t("companySubmitting") : t("companySubmit")}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">
            {t("platformAdminLinkPrompt")}{" "}
            <Link
              href="/admin/login"
              className="font-medium text-[var(--primary)] hover:underline"
            >
              {t("platformAdminLink")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
