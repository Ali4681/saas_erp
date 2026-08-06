"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/i18n/config";
import {
  applyLocaleDocument,
  writeLocaleCookie,
} from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(locale);

  useEffect(() => {
    setActive(locale);
  }, [locale]);

  function setLocale(next: AppLocale) {
    if (next === active || pending) return;
    setActive(next);
    writeLocaleCookie(next);
    applyLocaleDocument(next);
    startTransition(() => {
      void fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--card)]/70 p-0.5 text-xs font-semibold shadow-sm",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => setLocale("ar")}
        className={cn(
          "rounded-lg px-2.5 py-1.5 transition",
          active === "ar"
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        )}
        aria-pressed={active === "ar"}
      >
        AR
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-lg px-2.5 py-1.5 transition",
          active === "en"
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        )}
        aria-pressed={active === "en"}
      >
        EN
      </button>
    </div>
  );
}
