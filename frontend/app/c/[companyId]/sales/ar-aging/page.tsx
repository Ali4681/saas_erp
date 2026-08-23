import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Aging = {
  buckets: {
    current: string;
    d30: string;
    d60: string;
    d90: string;
    older: string;
    total: string;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    dueOn: string | null;
    balanceDue: string;
    currency: string;
    daysPastDue: number;
    blocked: boolean;
    contact: { id: string; name: string; creditLimit: string };
  }>;
};

export default async function ArAgingPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("sales");
  const { formatMoney } = await getFormatters();
  const report = await apiServer<Aging>(
    `/companies/${companyId}/sales/reports/ar-aging`,
    { companyId },
  ).catch(() => null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("arAging.title")}
        description={t("arAging.description")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      {report ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["current", report.buckets.current],
              ["d30", report.buckets.d30],
              ["d60", report.buckets.d60],
              ["d90", report.buckets.d90],
              ["older", report.buckets.older],
              ["total", report.buckets.total],
            ] as const
          ).map(([key, value]) => (
            <Card key={key} title={t(`arAging.${key}`)}>
              <p className="text-lg font-semibold">{formatMoney(value, "SAR")}</p>
            </Card>
          ))}
        </div>
      ) : null}
      <Card>
        {!report || report.invoices.length === 0 ? (
          <EmptyState message={t("arAging.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 text-start">{t("number")}</th>
                  <th className="px-2 py-2 text-start">{t("customer")}</th>
                  <th className="px-2 py-2 text-start">{t("balanceDue")}</th>
                  <th className="px-2 py-2 text-start">{t("arAging.days")}</th>
                  <th className="px-2 py-2 text-start">{t("arAging.blocked")}</th>
                </tr>
              </thead>
              <tbody>
                {report.invoices.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{row.invoiceNumber}</td>
                    <td className="px-2 py-2">{row.contact.name}</td>
                    <td className="px-2 py-2">
                      {formatMoney(row.balanceDue, row.currency)}
                    </td>
                    <td className="px-2 py-2">{row.daysPastDue}</td>
                    <td className="px-2 py-2">
                      {row.blocked ? (
                        <StatusBadge status="BLOCKED" />
                      ) : (
                        "—"
                      )}
                    </td>
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
