"use client";

import type { SelectHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  showPlaceholderOption?: boolean;
};

export function Select({
  label,
  options,
  placeholder,
  showPlaceholderOption = true,
  className,
  id,
  ...rest
}: Props) {
  const t = useTranslations("common");
  const selectId = id ?? rest.name;
  const base = (label ?? "").trim();
  const resolvedPlaceholder =
    placeholder ??
    (base ? t("selectLabeled", { label: base }) : t("select"));
  const uniqueOptions = options.filter(
    (opt, index, arr) =>
      arr.findIndex((other) => other.value === opt.value) === index,
  );

  return (
    <label className="flex w-full flex-col gap-1.5 text-sm">
      {label ? (
        <span className="font-medium text-[var(--foreground)]">{label}</span>
      ) : null}
      <select
        id={selectId}
        className={cn(
          "h-10 cursor-pointer rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20 disabled:cursor-not-allowed disabled:opacity-50",
          "has-[option[value='']:checked]:text-[var(--muted-foreground)]",
          className,
        )}
        {...rest}
      >
        {showPlaceholderOption ? (
          <option value="">{resolvedPlaceholder}</option>
        ) : null}
        {uniqueOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
