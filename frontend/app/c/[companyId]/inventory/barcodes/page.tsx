import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { BarcodePrintButton } from "@/components/erp/BarcodePrintButton";
import { GenerateBarcodeForm } from "@/components/erp/GenerateBarcodeForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { generateBarcode } from "../actions";

type Item = { id: string; name: string; sku?: string | null; barcode?: string | null };
type ItemBarcode = {
  id: string;
  barcode: string;
  barcodeType: string;
  item?: { id: string; name: string; sku?: string | null } | null;
};

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
  const [items, barcodes] = await Promise.all([
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
      companyId,
    }).catch(() => []),
    apiServer<ItemBarcode[]>(`/companies/${companyId}/inventory/barcodes`, {
      companyId,
    }).catch(() => []),
  ]);
  const gen = generateBarcode.bind(null, companyId);
  const rows =
    barcodes.length > 0
      ? barcodes.map((b) => ({
          id: b.id,
          name: b.item?.name ?? "—",
          sku: b.item?.sku ?? null,
          barcode: b.barcode,
          barcodeType: b.barcodeType,
        }))
      : items
          .filter((i) => i.barcode)
          .map((i) => ({
            id: i.id,
            name: i.name,
            sku: i.sku ?? null,
            barcode: i.barcode as string,
            barcodeType: "RETAIL",
          }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("barcodesTitle")}
        description={t("barcodesHint")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog
          title={t("generateBarcode")}
          triggerLabel={t("generateBarcode")}
          closeOnSuccess
        >
          <GenerateBarcodeForm
            action={gen}
            items={items}
            labels={{
              item: t("item"),
              barcodeType: t("barcodeType"),
              barcodeRetail: t("barcodeRetail"),
              barcodeLogistic: t("barcodeLogistic"),
              barcodeSupplier: t("barcodeSupplier"),
              barcodeSerial: t("barcodeSerial"),
              serialHint: t("serialGenerateHint"),
              serialModeLabel: t("serialModeLabel"),
              serialModeUnique: t("serialModeUnique"),
              serialModeShared: t("serialModeShared"),
              create: t("create"),
              generating: t("generatingBarcode"),
              uniqueHint: t("uniqueBarcodeHint"),
            }}
          />
        </CreateFormDialog>
      ) : null}
      <Card>
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("barcodesHint")}
        </p>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            {t("emptyBarcodes")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {rows.slice(0, 120).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="font-mono text-xs">{row.barcode}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {row.barcodeType}
                  </p>
                </div>
                <BarcodePrintButton
                  title={row.name}
                  sku={row.sku}
                  barcode={row.barcode}
                  label={t("printLabel")}
                  copiesLabel={t("printCopies")}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
