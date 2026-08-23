import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { creditStoreWallet, debitStoreWallet } from "../../../actions";

type StoreCreditEvent = {
  id: string;
  direction: string;
  amount: string;
  note: string | null;
  createdAt: string;
};

type StoreCredit = {
  id: string;
  balance: string;
  currency: string;
  events: StoreCreditEvent[];
};

export default async function StoreCreditPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; contactId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId, contactId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");

  const account = await apiServer<StoreCredit>(
    `/companies/${companyId}/crm/contacts/${contactId}/store-credit`,
    { companyId },
  ).catch(() => null);

  const credit = creditStoreWallet.bind(null, companyId, contactId);
  const debit = debitStoreWallet.bind(null, companyId, contactId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("storeCredit.title")}
        actions={
          <Button href={`/c/${companyId}/crm/contacts`} variant="secondary">
            {t("contacts.title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card>
        <p className="text-sm text-[var(--color-muted)]">{t("storeCredit.balance")}</p>
        <p className="text-4xl font-bold mt-2">
          {formatMoney(account?.balance ?? 0, account?.currency ?? "SAR")}
        </p>
      </Card>

      {canWrite && (
        <div className="flex gap-3">
          <CreateFormDialog title={t("storeCredit.credit")} triggerLabel={t("storeCredit.credit")}>
            <form action={credit} className="grid gap-3">
              <Input name="amount" label={t("value")} type="number" min="0.01" step="0.01" required />
              <Input name="note" label={t("notes")} />
              <Button type="submit">{t("storeCredit.credit")}</Button>
            </form>
          </CreateFormDialog>

          <CreateFormDialog title={t("storeCredit.debit")} triggerLabel={t("storeCredit.debit")}>
            <form action={debit} className="grid gap-3">
              <Input name="amount" label={t("value")} type="number" min="0.01" step="0.01" required />
              <Input name="note" label={t("notes")} />
              <Button type="submit" variant="secondary">{t("storeCredit.debit")}</Button>
            </form>
          </CreateFormDialog>
        </div>
      )}

      <Card>
        <h3 className="text-sm font-semibold mb-3">{t("storeCredit.history")}</h3>
        {!account?.events?.length ? (
          <p className="text-sm text-[var(--color-muted)]">{t("storeCredit.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium text-start">{t("storeCredit.direction")}</th>
                  <th className="px-2 py-2 font-medium text-end">{t("value")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("notes")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("createdAt")}</th>
                </tr>
              </thead>
              <tbody>
                {account.events.map((ev) => (
                  <tr key={ev.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2">
                      <StatusBadge status={ev.direction} />
                    </td>
                    <td className="px-2 py-2 text-end font-mono">
                      {formatMoney(ev.amount, account.currency)}
                    </td>
                    <td className="px-2 py-2 text-[var(--color-muted)]">{ev.note ?? "—"}</td>
                    <td className="px-2 py-2 text-[var(--color-muted)]">
                      {new Date(ev.createdAt).toLocaleDateString()}
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
