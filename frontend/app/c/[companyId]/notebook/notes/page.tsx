import { getTranslations } from "next-intl/server";
import Link from "next/link";
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
import { createNote } from "../actions";

type Category = { id: string; name: string };
type Note = {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  category?: { name: string } | null;
  _count?: { comments: number; revisions: number };
};

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("notebook");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "notebook.write");
  const q = flash.q ? `?q=${encodeURIComponent(flash.q)}` : "";

  const [notes, categories] = await Promise.all([
    apiServer<Note[]>(`/companies/${companyId}/notebook/notes${q}`, {
      companyId,
    }).catch(() => []),
    apiServer<Category[]>(`/companies/${companyId}/notebook/categories`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createNote.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("notesTitle")}
        actions={
          <Button href={`/c/${companyId}/notebook`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card>
        <form method="get" className="flex flex-wrap gap-2">
          <Input
            name="q"
            placeholder={t("searchPlaceholder")}
            defaultValue={flash.q ?? ""}
            className="min-w-[200px] flex-1"
          />
          <Button type="submit" variant="secondary">
            {t("search")}
          </Button>
        </form>
      </Card>

      {canWrite ? (
        <CreateFormDialog title={t("newNote")} triggerLabel={t("addNote")}>
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="title" label={t("titleLabel")} required />
            <Select
              name="categoryId"
              label={t("category")}
              placeholder={t("optional")}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              name="priority"
              label={t("priority")}
              options={[
                { value: "LOW", label: t("priorityLow") },
                { value: "MEDIUM", label: t("priorityMedium") },
                { value: "HIGH", label: t("priorityHigh") },
              ]}
            />
            <Select
              name="status"
              label={t("status")}
              options={[
                { value: "OPEN", label: t("statusOpen") },
                { value: "IN_PROGRESS", label: t("statusInProgress") },
                { value: "UNDER_REVIEW", label: t("statusUnderReview") },
              ]}
            />
            <div className="md:col-span-2">
              <Textarea name="body" label={t("body")} required />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {notes.length === 0 ? (
          <EmptyState message={t("emptyNotes")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("titleLabel")}</th>
                  <th className="px-2 py-2 font-medium">{t("category")}</th>
                  <th className="px-2 py-2 font-medium">{t("priority")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("comments")}</th>
                  <th className="px-2 py-2 font-medium">{t("created")}</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <Link
                        href={`/c/${companyId}/notebook/notes/${n.id}`}
                        className="font-medium text-[var(--color-accent)] underline"
                      >
                        {n.title}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{n.category?.name ?? "—"}</td>
                    <td className="px-2 py-2">{n.priority}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={n.status} />
                    </td>
                    <td className="px-2 py-2">
                      {n._count?.comments ?? 0} / {n._count?.revisions ?? 0}
                    </td>
                    <td className="px-2 py-2">{formatDate(n.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
