import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createMovement } from "../actions";

type Item = { id: string; name: string };
type Warehouse = { id: string; name: string; code: string };
type Movement = {
  id: string;
  movementType: string;
  quantity: string;
  occurredAt: string;
  notes: string | null;
  item?: { name: string } | null;
  warehouse?: { code: string } | null;
};

export default async function MovementsPage({
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

  const [movements, items, warehouses] = await Promise.all([
    apiServer<Movement[]>(`/companies/${companyId}/inventory/movements`, {
      companyId,
    }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
      companyId,
    }).catch(() => []),
    apiServer<Warehouse[]>(`/companies/${companyId}/inventory/warehouses`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createMovement.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("movementsTitle")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newMovement")}
          triggerLabel={t("addMovement")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
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
            <Select
              name="itemId"
              label={t("item")}
              required
              placeholder={t("selectPlaceholder")}
              options={items.map((i) => ({ value: i.id, label: i.name }))}
            />
            <Select
              name="movementType"
              label={t("type")}
              required
              options={[
                { value: "OPENING", label: t("movementOpening") },
                { value: "MANUAL_ADJUSTMENT", label: t("movementManual") },
                { value: "RETURN_IN", label: t("movementReturnIn") },
                { value: "RETURN_OUT", label: t("movementReturnOut") },
                { value: "COUNT_ADJUSTMENT", label: t("movementCountAdj") },
              ]}
            />
            <Input name="quantity" label={t("quantity")} required />
            <Input name="unitCost" label={t("unitCost")} />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("notes")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("register")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {movements.length === 0 ? (
          <EmptyState message={t("emptyMovements")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-right text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("date")}</th>
                  <th className="px-2 py-2 font-medium">{t("item")}</th>
                  <th className="px-2 py-2 font-medium">{t("warehouse")}</th>
                  <th className="px-2 py-2 font-medium">{t("type")}</th>
                  <th className="px-2 py-2 font-medium">{t("quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2">{formatDate(m.occurredAt)}</td>
                    <td className="px-2 py-2">{m.item?.name ?? "—"}</td>
                    <td className="px-2 py-2">{m.warehouse?.code ?? "—"}</td>
                    <td className="px-2 py-2">{m.movementType}</td>
                    <td className="px-2 py-2 font-medium">{m.quantity}</td>
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
