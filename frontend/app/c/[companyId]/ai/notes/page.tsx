import { getTranslations } from "next-intl/server";
import { AccessDenied } from "@/components/erp/AccessDenied";
import { AiToolForm } from "@/components/erp/AiToolForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { aiNotesAnalyze, aiNotesSearch } from "@/lib/erp/ai-actions";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

type Note = { id: string; title: string };

export default async function AiNotesPage({
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
        <PageHeader title={t("notesTitle")} />
        <AccessDenied />
      </div>
    );
  }

  const notes = await apiServer<Note[]>(
    `/companies/${companyId}/notebook/notes`,
    { companyId },
  ).catch(() => []);

  const analyze = aiNotesAnalyze.bind(null, companyId);
  const search = aiNotesSearch.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("notesTitle")}
        actions={
          <Button href={`/c/${companyId}/ai`} variant="secondary">
            {t("title")}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <CreateFormDialog
          title={t("analyzeNote")}
          triggerLabel={t("analyzeNote")}
          showPlus={false}
        >
          <AiToolForm action={analyze} submitLabel={t("analyze")}>
            <Select
              name="noteId"
              label={t("existingNote")}
              placeholder={t("orWriteBelow")}
              options={notes.map((n) => ({ value: n.id, label: n.title }))}
            />
            <div className="md:col-span-2">
              <Textarea name="text" label={t("orFreeText")} rows={4} />
            </div>
          </AiToolForm>
        </CreateFormDialog>

        <CreateFormDialog
          title={t("semanticSearch")}
          triggerLabel={t("semanticSearch")}
          triggerVariant="secondary"
          showPlus={false}
        >
          <AiToolForm action={search} submitLabel={t("search")}>
            <Input
              name="query"
              label={t("query")}
              required
              className="md:col-span-2"
            />
            <Input name="limit" label={t("limit")} defaultValue="20" />
          </AiToolForm>
        </CreateFormDialog>
      </div>
    </div>
  );
}
