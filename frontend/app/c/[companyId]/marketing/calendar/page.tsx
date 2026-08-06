import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Post = {
  id: string;
  title: string | null;
  content: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
};

type Calendar = {
  from: string;
  to: string;
  byDay: Record<string, Post[]>;
  posts: Post[];
};

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("marketing");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();

  const [calendar, upcoming, published] = await Promise.all([
    apiServer<Calendar>(`/companies/${companyId}/marketing/calendar`, {
      companyId,
    }).catch(() => null),
    apiServer<Post[]>(
      `/companies/${companyId}/marketing/calendar/upcoming?limit=10`,
      { companyId },
    ).catch(() => []),
    apiServer<Post[]>(
      `/companies/${companyId}/marketing/calendar/published?limit=10`,
      { companyId },
    ).catch(() => []),
  ]);

  const days = calendar
    ? Object.entries(calendar.byDay).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("calendarTitle")}
        description={
          calendar ? `${calendar.from} → ${calendar.to}` : t("calendarFallbackDesc")
        }
        actions={
          <Button href={`/c/${companyId}/marketing`} variant="secondary">
            {t("title")}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("upcoming")}>
          {upcoming.length === 0 ? (
            <EmptyState message={t("noUpcoming")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {upcoming.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {p.title || p.content.slice(0, 40)}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {formatDate(p.scheduledAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("recentlyPublished")}>
          {published.length === 0 ? (
            <EmptyState message={t("noRecent")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {published.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {p.title || p.content.slice(0, 40)}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {formatDate(p.publishedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t("byDay")}>
        {days.length === 0 ? (
          <EmptyState message={t("noEvents")} />
        ) : (
          <div className="space-y-4">
            {days.map(([day, posts]) => (
              <div key={day}>
                <p className="mb-2 text-sm font-semibold">{day}</p>
                <ul className="space-y-2">
                  {posts.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm"
                    >
                      <span>
                        {p.channel}: {p.title || p.content.slice(0, 50)}
                      </span>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
