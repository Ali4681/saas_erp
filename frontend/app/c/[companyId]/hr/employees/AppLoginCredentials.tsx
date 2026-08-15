"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AppLoginCredentials({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const t = useTranslations("hr");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("loginEmail");
    params.delete("loginPassword");
    params.delete("ok");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Card className="border-[var(--primary)]/40 bg-[var(--secondary)]/40">
      <p className="font-semibold text-[var(--foreground)]">
        {t("appLoginCredentialsTitle")}
      </p>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        {t("appLoginCredentialsHint")}
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--muted-foreground)]">
            {t("appLoginEmail")}
          </dt>
          <dd className="mt-0.5 font-mono font-medium select-all">{email}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted-foreground)]">
            {t("appLoginPassword")}
          </dt>
          <dd className="mt-0.5 font-mono font-medium select-all">{password}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={dismiss}>
          {t("appLoginDismiss")}
        </Button>
      </div>
    </Card>
  );
}
