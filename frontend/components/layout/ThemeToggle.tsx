"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import {
  defaultTheme,
  persistTheme,
  readThemeFromDocument,
  type AppTheme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [theme, setTheme] = useState<AppTheme>(defaultTheme);

  useEffect(() => {
    setTheme(readThemeFromDocument());
  }, []);

  function setNext(next: AppTheme) {
    if (next === theme || pending) return;
    setTheme(next);
    startTransition(async () => {
      await persistTheme(next);
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
      aria-label={t("theme")}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => setNext("light")}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition",
          theme === "light"
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        )}
        aria-pressed={theme === "light"}
        title={t("themeLight")}
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("themeLight")}</span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setNext("dark")}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition",
          theme === "dark"
            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
        )}
        aria-pressed={theme === "dark"}
        title={t("themeDark")}
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("themeDark")}</span>
      </button>
    </div>
  );
}
