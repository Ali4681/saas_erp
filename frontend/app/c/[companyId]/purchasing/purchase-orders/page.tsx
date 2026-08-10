import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
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
  createPurchaseOrder,
  receivePurchaseOrder,
  setPoStatus,
} from "../actions";

type Supplier = { id: string; name: string };
type Item = { id: string; name: string; sku: string | null };
type Warehouse = { id: string; name: string; code: string };
type PO = {
  id: string;
  orderNumber: string;
  status: string;
  orderedOn: string | null;
  totalAmount: string;
  currency: string;
  supplier?: { name: string } | null;
};

export default async function PurchaseOrdersPage({
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

  const [orders, suppliers, items, warehouses] = await Promise.all([
    apiServer<PO[]>(`/companies/${companyId}/purchasing/purchase-orders`, {
      companyId,
    }).catch(() => []),
    apiServer<Supplier[]>(`/companies/${companyId}/purchasing/suppliers`, {
      companyId,
    }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
      companyId,
    }).catch(() => []),
    apiServer<Warehouse[]>(`/companies/${companyId}/inventory/warehouses`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createPurchaseOrder.bind(null, companyId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("purchaseOrders.title")}
        actions={
          <Button href={`/c/${companyId}/purchasing`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("purchaseOrders.newTitle")}
          triggerLabel={t("purchaseOrders.add")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Select
              name="supplierId"
              label={t("supplier")}
              required
              placeholder={tCommon("select")}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select
              name="warehouseId"
              label={t("purchaseOrders.warehouse")}
              placeholder={t("optional")}
              options={warehouses.map((w) => ({
                value: w.id,
                label: `${w.code} — ${w.name}`,
              }))}
            />
            <Input
              name="orderedOn"
              label={t("purchaseOrders.orderedOn")}
              type="date"
              defaultValue={today}
            />
            <Input
              name="expectedOn"
              label={t("purchaseOrders.expectedOn")}
              type="date"
            />
            <Select
              name="itemId"
              label={t("purchaseOrders.item")}
              required
              placeholder={tCommon("select")}
              options={items.map((i) => ({
                value: i.id,
                label: i.sku ? `${i.name} (${i.sku})` : i.name,
              }))}
            />
            <Input name="description" label={t("description")} required />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <Input name="unitCost" label={t("unitCost")} required />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {orders.length === 0 ? (
          <EmptyState message={t("purchaseOrders.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("supplier")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("total")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr
                    key={po.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">
                      {po.orderNumber}
                    </td>
                    <td className="px-2 py-2">{po.supplier?.name ?? "—"}</td>
                    <td className="px-2 py-2">{formatDate(po.orderedOn)}</td>
                    <td className="px-2 py-2">
                      {formatMoney(po.totalAmount, po.currency)}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="px-2 py-2">
                      {canWrite ? (
                        <div className="flex flex-wrap gap-1">
                          {po.status === "DRAFT" ? (
                            <ActionForm
                              label={t("purchaseOrders.approve")}
                              action={setPoStatus.bind(
                                null,
                                companyId,
                                po.id,
                                "APPROVED",
                              )}
                            />
                          ) : null}
                          {["APPROVED", "ORDERED", "PARTIALLY_RECEIVED"].includes(
                            po.status,
                          ) ? (
                            <ActionForm
                              label={t("purchaseOrders.receive")}
                              variant="primary"
                              confirm={t("purchaseOrders.receiveConfirm")}
                              action={receivePurchaseOrder.bind(
                                null,
                                companyId,
                                po.id,
                              )}
                            />
                          ) : null}
                        </div>
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
