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
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createTransfer, receiveTransfer, shipTransfer } from "../actions";

type Wh = { id: string; code: string; name: string };
type Item = { id: string; name: string };
type Transfer = {
  id: string;
  transferNumber: string;
  status: string;
  fromWarehouse?: Wh | null;
  toWarehouse?: Wh | null;
};

export default async function TransfersPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");
  const [rows, warehouses, items] = await Promise.all([
    apiServer<Transfer[]>(`/companies/${companyId}/inventory/transfers`, { companyId }).catch(() => []),
    apiServer<Wh[]>(`/companies/${companyId}/inventory/warehouses`, { companyId }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, { companyId }).catch(() => []),
  ]);
  const create = createTransfer.bind(null, companyId);
  const whOpts = warehouses.map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("transfersTitle")}
        actions={<Button href={`/c/${companyId}/inventory`} variant="secondary">{t("back")}</Button>}
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog title={t("newTransfer")} triggerLabel={t("addTransfer")}>
          <form action={create} className="grid gap-3">
            <Select name="fromWarehouseId" label={t("fromWarehouse")} required options={whOpts} />
            <Select name="toWarehouseId" label={t("toWarehouse")} required options={whOpts} />
            <Select
              name="itemId"
              label={t("item")}
              required
              placeholder={tCommon("select")}
              options={items.map((i) => ({ value: i.id, label: i.name }))}
            />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="notes" label={t("notes")} />
            <Button type="submit">{t("create")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}
      <Card>
        {rows.length === 0 ? (
          <EmptyState message={t("emptyTransfers")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-2 py-2 text-start">{t("code")}</th>
                <th className="px-2 py-2 text-start">{t("fromWarehouse")}</th>
                <th className="px-2 py-2 text-start">{t("toWarehouse")}</th>
                <th className="px-2 py-2 text-start">{t("status")}</th>
                <th className="px-2 py-2 text-start">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-2 py-2 font-mono text-xs">{row.transferNumber}</td>
                  <td className="px-2 py-2">{row.fromWarehouse?.code}</td>
                  <td className="px-2 py-2">{row.toWarehouse?.code}</td>
                  <td className="px-2 py-2">{row.status}</td>
                  <td className="px-2 py-2">
                    {canWrite && (row.status === "DRAFT" || row.status === "REQUESTED") ? (
                      <ActionForm
                        action={shipTransfer.bind(null, companyId, row.id)}
                        label={t("ship")}
                      />
                    ) : null}
                    {canWrite && row.status === "IN_TRANSIT" ? (
                      <ActionForm
                        action={receiveTransfer.bind(null, companyId, row.id)}
                        label={t("receive")}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
