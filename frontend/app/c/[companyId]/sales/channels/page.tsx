import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { ingestChannelOrder } from "../actions";

type ChannelRow = {
  channel: string;
  count: number;
  total: string;
  paid: string;
  outstanding: string;
};

export default async function ChannelSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("sales");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "sales.write");
  const rows = await apiServer<ChannelRow[]>(
    `/companies/${companyId}/sales/reports/channels`,
    { companyId },
  ).catch(() => []);
  const ingest = ingestChannelOrder.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("channelReport.title")}
        description={t("channelReport.description")}
        actions={
          <Button href={`/c/${companyId}/sales`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog title={t("ingest.title")} triggerLabel={t("ingest.add")}>
          <form action={ingest} className="grid gap-3">
            <Select
              name="provider"
              label={t("ingest.provider")}
              required
              options={[
                { value: "SALLA", label: "Salla" },
                { value: "ZID", label: "Zid" },
                { value: "HUNGERSTATION", label: "HungerStation" },
                { value: "TABBY", label: "Tabby" },
                { value: "TAMARA", label: "Tamara" },
              ]}
            />
            <Input name="externalOrderId" label={t("ingest.externalOrderId")} required />
            <Select
              name="saleChannel"
              label={t("channel")}
              defaultValue="ECOMMERCE"
              options={[
                { value: "ECOMMERCE", label: t("channels.ecommerce") },
                { value: "DELIVERY", label: t("channels.delivery") },
                { value: "BNPL", label: t("channels.bnpl") },
                { value: "POS", label: t("channels.pos") },
              ]}
            />
            <Input name="contactPhone" label={t("ingest.phone")} />
            <Input name="contactName" label={t("customer")} />
            <Input name="commissionAmount" label={t("ingest.commission")} type="number" />
            <Input name="description" label={t("lineDescription")} required />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="unitPrice" label={t("unitPrice")} required />
            <Button type="submit">{t("create")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}
      <Card>
        {rows.length === 0 ? (
          <EmptyState message={t("channelReport.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 text-start">{t("channel")}</th>
                  <th className="px-2 py-2 text-start">{t("channelReport.count")}</th>
                  <th className="px-2 py-2 text-start">{t("total")}</th>
                  <th className="px-2 py-2 text-start">{t("channelReport.paid")}</th>
                  <th className="px-2 py-2 text-start">{t("balanceDue")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.channel}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{row.channel}</td>
                    <td className="px-2 py-2">{row.count}</td>
                    <td className="px-2 py-2">{formatMoney(row.total, "SAR")}</td>
                    <td className="px-2 py-2">{formatMoney(row.paid, "SAR")}</td>
                    <td className="px-2 py-2">
                      {formatMoney(row.outstanding, "SAR")}
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
