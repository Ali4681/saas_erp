"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";

export function AccessDenied({
  title,
  message,
}: {
  title?: string;
  message?: string;
}) {
  const t = useTranslations("common");
  return (
    <Card>
      <div className="space-y-2 py-6 text-center">
        <p className="text-lg font-semibold text-red-800">
          {title ?? t("accessDenied")}
        </p>
        <p className="text-sm text-[var(--color-muted)]">
          {message ?? t("accessDeniedMessage")}
        </p>
        <p className="font-mono text-xs text-[var(--color-muted)]">HTTP 403</p>
      </div>
    </Card>
  );
}

export function ErrorState({
  title,
  message,
}: {
  title?: string;
  message: string;
}) {
  const t = useTranslations("common");
  return (
    <Card>
      <div className="space-y-2 py-6 text-center">
        <p className="text-lg font-semibold text-red-800">
          {title ?? t("errorOccurred")}
        </p>
        <p className="text-sm text-[var(--color-muted)]">{message}</p>
      </div>
    </Card>
  );
}
