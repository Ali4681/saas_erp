"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, ShoppingCart } from "lucide-react";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BFF_AUTH } from "@/lib/auth/bff-paths";
import { posHomePathFor } from "@/lib/permissions";
import { registerFcmDevice } from "@/lib/fcm/client";
import { toast } from "@/lib/toast";
import type { AuthUser } from "@/lib/types/auth";
import { isAppLocale } from "@/i18n/config";
import { applyThemeClass, isAppTheme } from "@/lib/theme";

export default function PosLoginForm() {
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
      const res = await fetch(BFF_AUTH.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          intent: "pos",
          ...(companySlug.trim()
            ? { companySlug: companySlug.trim().toLowerCase() }
            : {}),
        }),
      });
      const data = (await res.json()) as {
        user?: AuthUser;
        message?: string;
        landingPath?: string;
      };
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
        void fetch("/api/locale", {
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
        next && next.includes("/me/pos")
          ? next
          : data.landingPath || posHomePathFor(data.user);
      window.location.assign(dest);
    } catch {
      toast.error(t("serverError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute start-4 top-4 z-10 flex items-center gap-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_-10%,rgba(16,185,129,0.16),transparent_55%),radial-gradient(700px_420px_at_100%_100%,rgba(46,84,182,0.12),transparent_50%)]" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-fade-up hidden flex-col justify-center gap-5 rounded-2xl border border-white/40 bg-[linear-gradient(145deg,#052e1f_0%,#0f3d2e_55%,#1d6b4f_140%)] p-8 text-white shadow-2xl lg:flex">
          <Badge className="w-fit border-white/20 bg-white/10 text-white">
            {t("posBadge")}
          </Badge>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-emerald-700">
                <ShoppingCart className="h-6 w-6" />
              </span>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t("posHeroTitle")}
              </h1>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/75">
              {t("posHero")}
            </p>
          </div>
        </div>

        <Card className="animate-fade-up relative w-full self-center p-6 shadow-[0_20px_50px_rgba(15,23,32,0.12)]">
          <div className="mb-5 space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("posTitle")}
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("posSubtitle")}
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
              {loading ? t("posSubmitting") : t("posSubmit")}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">
            {t("companyLoginLinkPrompt")}{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--primary)] hover:underline"
            >
              {t("companyLoginLink")}
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
