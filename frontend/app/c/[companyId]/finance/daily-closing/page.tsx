import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ReportExportButtons } from "@/components/erp/ReportExportButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { fetchLocalesLookup, lookupSelectOptions } from "@/lib/lookups";
import { closeDailyClosing, openDailyClosing } from "../actions";

type DailyClosing = {
  id: string;
  closingDate: string;
  status: string;
  openingCash: string;
  cashSales: string;
  cashExpenses: string;
  expectedCash: string;
  countedCash: string | null;
  variance: string | null;
  currency: string;
  notes: string | null;
  branch?: { id: string; name: string; code: string } | null;
};

export default async function DailyClosingPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const { formatDate, formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "finance.write");

  const [closings, locales] = await Promise.all([
    apiServer<DailyClosing[]>(
      `/companies/${companyId}/finance/daily-closings`,
      { companyId },
    ).catch(() => []),
    fetchLocalesLookup(companyId),
  ]);

  const open = openDailyClosing.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);
  const currencyOptions = lookupSelectOptions(locales.currencies);
  const reportHref = `/c/${companyId}/reports/modules/finance`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("dailyClosingTitle")}
        description={t("dailyClosingDesc")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button href={reportHref} variant="outline">
              {t("dailyReport")}
            </Button>
            <ReportExportButtons
              companyId={companyId}
              kind="module"
              module="finance"
            />
            <Button href={`/c/${companyId}/finance`} variant="secondary">
              {t("title")}
            </Button>
          </div>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("openClosing")}
          triggerLabel={t("openClosing")}
        >
          <form action={open} className="grid gap-3 md:grid-cols-2">
            <Input
              name="closingDate"
              label={t("closingDate")}
              type="date"
              defaultValue={today}
              required
            />
            <Input
              name="openingCash"
              label={t("openingCash")}
              defaultValue="0"
            />
            <Select
              name="currency"
              label={t("currency")}
              defaultValue={locales.defaults.currency}
              options={currencyOptions}
            />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("descriptionLabel")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("save")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {closings.length === 0 ? (
          <EmptyState message={t("emptyClosings")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("openingCash")}</th>
                  <th className="px-2 py-2 font-medium">{t("salesIncome")}</th>
                  <th className="px-2 py-2 font-medium">{t("expenses")}</th>
                  <th className="px-2 py-2 font-medium">{t("expectedCash")}</th>
                  <th className="px-2 py-2 font-medium">{t("countedCash")}</th>
                  <th className="px-2 py-2 font-medium">{t("variance")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {closings.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">{formatDate(c.closingDate)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(c.openingCash, c.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(c.cashSales, c.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(c.cashExpenses, c.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(c.expectedCash, c.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {c.countedCash != null
                        ? formatMoney(c.countedCash, c.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {c.variance != null
                        ? formatMoney(c.variance, c.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && c.status !== "CLOSED" ? (
                        <form
                          action={closeDailyClosing.bind(
                            null,
                            companyId,
                            c.id,
                          )}
                          className="flex flex-wrap items-end gap-2"
                        >
                          <Input
                            name="countedCash"
                            label={t("countedCash")}
                            required
                            className="!w-28"
                          />
                          <Button type="submit" className="!px-2 !py-1 text-xs">
                            {t("closeDay")}
                          </Button>
                        </form>
                      ) : null}
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
