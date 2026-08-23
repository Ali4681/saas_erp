import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { canAny } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { createBundle } from "../../actions";

type Item = { id: string; name: string };
type Bundle = {
  id: string;
  name: string;
  sku: string | null;
  bundlePrice: string;
  items: Array<{ quantity: string; item?: { name: string } | null }>;
};

export default async function BundlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("crm");
  const tCommon = await getTranslations("common");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = canAny(session?.user, "crm.write", "crm.coupons");
  const [bundles, items] = await Promise.all([
    apiServer<Bundle[]>(`/companies/${companyId}/crm/pricing/bundles`, { companyId }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, { companyId }).catch(() => []),
  ]);
  const create = createBundle.bind(null, companyId);
  const itemOptions = items.map((i) => ({ value: i.id, label: i.name }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("pricing.bundlesTitle")}
        actions={
          <Button href={`/c/${companyId}/crm/pricing`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog title={t("pricing.newBundle")} triggerLabel={t("pricing.addBundle")}>
          <form action={create} className="grid gap-3">
            <Input name="name" label={t("pricing.bundleName")} required />
            <Input name="sku" label="SKU" />
            <Input name="bundlePrice" label={t("pricing.bundlePrice")} type="number" required />
            <Select
              name="itemId"
              label={t("pricing.component1")}
              required
              placeholder={tCommon("select")}
              options={itemOptions}
            />
            <Input name="quantity" label={t("pricing.qty")} defaultValue="1" />
            <Select
              name="itemId2"
              label={t("pricing.component2")}
              placeholder={tCommon("select")}
              options={itemOptions}
            />
            <Input name="quantity2" label={t("pricing.qty")} defaultValue="1" />
            <Button type="submit">{t("contacts.save")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}
      <Card>
        {bundles.length === 0 ? (
          <EmptyState message={t("pricing.emptyBundles")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-2 py-2 text-start">{t("pricing.bundleName")}</th>
                <th className="px-2 py-2 text-start">{t("pricing.bundlePrice")}</th>
                <th className="px-2 py-2 text-start">{t("pricing.components")}</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-2 py-2">{row.name}</td>
                  <td className="px-2 py-2">{formatMoney(row.bundlePrice, "SAR")}</td>
                  <td className="px-2 py-2 text-xs">
                    {row.items
                      .map((i) => `${i.item?.name ?? ""} × ${i.quantity}`)
                      .join(", ")}
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
