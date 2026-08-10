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
import { createItem } from "../actions";

type Unit = { id: string; code: string; name: string };
type Category = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  sku: string | null;
  status: string;
  cost: string | null;
  salePrice: string | null;
  minStock: string;
  parentItemId?: string | null;
  unit?: { code: string } | null;
  parentItem?: { id: string; name: string; sku: string | null } | null;
};

export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");

  const [items, units, categories] = await Promise.all([
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
      companyId,
    }).catch(() => []),
    apiServer<Unit[]>(`/companies/${companyId}/inventory/units`, {
      companyId,
    }).catch(() => []),
    apiServer<Category[]>(`/companies/${companyId}/inventory/categories`, {
      companyId,
    }).catch(() => []),
  ]);

  const create = createItem.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("itemsTitle")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog title={t("newItem")} triggerLabel={t("addItem")}>
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Select
              name="unitId"
              label={t("unit")}
              required
              placeholder={t("selectPlaceholder")}
              options={units.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.code})`,
              }))}
            />
            <Select
              name="itemCategoryId"
              label={t("category")}
              placeholder={t("optional")}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              name="parentItemId"
              label="Parent item"
              placeholder={t("optional")}
              options={items.map((i) => ({
                value: i.id,
                label: i.sku ? `${i.name} (${i.sku})` : i.name,
              }))}
            />
            <Input name="sku" label="SKU" />
            <Input name="cost" label={t("cost")} />
            <Input name="salePrice" label={t("salePrice")} />
            <Input name="minStock" label={t("minStock")} defaultValue="0" />
            <Input name="taxRate" label={t("taxRate")} />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {items.length === 0 ? (
          <EmptyState message={t("emptyItems")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">SKU</th>
                  <th className="px-2 py-2 font-medium">Parent</th>
                  <th className="px-2 py-2 font-medium">{t("unit")}</th>
                  <th className="px-2 py-2 font-medium">{t("cost")}</th>
                  <th className="px-2 py-2 font-medium">{t("sale")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">{item.name}</td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {item.sku ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {item.parentItem?.name ?? "—"}
                    </td>
                    <td className="px-2 py-2">{item.unit?.code ?? "—"}</td>
                    <td className="px-2 py-2">{formatMoney(item.cost)}</td>
                    <td className="px-2 py-2">{formatMoney(item.salePrice)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={item.status} />
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
