import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type DeviceEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  employeeId: string | null;
  externalRef: string | null;
  device?: { id: string; name: string; deviceType: string } | null;
};

export default async function TrackingEventsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("tracking");
  const { formatDate } = await getFormatters();

  const events = await apiServer<DeviceEvent[]>(
    `/companies/${companyId}/tracking/events`,
    { companyId },
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("eventsTitle")}
        description={t("eventsDesc")}
        actions={
          <Button href={`/c/${companyId}/tracking`} variant="secondary">
            {t("hubBack")}
          </Button>
        }
      />
      <Card>
        {events.length === 0 ? (
          <EmptyState message={t("emptyEvents")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("device")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("event")}</th>
                  <th className="px-2 py-2 font-medium">{t("employee")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">{e.device?.name ?? "—"}</td>
                    <td className="px-2 py-2">
                      {e.device?.deviceType ?? "—"}
                    </td>
                    <td className="px-2 py-2">{e.eventType}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {e.employeeId ?? e.externalRef ?? "—"}
                    </td>
                    <td className="px-2 py-2">{formatDate(e.occurredAt)}</td>
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
