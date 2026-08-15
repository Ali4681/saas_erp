import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";
import {
  requestMyAdvance,
  requestMyLeave,
  submitMySale,
  updateMyProfile,
  updateMyTargetCompleted,
} from "../actions";

type MyProfile = {
  id: string;
  fullName: string;
  employeeNumber: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  basicSalary: string | null;
  currency: string;
  employmentStatus: string;
  ibanLast4?: string | null;
  hasIban?: boolean;
  salesTargetAmount?: string | null;
  targetCompletedPercent?: string | null;
  advanceAllowancePercent?: string | null;
  advanceEarnings?: {
    month: string;
    daysWorked: number;
    earnedAmount: string;
    advanceAllowancePercent: string | null;
    maxAdvanceAmount: string;
    advancesUsed: string;
    remainingAdvance: string;
  };
  salesProgress?: {
    month: string;
    salesTargetAmount: string | null;
    approvedSalesSum: string;
    targetCompletedPercent: string;
    overTarget: boolean;
  };
  salaryAdvances?: {
    id: string;
    amount: string;
    currency: string;
    status: string;
    requestedAt: string;
  }[];
  leaveRequests?: {
    id: string;
    leaveType: string;
    status: string;
    startsOn: string;
    endsOn: string;
    requestedDays: string | number;
  }[];
};

type MySale = {
  id: string;
  saleDate: string;
  amount: string;
  paymentMethod: string;
  invoiceNumber?: string | null;
  status: string;
};

type PayableInvoice = {
  id: string;
  invoiceNumber: string;
  balanceDue: string;
  totalAmount: string;
  currency: string;
  contact?: { name: string } | null;
};

export default async function HrMePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("hr");
  const { formatDate, formatMoney } = await getFormatters();

  const me = await apiServer<MyProfile>(`/companies/${companyId}/hr/me`, {
    companyId,
  }).catch(() => null);

  const mySales = me
    ? await apiServer<MySale[]>(`/companies/${companyId}/hr/me/sales`, {
        companyId,
      }).catch(() => [])
    : [];

  const payableInvoices = me
    ? await apiServer<PayableInvoice[]>(
        `/companies/${companyId}/hr/payable-invoices`,
        { companyId },
      ).catch(() => [])
    : [];

  const updateProfile = updateMyProfile.bind(null, companyId);
  const requestAdvance = requestMyAdvance.bind(null, companyId);
  const requestLeave = requestMyLeave.bind(null, companyId);
  const submitSale = submitMySale.bind(null, companyId);
  const updateTarget = updateMyTargetCompleted.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("meTitle")}
        description={t("meDesc")}
        actions={
          <Button href={`/c/${companyId}/hr`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {!me ? (
        <Card>
          <EmptyState message={t("meNoProfile")} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("fullName")}
              </p>
              <p className="mt-1 font-semibold">{me.fullName}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {me.employeeNumber}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("basicSalary")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(me.basicSalary, me.currency)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("titleCol")}
              </p>
              <p className="mt-1 font-semibold">{me.jobTitle ?? "—"}</p>
            </Card>
            <Card>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("status")}
              </p>
              <div className="mt-1">
                <StatusBadge status={me.employmentStatus} />
              </div>
            </Card>
          </div>

          <p className="text-sm text-[var(--muted-foreground)]">
            {t("advanceCapHint")}
          </p>
          {me.advanceEarnings ? (
            <Card className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("earnedThisMonth")} ({me.advanceEarnings.month})
                </p>
                <p className="font-semibold">
                  {formatMoney(me.advanceEarnings.earnedAmount, "SAR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("daysWorked")}
                </p>
                <p className="font-semibold">
                  {me.advanceEarnings.daysWorked}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("maxAdvanceAmount")}
                </p>
                <p className="font-semibold">
                  {formatMoney(me.advanceEarnings.maxAdvanceAmount, "SAR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("remainingAdvance")}
                </p>
                <p className="font-semibold">
                  {formatMoney(me.advanceEarnings.remainingAdvance, "SAR")}
                </p>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("updateProfile")}</h2>
            <form
              action={updateProfile}
              className="grid gap-3 md:grid-cols-2"
            >
              <Input
                name="phone"
                label={t("phone")}
                defaultValue={me.phone ?? ""}
              />
              <Input
                name="email"
                label={t("email")}
                type="email"
                defaultValue={me.email ?? ""}
              />
              <div className="md:col-span-2">
                <Input
                  name="iban"
                  label={t("iban")}
                  placeholder="SA03 8000 0000 6080 1016 7519"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                  {me.hasIban || me.ibanLast4
                    ? t("ibanCurrentHint", { last4: me.ibanLast4 ?? "••••" })
                    : t("ibanHint")}
                </p>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("save")}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("requestAdvance")}</h2>
            <form
              action={requestAdvance}
              className="grid gap-3 md:grid-cols-2"
            >
              <Input name="amount" label={t("amount")} required />
              <div className="md:col-span-2">
                <Textarea name="reason" label={t("reason")} required />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("submit")}</Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("requestLeave")}</h2>
            <form action={requestLeave} className="grid gap-3 md:grid-cols-2">
              <Select
                name="leaveType"
                label={t("type")}
                required
                options={[
                  { value: "ANNUAL", label: t("leaveAnnual") },
                  { value: "SICK", label: t("leaveSick") },
                  { value: "UNPAID", label: t("leaveUnpaid") },
                  { value: "EMERGENCY", label: t("leaveEmergency") },
                  { value: "OTHER", label: t("leaveOther") },
                ]}
              />
              <Input
                name="requestedDays"
                label={t("days")}
                required
                defaultValue="1"
              />
              <Input name="startsOn" label={t("from")} type="date" required />
              <Input name="endsOn" label={t("to")} type="date" required />
              <div className="md:col-span-2">
                <Textarea name="reason" label={t("reason")} required />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("submit")}</Button>
              </div>
            </form>
          </Card>

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
            <p className="mb-4 text-xs text-[var(--muted-foreground)]">
              {t("salesProgressHint")}
            </p>
            <h3 className="mb-3 text-sm font-semibold">{t("submitSale")}</h3>
            <form action={submitSale} className="grid gap-3 md:grid-cols-2">
              <Input
                name="saleDate"
                label={t("date")}
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
              <Input name="amount" label={`${t("amount")} (SAR)`} required />
              <Select
                name="salesInvoiceId"
                label={t("saleInvoiceNumber")}
                required
                placeholder={t("selectInvoice")}
                options={payableInvoices.map((inv) => ({
                  value: inv.id,
                  label: `${inv.invoiceNumber} · ${inv.contact?.name ?? "—"} · ${formatMoney(inv.balanceDue, inv.currency)}`,
                }))}
              />
              <Select
                name="paymentMethod"
                label={t("paymentMethod")}
                required
                options={[
                  { value: "CASH", label: t("payCash") },
                  { value: "CARD", label: t("payCard") },
                  { value: "TRANSFER", label: t("payTransfer") },
                  { value: "NETWORK", label: t("payNetwork") },
                ]}
              />
              {payableInvoices.length === 0 ? (
                <p className="md:col-span-2 text-xs text-[var(--muted-foreground)]">
                  {t("noPayableInvoices")}
                </p>
              ) : null}
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">{t("receipt")}</span>
                <input
                  type="file"
                  name="receipt"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf"
                  className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
                />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("receiptHint")}
                </span>
              </label>
              <div className="md:col-span-2">
                <Button type="submit">{t("submitSale")}</Button>
              </div>
            </form>
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold">
                {t("mySales")}
              </h3>
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
                        <th className="px-2 py-2 font-medium">
                          {t("amount")}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("paymentMethod")}
                        </th>
                        <th className="px-2 py-2 font-medium">
                          {t("status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySales.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="px-2 py-2">
                            {formatDate(s.saleDate)}
                          </td>
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

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("myAdvances")}</h2>
            {!me.salaryAdvances?.length ? (
              <EmptyState message={t("emptyAdvances")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("amount")}</th>
                      <th className="px-2 py-2 font-medium">{t("date")}</th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.salaryAdvances.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">
                          {formatMoney(a.amount, a.currency)}
                        </td>
                        <td className="px-2 py-2">
                          {formatDate(a.requestedAt)}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">{t("myLeaves")}</h2>
            {!me.leaveRequests?.length ? (
              <EmptyState message={t("emptyLeaves")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("type")}</th>
                      <th className="px-2 py-2 font-medium">{t("period")}</th>
                      <th className="px-2 py-2 font-medium">{t("daysCol")}</th>
                      <th className="px-2 py-2 font-medium">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.leaveRequests.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-[var(--border)] last:border-0"
                      >
                        <td className="px-2 py-2">{l.leaveType}</td>
                        <td className="px-2 py-2">
                          {formatDate(l.startsOn)} → {formatDate(l.endsOn)}
                        </td>
                        <td className="px-2 py-2">{l.requestedDays}</td>
                        <td className="px-2 py-2">
                          <StatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
