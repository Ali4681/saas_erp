import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type Insights = {
  contact: {
    id: string;
    name: string;
    customerTrack: string;
    dateOfBirth: string | null;
    birthdayThisMonth: boolean;
  };
  purchaseHistory: Array<{
    itemId: string;
    name: string;
    quantity: number;
    times: number;
  }>;
  suggestions: Array<{ itemId: string; name: string; score: number }>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    issuedOn: string;
    totalAmount: string;
    currency: string;
    saleChannel: string;
  }>;
};

export default async function ContactInsightsPage({
  params,
}: {
  params: Promise<{ companyId: string; contactId: string }>;
}) {
  const { companyId, contactId } = await params;
  const t = await getTranslations("crm");
  const { formatMoney, formatDate } = await getFormatters();
  const insights = await apiServer<Insights>(
    `/companies/${companyId}/crm/contacts/${contactId}/insights`,
    { companyId },
  ).catch(() => null);

  return (
    <div className="space-y-5">
      <PageHeader
        title={insights?.contact.name ?? t("insights.title")}
        description={t("insights.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              href={`/c/${companyId}/crm/contacts/${contactId}/loyalty`}
              variant="secondary"
            >
              {t("loyalty.title")}
            </Button>
            <Button href={`/c/${companyId}/crm/contacts`} variant="secondary">
              {t("contacts.title")}
            </Button>
          </div>
        }
      />

      {insights?.contact.birthdayThisMonth ? (
        <Card title={t("insights.birthdayOffer")}>
          <p className="text-sm">{t("insights.birthdayOfferHint")}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("insights.history")}>
          {!insights || insights.purchaseHistory.length === 0 ? (
            <EmptyState message={t("insights.emptyHistory")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {insights.purchaseHistory.map((row) => (
                <li key={row.itemId}>
                  {row.name} · {row.times} · {row.quantity}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("insights.suggestions")}>
          {!insights || insights.suggestions.length === 0 ? (
            <EmptyState message={t("insights.emptySuggestions")} />
          ) : (
            <ul className="space-y-2 text-sm">
              {insights.suggestions.map((row) => (
                <li key={row.itemId}>{row.name}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t("insights.recentInvoices")}>
        {!insights || insights.recentInvoices.length === 0 ? (
          <EmptyState message={t("insights.emptyHistory")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 text-start">{t("insights.invoice")}</th>
                  <th className="px-2 py-2 text-start">{t("insights.channel")}</th>
                  <th className="px-2 py-2 text-start">{t("insights.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {insights.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2">
                      {inv.invoiceNumber} · {formatDate(inv.issuedOn)}
                    </td>
                    <td className="px-2 py-2">{inv.saleChannel}</td>
                    <td className="px-2 py-2">
                      {formatMoney(inv.totalAmount, inv.currency)}
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
