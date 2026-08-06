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
import { approveCount, createCount, updateCountLine } from "../actions";

type Warehouse = { id: string; name: string; code: string };
type Item = { id: string; name: string };
type Count = {
  id: string;
  status: string;
  createdAt: string;
  warehouse?: { code: string; name: string } | null;
  lines?: Array<{
    itemId: string;
    systemQuantity: string;
    countedQuantity: string | null;
    item?: { name: string } | null;
  }>;
};

export default async function CountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const { formatDate, formatMoney, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");

  const [counts, warehouses, items] = await Promise.all([
    apiServer<Count[]>(`/companies/${companyId}/inventory/counts`, {
      companyId,
    }).catch(() => []),
    apiServer<Warehouse[]>(`/companies/${companyId}/inventory/warehouses`, {
      companyId,
    }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createCount.bind(null, companyId);
  const open = counts.find(
    (c) => c.status !== "APPROVED" && c.status !== "CANCELLED",
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("countsTitle")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <CreateFormDialog title={t("newCount")} triggerLabel={t("addCount")}>
            <form action={create} className="grid gap-3">
              <Select
                name="warehouseId"
                label={t("warehouse")}
                required
                placeholder={t("selectPlaceholder")}
                options={warehouses.map((w) => ({
                  value: w.id,
                  label: `${w.code} — ${w.name}`,
                }))}
              />
              <Button type="submit">{t("createCount")}</Button>
            </form>
          </CreateFormDialog>

          {open ? (
            <>
              <CreateFormDialog
                title={t("updateLinesTitle", {
                  code: open.warehouse?.code ?? open.id,
                })}
                triggerLabel={t("updateLines")}
                triggerVariant="secondary"
                showPlus={false}
              >
                <form
                  action={updateCountLine.bind(null, companyId, open.id)}
                  className="grid gap-3"
                >
                  <Select
                    name="itemId"
                    label={t("item")}
                    required
                    placeholder={t("selectPlaceholder")}
                    options={items.map((i) => ({
                      value: i.id,
                      label: i.name,
                    }))}
                  />
                  <Input
                    name="countedQuantity"
                    label={t("countedQuantity")}
                    required
                  />
                  <Button type="submit">{t("saveLine")}</Button>
                </form>
              </CreateFormDialog>
              <ActionForm
                label={t("approveCount")}
                variant="primary"
                confirm={t("approveCountConfirm")}
                action={approveCount.bind(null, companyId, open.id)}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <Card>
        {counts.length === 0 ? (
          <EmptyState message={t("emptyCounts")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("warehouse")}</th>
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("lines")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      {c.warehouse
                        ? `${c.warehouse.code} — ${c.warehouse.name}`
                        : "—"}
                    </td>
                    <td className="px-2 py-2">{formatDate(c.createdAt)}</td>
                    <td className="px-2 py-2">{c.lines?.length ?? 0}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={c.status} />
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
