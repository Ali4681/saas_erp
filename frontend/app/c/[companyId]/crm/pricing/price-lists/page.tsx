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
import { createPriceList } from "../../actions";

type PriceList = {
  id: string;
  name: string;
  listType: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  _count: { entries: number };
};

export default async function PriceListsPage({
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
  const session = await getSession();
  const canWrite = can(session?.user, "crm.write");

  const lists = await apiServer<PriceList[]>(
    `/companies/${companyId}/crm/pricing/price-lists`,
    { companyId },
  ).catch(() => []);

  const create = createPriceList.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("pricing.priceListsTitle")}
        actions={
          <Button href={`/c/${companyId}/crm`} variant="secondary">
            CRM
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite && (
        <CreateFormDialog
          title={t("pricing.newPriceList")}
          triggerLabel={t("pricing.addPriceList")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="name" label={t("name")} required />
            <Select
              name="listType"
              label={t("pricing.listType")}
              defaultValue="RETAIL"
              options={[
                { value: "RETAIL", label: t("pricing.retail") },
                { value: "WHOLESALE", label: t("pricing.wholesale") },
                { value: "CONTRACT", label: t("pricing.contract") },
                { value: "GEO", label: t("pricing.geo") },
              ]}
            />
            <Input name="currency" label={t("currency")} defaultValue="SAR" />
            <div className="md:col-span-2">
              <Textarea name="notes" label={t("notes")} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      )}

      <Card>
        {lists.length === 0 ? (
          <EmptyState message={t("pricing.emptyPriceLists")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium text-start">{t("name")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("pricing.listType")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("currency")}</th>
                  <th className="px-2 py-2 font-medium text-end">{t("pricing.entries")}</th>
                  <th className="px-2 py-2 font-medium text-start">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {lists.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-2 py-2 font-medium">{row.name}</td>
                    <td className="px-2 py-2">{row.listType}</td>
                    <td className="px-2 py-2">{row.currency}</td>
                    <td className="px-2 py-2 text-end">{row._count.entries}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />
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
