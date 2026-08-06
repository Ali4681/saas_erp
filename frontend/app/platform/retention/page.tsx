import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { runRetentionPurge } from "../actions";

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const flash = await searchParams;
  const t = await getTranslations("platform");
  const session = await getSession();

  if (!can(session?.user, "retention.run")) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("retentionTitle")} />
        <AccessDenied message={t("retentionAccessDenied")} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("retentionHeading")}
        description={t("retentionDesc")}
        actions={
          <Button href="/platform" variant="secondary">
            {t("platformHome")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <CreateFormDialog
        title={t("runCleanup")}
        description={t("runCleanupDesc")}
        triggerLabel={t("runCleanup")}
        showPlus={false}
      >
        <form action={runRetentionPurge} className="grid gap-3">
          <Select
            name="dryRun"
            label={t("mode")}
            options={[
              { value: "true", label: t("dryRun") },
              { value: "false", label: t("liveRun") },
            ]}
          />
          <Button type="submit">{t("run")}</Button>
        </form>
      </CreateFormDialog>
    </div>
  );
}
