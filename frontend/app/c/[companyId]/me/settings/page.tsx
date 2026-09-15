import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default async function EmployeeSettingsPage() {
  const t = await getTranslations("employeePortal");

  return (
    <div className="space-y-5">
      <PageHeader title={t("settingsTitle")} description={t("settingsDesc")} />
      <Card className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">{t("settingsLanguage")}</p>
          <LanguageToggle />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">{t("settingsTheme")}</p>
          <ThemeToggle />
        </div>
      </Card>
    </div>
  );
}
