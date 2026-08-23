import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getFormatters } from "@/lib/format-server";

type ReportTab = "trial-balance" | "income-statement" | "balance-sheet";

type AmountRow = {
  code: string;
  nameEn: string;
  nameAr: string;
  debit?: string;
  credit?: string;
  amount?: string;
};

type TrialBalance = {
  asOf: string | null;
  accounts: AmountRow[];
  totals: { debit: string; credit: string };
};

type IncomeStatement = {
  from: string;
  to: string;
  revenue: AmountRow[];
  expenses: AmountRow[];
  totalRevenue: string;
  totalExpenses: string;
  netIncome: string;
};

type BalanceSheet = {
  asOf: string;
  assets: AmountRow[];
  liabilities: AmountRow[];
  equity: AmountRow[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  balanced: boolean;
};

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default async function FinanceReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    tab?: string;
    asOf?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { companyId } = await params;
  const raw = await searchParams;
  const t = await getTranslations("finance");
  const { formatMoney } = await getFormatters();
  const today = new Date().toISOString().slice(0, 10);
  const tab = (["trial-balance", "income-statement", "balance-sheet"].includes(
    raw.tab ?? "",
  )
    ? raw.tab
    : "trial-balance") as ReportTab;
  const asOf = raw.asOf || today;
  const from = raw.from || today;
  const to = raw.to || today;
  const base = `/c/${companyId}/finance/reports`;

  const trial =
    tab === "trial-balance"
      ? await apiServer<TrialBalance>(
          `/companies/${companyId}/finance/reports/trial-balance${qs({ asOf })}`,
          { companyId },
        ).catch(() => null)
      : null;
  const income =
    tab === "income-statement"
      ? await apiServer<IncomeStatement>(
          `/companies/${companyId}/finance/reports/income-statement${qs({ from, to })}`,
          { companyId },
        ).catch(() => null)
      : null;
  const sheet =
    tab === "balance-sheet"
      ? await apiServer<BalanceSheet>(
          `/companies/${companyId}/finance/reports/balance-sheet${qs({ asOf })}`,
          { companyId },
        ).catch(() => null)
      : null;

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: "trial-balance", label: t("trialBalance") },
    { id: "income-statement", label: t("incomeStatement") },
    { id: "balance-sheet", label: t("balanceSheet") },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("reports")}
        actions={
          <Button href={`/c/${companyId}/finance`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <p className="text-sm text-[var(--color-muted)]">{t("reportsHint")}</p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            href={`${base}?tab=${item.id}`}
            variant={tab === item.id ? "primary" : "secondary"}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "trial-balance" ? (
        <Card title={t("trialBalance")}>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="trial-balance" />
            <Input name="asOf" label={t("asOf")} type="date" defaultValue={asOf} />
            <Button type="submit">{t("runReport")}</Button>
          </form>
          {!trial ? (
            <EmptyState message={t("reportEmpty")} />
          ) : (
            <ReportTable
              rows={trial.accounts}
              showDebitCredit
              formatMoney={formatMoney}
              t={t}
              footerDebit={trial.totals.debit}
              footerCredit={trial.totals.credit}
            />
          )}
        </Card>
      ) : null}

      {tab === "income-statement" ? (
        <Card title={t("incomeStatement")}>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="income-statement" />
            <Input name="from" label={t("from")} type="date" defaultValue={from} />
            <Input name="to" label={t("to")} type="date" defaultValue={to} />
            <Button type="submit">{t("runReport")}</Button>
          </form>
          {!income ? (
            <EmptyState message={t("reportEmpty")} />
          ) : (
            <div className="space-y-4">
              <SectionTable
                title={t("revenue")}
                rows={income.revenue}
                formatMoney={formatMoney}
                t={t}
              />
              <SectionTable
                title={t("expenses")}
                rows={income.expenses}
                formatMoney={formatMoney}
                t={t}
              />
              <p className="text-sm font-medium">
                {t("netIncome")}: {formatMoney(income.netIncome, "SAR")}
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "balance-sheet" ? (
        <Card title={t("balanceSheet")}>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value="balance-sheet" />
            <Input name="asOf" label={t("asOf")} type="date" defaultValue={asOf} />
            <Button type="submit">{t("runReport")}</Button>
          </form>
          {!sheet ? (
            <EmptyState message={t("reportEmpty")} />
          ) : (
            <div className="space-y-4">
              <SectionTable
                title={t("assets")}
                rows={sheet.assets}
                formatMoney={formatMoney}
                t={t}
                total={sheet.totalAssets}
              />
              <SectionTable
                title={t("liabilities")}
                rows={sheet.liabilities}
                formatMoney={formatMoney}
                t={t}
                total={sheet.totalLiabilities}
              />
              <SectionTable
                title={t("equity")}
                rows={sheet.equity}
                formatMoney={formatMoney}
                t={t}
                total={sheet.totalEquity}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-4 py-3 text-sm font-medium">
                <span>
                  {t("totalLiabilitiesAndEquity")}:{" "}
                  {formatMoney(sheet.totalLiabilitiesAndEquity, "SAR")}
                </span>
                <span
                  className={
                    sheet.balanced
                      ? "text-[var(--muted-foreground)]"
                      : "text-[var(--destructive)]"
                  }
                >
                  {sheet.balanced ? t("sheetBalanced") : t("sheetUnbalanced")}
                </span>
              </div>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function ReportTable({
  rows,
  showDebitCredit,
  formatMoney,
  t,
  footerDebit,
  footerCredit,
}: {
  rows: AmountRow[];
  showDebitCredit?: boolean;
  formatMoney: (v: string | number, currency?: string) => string;
  t: Awaited<ReturnType<typeof getTranslations<"finance">>>;
  footerDebit?: string;
  footerCredit?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState message={t("reportEmpty")} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
            <th className="px-2 py-2 font-medium">{t("accountCode")}</th>
            <th className="px-2 py-2 font-medium">{t("name")}</th>
            {showDebitCredit ? (
              <>
                <th className="px-2 py-2 font-medium">{t("debit")}</th>
                <th className="px-2 py-2 font-medium">{t("credit")}</th>
              </>
            ) : (
              <th className="px-2 py-2 font-medium">{t("amount")}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              className="border-b border-[var(--color-border)] last:border-0"
            >
              <td className="px-2 py-2 font-mono text-xs">{r.code}</td>
              <td className="px-2 py-2">
                {r.nameAr} / {r.nameEn}
              </td>
              {showDebitCredit ? (
                <>
                  <td className="px-2 py-2">{formatMoney(r.debit ?? "0", "SAR")}</td>
                  <td className="px-2 py-2">{formatMoney(r.credit ?? "0", "SAR")}</td>
                </>
              ) : (
                <td className="px-2 py-2">{formatMoney(r.amount ?? "0", "SAR")}</td>
              )}
            </tr>
          ))}
        </tbody>
        {showDebitCredit && footerDebit != null && footerCredit != null ? (
          <tfoot>
            <tr className="border-t border-[var(--color-border)] font-medium">
              <td className="px-2 py-2" colSpan={2}>
                {t("totals")}
              </td>
              <td className="px-2 py-2">{formatMoney(footerDebit, "SAR")}</td>
              <td className="px-2 py-2">{formatMoney(footerCredit, "SAR")}</td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function SectionTable({
  title,
  rows,
  formatMoney,
  t,
  total,
}: {
  title: string;
  rows: AmountRow[];
  formatMoney: (v: string | number, currency?: string) => string;
  t: Awaited<ReturnType<typeof getTranslations<"finance">>>;
  total?: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ReportTable rows={rows} formatMoney={formatMoney} t={t} />
      {total != null ? (
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {t("totals")}: {formatMoney(total, "SAR")}
        </p>
      ) : null}
    </div>
  );
}
