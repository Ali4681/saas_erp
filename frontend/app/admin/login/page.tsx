import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import AdminLoginForm from "./admin-login-form";

export default async function AdminLoginPage() {
  const t = await getTranslations("common");
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--sidebar)] text-sm text-[var(--sidebar-muted)]">
          {t("loading")}
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
