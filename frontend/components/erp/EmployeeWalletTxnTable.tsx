import { getFormatters } from "@/lib/format-server";

export type EwalletTransaction = {
  id: string;
  kind: "CREDIT" | "DEBIT";
  source:
    | "ADVANCE"
    | "MANUAL"
    | "OPENING"
    | "PURCHASE"
    | "DEDUCTION"
    | "ADVANCE_REPAY"
    | "WALLET_WITHDRAW"
    | (string & {});
  amount: string;
  balanceAfter: string;
  memo: string | null;
  createdAt: string;
};

export async function EmployeeWalletTxnTable({
  transactions,
  currency,
  labels,
}: {
  transactions: EwalletTransaction[];
  currency: string;
  labels: {
    empty: string;
    date: string;
    type: string;
    amount: string;
    balance: string;
    note: string;
    sourceLabels: Record<string, string>;
    kindLabels: Record<string, string>;
  };
}) {
  const { formatDate, formatMoney } = await getFormatters();

  if (!transactions.length) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">{labels.empty}</p>
    );
  }

  const rows = transactions.map((tx) => ({
    id: tx.id,
    date: formatDate(tx.createdAt),
    amount: `${tx.kind === "CREDIT" ? "+" : "−"}${formatMoney(tx.amount, currency)}`,
    balance: formatMoney(tx.balanceAfter, currency),
    type: `${labels.kindLabels[tx.kind] ?? tx.kind} · ${labels.sourceLabels[tx.source] ?? tx.source}`,
    kind: tx.kind,
    memo: tx.memo ?? "—",
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-start text-xs text-[var(--muted-foreground)]">
            <th className="px-2 py-2 font-medium">{labels.date}</th>
            <th className="px-2 py-2 font-medium">{labels.type}</th>
            <th className="px-2 py-2 font-medium">{labels.amount}</th>
            <th className="px-2 py-2 font-medium">{labels.balance}</th>
            <th className="px-2 py-2 font-medium">{labels.note}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[var(--border)]/60 last:border-0"
            >
              <td className="px-2 py-2 whitespace-nowrap">{row.date}</td>
              <td
                className={
                  row.kind === "CREDIT"
                    ? "px-2 py-2 text-emerald-600 dark:text-emerald-400"
                    : "px-2 py-2 text-rose-600 dark:text-rose-400"
                }
              >
                {row.type}
              </td>
              <td className="px-2 py-2 font-medium">{row.amount}</td>
              <td className="px-2 py-2">{row.balance}</td>
              <td className="px-2 py-2 text-[var(--muted-foreground)]">
                {row.memo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
