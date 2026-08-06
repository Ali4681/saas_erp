import { getTranslations } from "next-intl/server";
import { ModuleHub } from "@/components/erp/Flash";
import { Card } from "@/components/ui/Card";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Dashboard = {
  currency: string;
  inflow: string;
  outflow: string;
  net: string;
  transactionCount: number;
};

export default async function FinanceHubPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const t = await getTranslations("finance");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const base = `/c/${companyId}/finance`;
  const dash = await apiServer<Dashboard>(
    `/companies/${companyId}/finance/dashboard`,
    { companyId },
  ).catch(() => null);

  return (
    <div className="space-y-5">
      {dash ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-xs text-[var(--color-muted)]">{t("inflow")}</p>
            <p className="mt-1 text-lg font-semibold">
              {formatMoney(dash.inflow, dash.currency)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--color-muted)]">{t("outflow")}</p>
            <p className="mt-1 text-lg font-semibold">
              {formatMoney(dash.outflow, dash.currency)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--color-muted)]">{t("net")}</p>
            <p className="mt-1 text-lg font-semibold">
              {formatMoney(dash.net, dash.currency)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--color-muted)]">
              {t("transactionCount")}
            </p>
            <p className="mt-1 text-lg font-semibold">{dash.transactionCount}</p>
          </Card>
        </div>
      ) : null}

      <ModuleHub
        title={t("title")}
        description={t("description")}
        links={[
          {
            href: `${base}/accounts`,
            label: t("accounts"),
            hint: t("accountsHint"),
          },
          {
            href: `${base}/expenses`,
            label: t("expenses"),
            hint: t("expensesHint"),
          },
          {
            href: `${base}/transactions`,
            label: t("transactions"),
            hint: t("transactionsHint"),
          },
          {
            href: `${base}/payment-methods`,
            label: t("paymentMethods"),
            hint: t("paymentMethodsHint"),
          },
        ]}
      />
    </div>
  );
}
