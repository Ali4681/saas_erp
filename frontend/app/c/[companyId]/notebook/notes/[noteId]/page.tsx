import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { addNoteComment, updateNote } from "../../actions";

type Category = { id: string; name: string };
type Note = {
  id: string;
  title: string;
  body: string;
  status: string;
  priority: string;
  categoryId: string | null;
  category?: { name: string } | null;
};
type Revision = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};
type Comment = { id: string; body: string; createdAt?: string };

export default async function NoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; noteId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId, noteId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("notebook");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "notebook.write");

  const [notes, categories, revisions] = await Promise.all([
    apiServer<Note[]>(`/companies/${companyId}/notebook/notes`, {
      companyId,
    }).catch(() => []),
    apiServer<Category[]>(`/companies/${companyId}/notebook/categories`, {
      companyId,
    }).catch(() => []),
    apiServer<Revision[]>(
      `/companies/${companyId}/notebook/notes/${noteId}/revisions`,
      { companyId },
    ).catch(() => []),
  ]);

  const note = notes.find((n) => n.id === noteId);
  if (!note) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("note")} />
        <Card>
          <EmptyState message={t("noteNotFound")} />
        </Card>
      </div>
    );
  }

  const comments: Comment[] =
    ((note as Note & { comments?: Comment[] }).comments as Comment[] | undefined) ??
    [];

  const save = updateNote.bind(null, companyId, noteId);
  const comment = addNoteComment.bind(null, companyId, noteId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={note.title}
        actions={
          <>
            <StatusBadge status={note.status} />
            <Button
              href={`/c/${companyId}/notebook/notes`}
              variant="secondary"
            >
              {t("allNotes")}
            </Button>
            {canWrite ? (
              <CreateFormDialog
                title={t("editNote")}
                triggerLabel={t("edit")}
                triggerVariant="secondary"
                showPlus={false}
              >
                <form action={save} className="grid gap-3 md:grid-cols-2">
                  <Input
                    name="title"
                    label={t("titleLabel")}
                    defaultValue={note.title}
                  />
                  <Select
                    name="categoryId"
                    label={t("category")}
                    placeholder="—"
                    defaultValue={note.categoryId ?? ""}
                    options={categories.map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                  />
                  <Select
                    name="priority"
                    label={t("priority")}
                    defaultValue={note.priority}
                    options={[
                      { value: "LOW", label: t("priorityLow") },
                      { value: "MEDIUM", label: t("priorityMedium") },
                      { value: "HIGH", label: t("priorityHigh") },
                    ]}
                  />
                  <Select
                    name="status"
                    label={t("status")}
                    defaultValue={note.status}
                    options={[
                      { value: "OPEN", label: t("statusOpen") },
                      { value: "IN_PROGRESS", label: t("statusInProgress") },
                      { value: "UNDER_REVIEW", label: t("statusUnderReview") },
                      { value: "COMPLETED", label: t("statusCompleted") },
                      { value: "DEFERRED", label: t("statusDeferred") },
                    ]}
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      name="body"
                      label={t("body")}
                      defaultValue={note.body}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">{t("saveWithRevision")}</Button>
                  </div>
                </form>
              </CreateFormDialog>
            ) : null}
          </>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card title={t("content")}>
        <p className="whitespace-pre-wrap text-sm">{note.body}</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("commentsTitle")}>
          {canWrite ? (
            <div className="mb-3">
              <CreateFormDialog
                title={t("newComment")}
                triggerLabel={t("comment")}
                triggerVariant="secondary"
                showPlus={false}
              >
                <form action={comment} className="grid gap-3">
                  <Textarea
                    name="body"
                    label={t("commentLabel")}
                    required
                    rows={3}
                  />
                  <Button type="submit">{t("add")}</Button>
                </form>
              </CreateFormDialog>
            </div>
          ) : null}
          {comments.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              {t("noCommentsYet")}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded border border-[var(--color-border)] p-2"
                >
                  {c.body}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t("revisions")}>
          {revisions.length === 0 ? (
            <EmptyState message={t("emptyRevisions")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {revisions.map((r) => (
                <li
                  key={r.id}
                  className="flex justify-between gap-2 border-b border-[var(--color-border)] pb-2 last:border-0"
                >
                  <span>
                    {r.title} · <StatusBadge status={r.status} />
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {formatDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
