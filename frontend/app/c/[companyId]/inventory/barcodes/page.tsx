import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { generateBarcode } from "../actions";

type Item = { id: string; name: string; barcode?: string | null };

export default async function BarcodesPage({
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
  const items = await apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
    companyId,
  }).catch(() => []);
  const gen = generateBarcode.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("barcodesTitle")}
        actions={<Button href={`/c/${companyId}/inventory`} variant="secondary">{t("back")}</Button>}
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog title={t("generateBarcode")} triggerLabel={t("generateBarcode")}>
          <form action={gen} className="grid gap-3">
            <Select
              name="itemId"
              label={t("item")}
              required
              options={items.map((i) => ({ value: i.id, label: i.name }))}
            />
            <Select
              name="barcodeType"
              label={t("barcodeType")}
              defaultValue="RETAIL"
              options={[
                { value: "RETAIL", label: t("barcodeRetail") },
                { value: "LOGISTIC", label: t("barcodeLogistic") },
                { value: "SUPPLIER", label: t("barcodeSupplier") },
                { value: "SERIAL", label: t("barcodeSerial") },
              ]}
            />
            <Input name="quantity" label={t("quantity")} defaultValue="1" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="serialBased" />
              {t("serialBased")}
            </label>
            <Button type="submit">{t("create")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}
      <Card>
        <p className="text-sm text-[var(--color-muted)]">{t("barcodesHint")}</p>
        <ul className="mt-3 space-y-1 text-sm">
          {items
            .filter((i) => i.barcode)
            .slice(0, 40)
            .map((i) => (
              <li key={i.id}>
                {i.name}: <span className="font-mono">{i.barcode}</span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}
