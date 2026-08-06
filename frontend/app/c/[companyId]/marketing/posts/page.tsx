import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
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
import {
  archivePost,
  createPost,
  publishPost,
  schedulePost,
} from "../actions";

type Post = {
  id: string;
  title: string | null;
  content: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
};

export default async function PostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("marketing");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "marketing.write");

  const posts = await apiServer<Post[]>(
    `/companies/${companyId}/marketing/posts`,
    { companyId },
  ).catch(() => []);

  const create = createPost.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("postsTitle")}
        actions={
          <>
            {canWrite ? (
              <CreateFormDialog
                title={t("newPost")}
                triggerLabel={t("addPost")}
              >
                <form action={create} className="grid gap-3 md:grid-cols-2">
                  <Input name="title" label={t("titleField")} />
                  <Select
                    name="channel"
                    label={t("channel")}
                    required
                    options={[
                      { value: "INTERNAL_DRAFT", label: t("internalDraft") },
                      { value: "FACEBOOK", label: "Facebook" },
                      { value: "INSTAGRAM", label: "Instagram" },
                      { value: "X", label: "X" },
                      { value: "LINKEDIN", label: "LinkedIn" },
                      { value: "OTHER", label: t("other") },
                    ]}
                  />
                  <Select
                    name="status"
                    label={t("status")}
                    options={[
                      { value: "DRAFT", label: t("draft") },
                      { value: "READY", label: t("ready") },
                    ]}
                  />
                  <Input
                    name="scheduledAt"
                    label={t("scheduleOptional")}
                    type="datetime-local"
                  />
                  <div className="md:col-span-2">
                    <Textarea name="content" label={t("content")} required />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit">{t("create")}</Button>
                  </div>
                </form>
              </CreateFormDialog>
            ) : null}
            <Button href={`/c/${companyId}/marketing`} variant="secondary">
              {t("title")}
            </Button>
          </>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card>
        {posts.length === 0 ? (
          <EmptyState message={t("noPosts")} />
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="rounded-md border border-[var(--color-border)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {post.title || post.content.slice(0, 60)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)] line-clamp-2">
                      {post.content}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {post.channel}
                      {post.scheduledAt
                        ? t("scheduledAt", { date: formatDate(post.scheduledAt) })
                        : ""}
                      {post.publishedAt
                        ? t("publishedAt", { date: formatDate(post.publishedAt) })
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </div>
                {canWrite ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {["DRAFT", "READY", "FAILED"].includes(post.status) ? (
                      <>
                        <CreateFormDialog
                          title={t("schedulePost")}
                          description={post.title || post.content.slice(0, 80)}
                          triggerLabel={t("schedule")}
                          triggerVariant="secondary"
                        >
                          <form
                            action={schedulePost.bind(null, companyId, post.id)}
                            className="grid gap-3"
                          >
                            <Input
                              name="scheduledAt"
                              label={t("publishAt")}
                              type="datetime-local"
                              required
                            />
                            <Button type="submit">{t("confirmSchedule")}</Button>
                          </form>
                        </CreateFormDialog>
                        <ActionForm
                          label={t("publishNow")}
                          variant="primary"
                          action={publishPost.bind(null, companyId, post.id)}
                        />
                      </>
                    ) : null}
                    {post.status === "SCHEDULED" ? (
                      <ActionForm
                        label={t("publishNow")}
                        variant="primary"
                        action={publishPost.bind(null, companyId, post.id)}
                      />
                    ) : null}
                    {post.status !== "ARCHIVED" ? (
                      <ActionForm
                        label={t("archive")}
                        variant="ghost"
                        action={archivePost.bind(null, companyId, post.id)}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
