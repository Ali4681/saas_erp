"use client";

import type { InputHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({
  label,
  error,
  className,
  id,
  placeholder,
  type = "text",
  ...rest
}: Props) {
  const t = useTranslations("common");
  const inputId = id ?? rest.name;
  const resolvedPlaceholder =
    placeholder ??
    defaultInputPlaceholder(t, label, type, typeof rest.name === "string" ? rest.name : undefined);

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-[var(--foreground)]">{label}</span>
      ) : null}
      <input
        id={inputId}
        type={type}
        placeholder={resolvedPlaceholder}
        className={cn(
          "h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20",
          error && "border-[var(--destructive)] focus:ring-[var(--destructive)]/20",
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-[var(--destructive)]">{error}</span>
      ) : null}
    </label>
  );
}

function defaultInputPlaceholder(
  t: ReturnType<typeof useTranslations>,
  label?: string,
  type?: string,
  name?: string,
): string | undefined {
  const kind = (type ?? "text").toLowerCase();
  if (
    kind === "hidden" ||
    kind === "file" ||
    kind === "checkbox" ||
    kind === "radio" ||
    kind === "date" ||
    kind === "datetime-local" ||
    kind === "time" ||
    kind === "month" ||
    kind === "week" ||
    kind === "color" ||
    kind === "range"
  ) {
    return undefined;
  }

  if (kind === "email") return "name@example.com";
  if (kind === "password") return "••••••••";
  if (kind === "tel") return "05xxxxxxxx";
  if (kind === "url") return "https://";
  if (kind === "number") return "0";
  if (kind === "search") {
    return label ? t("searchLabeled", { label }) : t("searchEllipsis");
  }

  const base = (label ?? name ?? "").trim();
  if (!base) return t("enterValue");
  return t("enterLabeled", { label: base });
}
