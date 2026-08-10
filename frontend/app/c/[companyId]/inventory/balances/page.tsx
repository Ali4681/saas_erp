import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";

type Balance = {
  quantityOnHand: string;
  item?: { name: string; sku: string | null; minStock: string } | null;
  warehouse?: { code: string; name: string } | null;
};

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("inventory");
  const balances = await apiServer<Balance[]>(
    `/companies/${companyId}/inventory/balances`,
    { companyId },
  ).catch(() => []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("balancesTitle")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <Card>
        {balances.length === 0 ? (
          <EmptyState message={t("emptyBalances")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("item")}</th>
                  <th className="px-2 py-2 font-medium">{t("warehouse")}</th>
                  <th className="px-2 py-2 font-medium">{t("available")}</th>
                  <th className="px-2 py-2 font-medium">{t("minStock")}</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b, i) => (
                  <tr
                    key={`${b.item?.sku ?? i}-${b.warehouse?.code ?? i}`}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <p className="font-medium">{b.item?.name ?? "—"}</p>
                      <p className="font-mono text-xs text-[var(--color-muted)]">
                        {b.item?.sku ?? ""}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      {b.warehouse
                        ? `${b.warehouse.code} — ${b.warehouse.name}`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 font-medium">{b.quantityOnHand}</td>
                    <td className="px-2 py-2">{b.item?.minStock ?? "—"}</td>
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
