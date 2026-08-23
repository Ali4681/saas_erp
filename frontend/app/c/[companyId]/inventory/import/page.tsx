import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Textarea } from "@/components/ui/Textarea";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { bulkImportItems } from "../actions";

export default async function ImportItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");
  const importAction = bulkImportItems.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("importTitle")}
        description={t("importDesc")}
        actions={<Button href={`/c/${companyId}/inventory`} variant="secondary">{t("back")}</Button>}
      />
      <FlashFromSearch searchParams={flash} />
      <Card>
        <p className="mb-3 text-sm text-[var(--color-muted)]">{t("importTemplate")}</p>
        {canWrite ? (
          <form action={importAction} className="grid gap-3">
            <Textarea
              name="csv"
              rows={12}
              defaultValue={`name,unitCode,sku,barcode,categoryCode,cost,salePrice,taxRate,minStock
Sample Item,PCS,SKU-1,6281000000001,,10,25,15,5`}
            />
            <Button type="submit">{t("importRun")}</Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
