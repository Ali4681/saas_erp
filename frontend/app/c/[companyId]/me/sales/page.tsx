import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { EmployeeSalesSubmitForm } from "@/components/erp/EmployeeSalesSubmitForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fetchMyProfile, fetchMySales } from "@/lib/hr/my-profile";
import { getFormatters } from "@/lib/format-server";
import { submitMySale, updateMyTargetCompleted } from "../../hr/actions";

export default async function EmployeeSalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const tPortal = await getTranslations("employeePortal");
  const { formatDate, formatMoney } = await getFormatters();
  const me = await fetchMyProfile(companyId);
  const mySales = me ? await fetchMySales(companyId) : [];
  const submitSale = submitMySale.bind(null, companyId);
  const updateTarget = updateMyTargetCompleted.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader title={tPortal("sales")} description={t("salesProgressHint")} />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">{t("tabTargets")}</h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("salesTargetAmount")} (SAR)
              </p>
              <p className="font-semibold">
                {formatMoney(
                  me.salesProgress?.salesTargetAmount ?? me.salesTargetAmount,
                  "SAR",
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("approvedSalesSum")}
              </p>
              <p className="font-semibold">
                {formatMoney(me.salesProgress?.approvedSalesSum, "SAR")}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("targetCompletedPercent")}
              </p>
              <p className="font-semibold">
                {me.salesProgress?.targetCompletedPercent != null
                  ? `${me.salesProgress.targetCompletedPercent}%`
                  : me.targetCompletedPercent != null
                    ? `${me.targetCompletedPercent}%`
                    : "—"}
              </p>
            </div>
            <div className="flex items-end">
              <form action={updateTarget}>
                <Button type="submit" variant="secondary">
                  {t("refreshTarget")}
                </Button>
              </form>
            </div>
          </div>

          <h3 className="mb-3 text-sm font-semibold">{t("submitSale")}</h3>
          <EmployeeSalesSubmitForm
            action={submitSale}
            labels={{
              saleDate: t("date"),
              amount: `${t("amount")} (SAR)`,
              paymentMethod: t("paymentMethod"),
              cash: t("payCash"),
              network: t("payNetwork"),
              transfer: t("payTransfer"),
              cashHint: t("saleCashHint"),
              multiHint: t("saleMultiHint"),
              salesCount: t("saleSalesCount"),
              receiptN: t("saleReceiptN"),
              receipt: t("receipt"),
              notes: t("notes"),
              submit: t("submitSale"),
            }}
          />

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">{t("mySales")}</h3>
            {!mySales.length ? (
              <EmptyState message={t("emptySales")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("date")}</th>
                      <th className="px-2 py-2 font-medium">
                        {t("saleInvoiceNumber")}
                      </th>
                      <th className="px-2 py-2 font-medium">{t("amount")}</th>
                      <th className="px-2 py-2 font-medium">
                        {t("paymentMethod")}
                      </th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySales.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">{formatDate(s.saleDate)}</td>
                        <td className="px-2 py-2 font-mono text-xs">
                          {s.invoiceNumber ?? "—"}
                        </td>
                        <td className="px-2 py-2">
                          {formatMoney(s.amount, "SAR")}
                        </td>
                        <td className="px-2 py-2">{s.paymentMethod}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={s.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
