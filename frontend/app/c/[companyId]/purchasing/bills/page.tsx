import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
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
import { createBill } from "../actions";

type Supplier = { id: string; name: string };
type Bill = {
  id: string;
  billNumber: string;
  status: string;
  issuedOn: string;
  totalAmount: string;
  balanceDue: string;
  currency: string;
  supplier?: { name: string } | null;
};

export default async function BillsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("purchasing");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "purchasing.write");

  const [bills, suppliers] = await Promise.all([
    apiServer<Bill[]>(`/companies/${companyId}/purchasing/bills`, {
      companyId,
    }).catch(() => []),
    apiServer<Supplier[]>(`/companies/${companyId}/purchasing/suppliers`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createBill.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("bills.title")}
        actions={
          <Button href={`/c/${companyId}/purchasing`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("bills.newTitle")}
          triggerLabel={t("bills.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="supplierId"
              label={t("supplier")}
              required
              placeholder={tCommon("select")}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Input name="billNumber" label={t("bills.billNumber")} required />
            <Input
              name="issuedOn"
              label={t("issuedOn")}
              type="date"
              defaultValue={today}
              required
            />
            <Input name="dueOn" label={t("dueOn")} type="date" />
            <Input
              name="description"
              label={t("lineDescription")}
              required
              className="md:col-span-2"
            />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="unitCost" label={t("unitCost")} required />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {bills.length === 0 ? (
          <EmptyState message={t("bills.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("supplier")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("total")}</th>
                  <th className="px-2 py-2 font-medium">{t("balanceDue")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">{b.billNumber}</td>
                    <td className="px-2 py-2">{b.supplier?.name ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(b.issuedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(b.totalAmount, b.currency)}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(b.balanceDue, b.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={b.status} />
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
