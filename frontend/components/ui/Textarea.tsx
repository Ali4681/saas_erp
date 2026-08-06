"use client";

import type { TextareaHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function Textarea({
  label,
  className,
  id,
  placeholder,
  ...rest
}: Props) {
  const t = useTranslations("common");
  const areaId = id ?? rest.name;
  const base = (label ?? "").trim();
  const resolvedPlaceholder =
    placeholder ??
    (base ? t("writeLabeled", { label: base }) : t("writeHere"));

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-[var(--foreground)]">{label}</span>
      ) : null}
      <textarea
        id={areaId}
        placeholder={resolvedPlaceholder}
        className={cn(
          "min-h-24 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] shadow-sm outline-none transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20",
          className,
        )}
        {...rest}
      />
    </label>
  );
}
