"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  PHONE_DIAL_CODES,
  splitStoredPhone,
  validateLocalPhone,
} from "@/lib/phone";
import { cn } from "@/lib/utils";

export function PhoneWithDialCodeField({
  name = "phone",
  dialCodeName = "phoneDialCode",
  label,
  hint,
  defaultValue = "",
  required = false,
  className,
}: {
  name?: string;
  dialCodeName?: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const initial = useMemo(() => splitStoredPhone(defaultValue), [defaultValue]);
  const [dialCode, setDialCode] = useState(initial.dialCode);
  const [local, setLocal] = useState(initial.local);

  const validationKey = validateLocalPhone(dialCode, local);
  const validationMsg =
    validationKey === "invalidLength"
      ? t("phoneInvalidLength")
      : validationKey === "invalidFormat"
        ? t("phoneInvalidFormat")
        : null;

  return (
    <div className={cn("flex w-full flex-col gap-1.5 text-sm", className)}>
      <span className="font-medium text-[var(--foreground)]">{label}</span>
      <div className="flex gap-2" dir="ltr">
        <select
          name={dialCodeName}
          value={dialCode}
          onChange={(e) => setDialCode(e.target.value)}
          suppressHydrationWarning
          className="h-10 min-w-[9.5rem] cursor-pointer rounded-lg border border-[var(--input)] bg-[var(--card)] px-2 text-sm text-[var(--foreground)] shadow-sm outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20"
        >
          {PHONE_DIAL_CODES.map((row) => (
            <option key={row.code} value={row.code}>
              {locale === "ar" ? row.labelAr : row.labelEn}
            </option>
          ))}
        </select>
        <input
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/\D/g, ""))}
          required={required}
          placeholder="5xxxxxxxx"
          suppressHydrationWarning
          className={cn(
            "h-10 min-w-0 flex-1 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-[var(--foreground)] shadow-sm outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20",
            validationMsg && local && "border-[var(--destructive)]",
          )}
        />
      </div>
      {hint ? (
        <span className="text-xs text-[var(--muted-foreground)]">{hint}</span>
      ) : (
        <span className="text-xs text-[var(--muted-foreground)]">
          {t("phoneHint")}
        </span>
      )}
      {validationMsg && local ? (
        <span className="text-xs text-[var(--destructive)]">{validationMsg}</span>
      ) : null}
    </div>
  );
}
