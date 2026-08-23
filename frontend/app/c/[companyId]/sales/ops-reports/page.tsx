import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Track = {
  b2c: { total: string; count: number };
  b2b: { total: string; count: number };
};
type TicketCost = {
  totalCost: string;
  tickets: Array<{
    ticketNumber: string;
    ticketKind: string;
    status: string;
    totalCost: number;
  }>;
};
type Deferred = {
  totalDeferred: string;
  contracts: Array<{ title: string; deferredRevenue: string; remainingDays: number }>;
};

export default async function OpsReportsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("sales");
  const { formatMoney } = await getFormatters();
  const [track, tickets, deferred] = await Promise.all([
    apiServer<Track>(`/companies/${companyId}/sales/reports/track-revenue`, { companyId }).catch(
      () => ({ b2c: { total: "0", count: 0 }, b2b: { total: "0", count: 0 } }),
    ),
    apiServer<TicketCost>(`/companies/${companyId}/sales/reports/ticket-cost`, { companyId }).catch(
      () => ({ totalCost: "0", tickets: [] }),
    ),
    apiServer<Deferred>(`/companies/${companyId}/sales/reports/deferred-revenue`, {
      companyId,
    }).catch(() => ({ totalDeferred: "0", contracts: [] })),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("opsReports.title")}
        description={t("opsReports.description")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="font-semibold">{t("opsReports.retail")}</p>
          <p className="text-sm text-[var(--color-muted)]">{track.b2c.count}</p>
          <p className="mt-2 text-lg">{formatMoney(track.b2c.total, "SAR")}</p>
        </Card>
        <Card>
          <p className="font-semibold">{t("opsReports.corporate")}</p>
          <p className="text-sm text-[var(--color-muted)]">{track.b2b.count}</p>
          <p className="mt-2 text-lg">{formatMoney(track.b2b.total, "SAR")}</p>
        </Card>
        <Card>
          <p className="font-semibold">{t("opsReports.ticketCost")}</p>
          <p className="mt-2 text-lg">{formatMoney(tickets.totalCost, "SAR")}</p>
        </Card>
        <Card>
          <p className="font-semibold">{t("opsReports.deferred")}</p>
          <p className="mt-2 text-lg">{formatMoney(deferred.totalDeferred, "SAR")}</p>
        </Card>
      </div>
    </div>
  );
}
