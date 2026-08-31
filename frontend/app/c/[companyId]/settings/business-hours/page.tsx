import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { saveBusinessHours } from "../actions";

type Profile = {
  id: string;
  mode: string;
};

export default async function BusinessHoursPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("settings");
  const session = await getSession();
  const canWrite = can(session?.user, "companies.write");

  const profile = await apiServer<Profile>(
    `/companies/${companyId}/business-hours`,
    { companyId },
  ).catch(() => null);

  const mode = profile?.mode === "HOURS_24" ? "HOURS_24" : "HOURS_12";

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("businessHoursTitle")}
        description={t("businessHoursDesc")}
        actions={
          <Button href={`/c/${companyId}/settings`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {profile && canWrite ? (
        <Card className="p-4">
          <form
            action={saveBusinessHours.bind(null, companyId)}
            className="grid max-w-md gap-4"
          >
            <Select
              name="mode"
              label={t("bhMode")}
              required
              showPlaceholderOption={false}
              defaultValue={mode}
              options={[
                { value: "HOURS_24", label: t("bhMode24") },
                { value: "HOURS_12", label: t("bhMode12") },
              ]}
            />
            <div>
              <Button type="submit">{t("bhSave")}</Button>
            </div>
          </form>
        </Card>
      ) : !canWrite ? (
        <Card className="p-4">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("bhMode")}:{" "}
            <span className="font-medium text-[var(--foreground)]">
              {mode === "HOURS_24" ? t("bhMode24") : t("bhMode12")}
            </span>
          </p>
        </Card>
      ) : null}
    </div>
  );
}
