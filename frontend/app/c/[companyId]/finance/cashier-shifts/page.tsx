import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import {
  approveCashierShift,
  closeCashierShift,
  openCashierShift,
} from "../actions";

type ShiftSession = {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: string;
  cashSales: string;
  cardSales: string;
  transferSales: string;
  pettyExpenses: string;
  expectedCash: string;
  countedCash: string | null;
  variance: string | null;
  currency: string;
  zReportNumber: string | null;
  employee?: { fullName: string; employeeNumber: string } | null;
};

type Employee = {
  id: string;
  fullName: string;
  employeeNumber: string;
};

export default async function CashierShiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("finance");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "finance.write");

  const [shifts, employees] = await Promise.all([
    apiServer<ShiftSession[]>(
      `/companies/${companyId}/finance/cashier-shifts`,
      { companyId },
    ).catch(() => []),
    apiServer<Employee[]>(`/companies/${companyId}/hr/employees`, {
      companyId,
    }).catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("cashierTitle")}
        description={t("cashierDesc")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`/c/${companyId}/finance`} variant="secondary">
              {t("title")}
            </Button>
            {canWrite ? (
              <CreateFormDialog
                title={t("cashierOpen")}
                description={t("cashierOpenHint")}
                triggerLabel={t("cashierOpen")}
              >
                <form
                  action={openCashierShift.bind(null, companyId)}
                  className="grid gap-3"
                >
                  <Select
                    name="employeeId"
                    label={t("cashierEmployee")}
                    required
                    options={employees.map((e) => ({
                      value: e.id,
                      label: `${e.employeeNumber} — ${e.fullName}`,
                    }))}
                  />
                  <Input
                    name="openingFloat"
                    label={t("cashierFloat")}
                    defaultValue="0"
                  />
                  <Button type="submit">{t("cashierOpen")}</Button>
                </form>
              </CreateFormDialog>
            ) : null}
          </div>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card>
        {shifts.length === 0 ? (
          <EmptyState message={t("cashierEmpty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2">{t("cashierEmployee")}</th>
                  <th className="px-2 py-2">{t("cashierStatus")}</th>
                  <th className="px-2 py-2">{t("cashierFloat")}</th>
                  <th className="px-2 py-2">{t("expectedCash")}</th>
                  <th className="px-2 py-2">{t("countedCash")}</th>
                  <th className="px-2 py-2">{t("variance")}</th>
                  <th className="px-2 py-2">{t("cashierZ")}</th>
                  <th className="px-2 py-2">{t("cashierActions")}</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      {s.employee?.fullName ?? "—"}
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {s.openedAt.slice(0, 16).replace("T", " ")}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(s.openingFloat, s.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(s.expectedCash, s.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {s.countedCash
                        ? formatMoney(s.countedCash, s.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2">
                      {s.variance != null
                        ? formatMoney(s.variance, s.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {s.zReportNumber ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {canWrite && s.status === "OPEN" ? (
                        <CreateFormDialog
                          title={t("cashierClose")}
                          description={t("cashierCloseHint")}
                          triggerLabel={t("cashierClose")}
                          triggerVariant="secondary"
                          showPlus={false}
                        >
                          <form
                            action={closeCashierShift.bind(
                              null,
                              companyId,
                              s.id,
                            )}
                            className="grid gap-3"
                          >
                            <Input
                              name="cashSales"
                              label={t("cashierCashSales")}
                              defaultValue={s.cashSales}
                            />
                            <Input
                              name="cardSales"
                              label={t("cashierCardSales")}
                              defaultValue={s.cardSales}
                            />
                            <Input
                              name="transferSales"
                              label={t("cashierTransferSales")}
                              defaultValue={s.transferSales}
                            />
                            <Input
                              name="pettyExpenses"
                              label={t("cashierPetty")}
                              defaultValue={s.pettyExpenses}
                            />
                            <Input
                              name="countedCash"
                              label={t("countedCash")}
                              required
                            />
                            <Button type="submit">{t("cashierClose")}</Button>
                          </form>
                        </CreateFormDialog>
                      ) : null}
                      {canWrite && s.status === "PENDING_APPROVAL" ? (
                        <ActionForm
                          label={t("cashierApprove")}
                          action={approveCashierShift.bind(
                            null,
                            companyId,
                            s.id,
                          )}
                        />
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
