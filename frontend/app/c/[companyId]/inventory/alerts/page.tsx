import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Alerts = {
  lowStock: Array<{ name: string; onHand: number; minStock: number; suggestedQty: number }>;
  slowMoving: Array<{ name: string; onHand: number; frozenValue: number }>;
  expiring: Array<{ batchNumber: string; expiresOn: string; item?: { name: string } | null }>;
  topMovers: Array<{ itemId: string; _sum: { quantity: string | null } }>;
};

export default async function InventoryAlertsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("inventory");
  const { formatMoney } = await getFormatters();
  const alerts = await apiServer<Alerts>(`/companies/${companyId}/inventory/alerts`, {
    companyId,
  }).catch(() => ({
    lowStock: [],
    slowMoving: [],
    expiring: [],
    topMovers: [],
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("alertsTitle")}
        description={t("alertsDesc")}
        actions={<Button href={`/c/${companyId}/inventory`} variant="secondary">{t("back")}</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="font-semibold">{t("alertLowStock")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.lowStock.slice(0, 15).map((r) => (
              <li key={r.name}>
                {r.name}: {r.onHand} / min {r.minStock} → PO {r.suggestedQty}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="font-semibold">{t("alertSlow")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.slowMoving.slice(0, 15).map((r) => (
              <li key={r.name}>
                {r.name}: {r.onHand} · {formatMoney(String(r.frozenValue), "SAR")}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="font-semibold">{t("alertExpiry")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.expiring.slice(0, 15).map((r) => (
              <li key={`${r.batchNumber}-${r.expiresOn}`}>
                {r.item?.name} · {r.batchNumber} · {String(r.expiresOn).slice(0, 10)}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="font-semibold">{t("alertTop")}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {alerts.topMovers.slice(0, 15).map((r) => (
              <li key={r.itemId}>
                {r.itemId.slice(0, 8)}… · {r._sum.quantity}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
