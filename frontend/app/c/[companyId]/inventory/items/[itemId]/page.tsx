import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getFormatters } from "@/lib/format-server";
import { clearItemImage, uploadItemImage } from "../../actions";

type ItemDetail = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  status: string;
  cost: string | null;
  salePrice: string | null;
  imageAttachmentId?: string | null;
  unit?: { code: string; name: string } | null;
  category?: { id: string; name: string } | null;
};

export default async function ItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; itemId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId, itemId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const { formatMoney } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");

  const item = await apiServer<ItemDetail>(
    `/companies/${companyId}/inventory/items/${itemId}`,
    { companyId },
  ).catch(() => null);
  if (!item) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        title={item.name}
        description={t("itemCardDesc")}
        actions={
          <Button
            href={`/c/${companyId}/inventory/items`}
            variant="secondary"
          >
            {t("itemsTitle")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      <Card className="space-y-4 border-[var(--primary)]/25 p-4">
        <div>
          <h2 className="text-sm font-semibold">{t("itemImageTitle")}</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t("itemImageHint")}
          </p>
        </div>
        {item.imageAttachmentId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/attachments/${item.imageAttachmentId}?companyId=${companyId}&inline=1`}
            alt={item.name}
            className="max-h-72 w-full rounded-xl border border-[var(--border)] object-contain bg-[var(--muted)]"
          />
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
            {t("itemImageEmpty")}
          </p>
        )}
        {canWrite ? (
          <div className="flex flex-wrap items-end gap-3">
            <form
              action={uploadItemImage.bind(null, companyId, itemId)}
              className="flex flex-wrap items-end gap-3"
            >
              <label className="grid gap-1 text-sm">
                <span className="font-medium">{t("itemImageUpload")}</span>
                <input
                  type="file"
                  name="file"
                  accept="image/*"
                  required
                  className="max-w-xs text-sm"
                />
              </label>
              <Button type="submit">{t("itemImageSave")}</Button>
            </form>
            {item.imageAttachmentId ? (
              <ActionForm
                label={t("itemImageClear")}
                action={clearItemImage.bind(null, companyId, itemId)}
                confirm={t("itemImageClearConfirm")}
                variant="secondary"
              />
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("name")}</p>
          <p className="font-medium">{item.name}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("status")}</p>
          <StatusBadge status={item.status} />
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">SKU</p>
          <p className="font-mono text-sm">{item.sku ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("barcode")}</p>
          <p className="font-mono text-sm">{item.barcode ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("unit")}</p>
          <p>{item.unit ? `${item.unit.name} (${item.unit.code})` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("category")}</p>
          <p>{item.category?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("cost")}</p>
          <p>{formatMoney(item.cost)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{t("salePrice")}</p>
          <p>{formatMoney(item.salePrice)}</p>
        </div>
      </Card>
    </div>
  );
}
