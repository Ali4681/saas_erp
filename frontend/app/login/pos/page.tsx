import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import PosLoginForm from "./pos-login-form";

export default async function PosLoginPage() {
  const t = await getTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-[var(--color-muted)]">
          {t("loading")}
        </div>
      }
    >
      <PosLoginForm />
    </Suspense>
  );
}
