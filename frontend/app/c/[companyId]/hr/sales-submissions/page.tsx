import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { decideSalesSubmission } from "../actions";

type Sale = {
  id: string;
  saleDate: string;
  amount: string;
  paymentMethod: string;
  invoiceNumber?: string | null;
  status: string;
  employee?: { fullName: string; employeeNumber: string } | null;
};

export default async function SalesSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; status?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate, formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "hr.write");
  const canApproveCash = can(session?.user, "hr.sales_cash.approve");

  const q = flash.status
    ? `?status=${encodeURIComponent(flash.status)}`
    : "";
  const sales = await apiServer<Sale[]>(
    `/companies/${companyId}/hr/sales-submissions${q}`,
    { companyId },
  ).catch(() => []);

  const pagePath = `/c/${companyId}/hr/sales-submissions`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("salesSubmissions")}
        description={t("salesCashApprovalHint")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      <Card>
        {sales.length === 0 ? (
          <EmptyState message={t("emptySales")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("employee")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("saleInvoiceNumber")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("amount")}</th>
                  <th className="px-2 py-2 font-medium">
                    {t("paymentMethod")}
                  </th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      {s.employee
                        ? `${s.employee.employeeNumber} — ${s.employee.fullName}`
                        : "—"}
                    </td>
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
                    <td className="px-2 py-2">
                      {(() => {
                        const pending =
                          s.status === "PENDING_CASH_APPROVAL" ||
                          s.status === "SUBMITTED" ||
                          s.status === "NEEDS_RECEIPT";
                        if (!pending) return null;

                        const isCash =
                          s.paymentMethod === "CASH" ||
                          s.status === "PENDING_CASH_APPROVAL";
                        const canDecide = isCash
                          ? canApproveCash
                          : canWrite;
                        if (!canDecide) return null;

                        const canApprove =
                          s.status !== "NEEDS_RECEIPT" &&
                          (isCash ? canApproveCash : canWrite);

                        return (
                          <div className="flex flex-wrap gap-1">
                            {canApprove ? (
                              <ActionForm
                                label={t("approve")}
                                action={decideSalesSubmission.bind(
                                  null,
                                  companyId,
                                  s.id,
                                  "APPROVED",
                                  pagePath,
                                )}
                              />
                            ) : null}
                            <ActionForm
                              label={t("reject")}
                              variant="danger"
                              action={decideSalesSubmission.bind(
                                null,
                                companyId,
                                s.id,
                                "REJECTED",
                                pagePath,
                              )}
                            />
                          </div>
                        );
                      })()}
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
