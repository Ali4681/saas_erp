import { ChartColumnIncreasing, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { AiToolForm } from "@/components/erp/AiToolForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { aiReportsAnalyze } from "@/lib/erp/ai-actions";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export default async function AiReportsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("ai");
  const session = await getSession();
  if (!can(session?.user, "ai.write")) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("reportsTitle")} />
        <AccessDenied />
      </div>
    );
  }

  const analyze = aiReportsAnalyze.bind(null, companyId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reportsHeading")}
        description={t("reportsDesc")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            {t("execSummary")}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {t("execSummaryHint")}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ChartColumnIncreasing className="h-4 w-4 text-[var(--primary)]" />
            {t("weakPoints")}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {t("weakPointsHint")}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            {t("readyRecs")}
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {t("readyRecsHint")}
          </p>
        </Card>
      </div>

      <CreateFormDialog
        title={t("setupAnalysis")}
        description={t("setupAnalysisDesc")}
        triggerLabel={t("analyzeReport")}
        showPlus={false}
      >
        <AiToolForm
          action={analyze}
          submitLabel={t("analyzeReport")}
          resultVariant="report"
        >
          <Select
            name="scope"
            label={t("scope")}
            required
            defaultValue="executive"
            options={[
              { value: "executive", label: t("scopeExecutive") },
              { value: "sales", label: t("scopeSales") },
              { value: "inventory", label: t("scopeInventory") },
              { value: "hr", label: t("scopeHr") },
            ]}
          />
          <Input name="from" label={t("from")} type="date" />
          <Input name="to" label={t("to")} type="date" />
        </AiToolForm>
      </CreateFormDialog>
    </div>
  );
}
