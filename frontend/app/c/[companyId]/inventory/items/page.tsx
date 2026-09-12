import Link from "next/link";
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
import { Textarea } from "@/components/ui/Textarea";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createItem } from "../actions";

type Unit = { id: string; code: string; name: string };
type Category = { id: string; name: string; parentId: string | null };
type Supplier = { id: string; name: string; code: string | null };
type Item = {
  id: string;
  name: string;
  marketingName?: string | null;
  nature?: string;
  sku: string | null;
  barcode?: string | null;
  status: string;
  cost: string | null;
  purchasePrice?: string | null;
  salePrice: string | null;
  retailPrice?: string | null;
  wholesalePrice?: string | null;
  minStock: string;
  shelfLocation?: string | null;
  parentItemId?: string | null;
  unit?: { code: string } | null;
  category?: { id: string; name: string } | null;
  parentItem?: { id: string; name: string; sku: string | null } | null;
  _count?: { bomComponents?: number };
};

function categoryDepth(
  id: string,
  byId: Map<string, Category>,
  memo = new Map<string, number>(),
): number {
  if (memo.has(id)) return memo.get(id)!;
  const cat = byId.get(id);
  if (!cat?.parentId) {
    memo.set(id, 0);
    return 0;
  }
  const d = 1 + categoryDepth(cat.parentId, byId, memo);
  memo.set(id, d);
  return d;
}

function categoryLabel(c: Category, byId: Map<string, Category>): string {
  const parts: string[] = [c.name];
  let cur = c.parentId ? byId.get(c.parentId) : undefined;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  const depth = categoryDepth(c.id, byId);
  const levelTag = `L${depth + 1}`;
  return `${levelTag} · ${parts.join(" / ")}`;
}

export default async function ItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string; nature?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");
  const natureFilter = flash.nature?.trim() || "";

  const [items, units, categories, suppliers] = await Promise.all([
    apiServer<Item[]>(
      `/companies/${companyId}/inventory/items${
        natureFilter ? `?nature=${encodeURIComponent(natureFilter)}` : ""
      }`,
      { companyId },
    ).catch(() => []),
    apiServer<Unit[]>(`/companies/${companyId}/inventory/units`, {
      companyId,
    }).catch(() => []),
    apiServer<Category[]>(`/companies/${companyId}/inventory/categories`, {
      companyId,
    }).catch(() => []),
    apiServer<Supplier[]>(`/companies/${companyId}/purchasing/suppliers`, {
      companyId,
    }).catch(() => []),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const create = createItem.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("itemsTitle")}
        description={t("itemsDesc")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { value: "", label: t("natureAll") },
          { value: "SELLABLE", label: t("natureSellable") },
          { value: "RAW_MATERIAL", label: t("natureRaw") },
          { value: "OPERATIONAL_SUPPLY", label: t("natureOps") },
        ].map((opt) => (
          <Link
            key={opt.value || "all"}
            href={
              opt.value
                ? `/c/${companyId}/inventory/items?nature=${opt.value}`
                : `/c/${companyId}/inventory/items`
            }
            className={`rounded-full px-3 py-1 ${
              natureFilter === opt.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {canWrite ? (
        <CreateFormDialog title={t("newItem")} triggerLabel={t("addItem")}>
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Input name="marketingName" label={t("marketingName")} />
            <Select
              name="nature"
              label={t("itemNature")}
              required
              defaultValue="SELLABLE"
              options={[
                { value: "SELLABLE", label: t("natureSellable") },
                { value: "RAW_MATERIAL", label: t("natureRaw") },
                { value: "OPERATIONAL_SUPPLY", label: t("natureOps") },
              ]}
            />
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
              options={categories.map((c) => ({
                value: c.id,
                label: categoryLabel(c, catById),
              }))}
            />
            <Select
              name="parentItemId"
              label={t("parentItem")}
              placeholder={t("optional")}
              options={items.map((i) => ({
                value: i.id,
                label: i.sku ? `${i.name} (${i.sku})` : i.name,
              }))}
            />
            <Input name="sku" label={t("sku")} />
            <Input name="barcode" label={t("barcodeAuto")} />
            <div className="md:col-span-2">
              <Textarea name="description" label={t("description")} />
            </div>
            <Input name="purchasePrice" label={t("purchasePrice")} />
            <Input name="storageCost" label={t("storageCost")} />
            <Input name="salePrice" label={t("salePrice")} />
            <Input name="wholesalePrice" label={t("wholesalePrice")} />
            <Input name="retailPrice" label={t("retailPrice")} />
            <Input name="minStock" label={t("reorderPoint")} defaultValue="0" />
            <Input name="reorderQty" label={t("reorderQty")} />
            <Input name="shelfLocation" label={t("shelfLocation")} />
            <Select
              name="preferredSupplierId"
              label={t("preferredSupplier")}
              placeholder={t("optional")}
              options={suppliers.map((s) => ({
                value: s.id,
                label: s.code ? `${s.name} (${s.code})` : s.name,
              }))}
            />
            <Input name="supplierSku" label={t("supplierSku")} />
            <Input
              name="lastSuppliedAt"
              label={t("lastSuppliedAt")}
              type="date"
            />
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
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("itemNature")}</th>
                  <th className="px-2 py-2 font-medium">{t("sku")}</th>
                  <th className="px-2 py-2 font-medium">{t("category")}</th>
                  <th className="px-2 py-2 font-medium">{t("purchasePrice")}</th>
                  <th className="px-2 py-2 font-medium">{t("salePrice")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <div className="font-medium">{item.name}</div>
                      {item.marketingName ? (
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {item.marketingName}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={item.nature ?? "SELLABLE"} />
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {item.sku ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {item.category?.name ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(
                        item.purchasePrice ?? item.cost ?? "0",
                        "SAR",
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(
                        item.retailPrice ?? item.salePrice ?? "0",
                        "SAR",
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        href={`/c/${companyId}/inventory/items/${item.id}`}
                        variant="secondary"
                      >
                        {t("openCard")}
                      </Button>
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
