import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./actions";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("notifications");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();

  const [items, unread] = await Promise.all([
    apiServer<Notification[]>(`/companies/${companyId}/notifications`, {
      companyId,
    }).catch(() => []),
    apiServer<{ count: number }>(
      `/companies/${companyId}/notifications/unread-count`,
      { companyId },
    ).catch(() => ({ count: 0 })),
  ]);

  const markAll = markAllNotificationsRead.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description", { count: unread.count })}
        actions={
          unread.count > 0 ? (
            <ActionForm label={t("markAllRead")} action={markAll} />
          ) : null
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card>
        {items.length === 0 ? (
          <EmptyState message={t("empty")} />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-start justify-between gap-3 px-1 py-3 ${
                  item.readAt ? "opacity-70" : ""
                }`}
              >
                <div>
                  <p className="font-medium">
                    {!item.readAt ? (
                      <span className="me-2 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                    ) : null}
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {item.body}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">
                    {item.type}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <time className="text-xs text-[var(--color-muted)]">
                    {formatDate(item.createdAt)}
                  </time>
                  {!item.readAt ? (
                    <ActionForm
                      label={t("markRead")}
                      action={markNotificationRead.bind(
                        null,
                        companyId,
                        item.id,
                      )}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
