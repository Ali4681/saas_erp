import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { ActionForm } from "@/components/erp/ActionForm";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can, canAny } from "@/lib/permissions";
import { approveAdjustment, createAdjustment } from "../actions";

type Wh = { id: string; code: string; name: string };
type Item = { id: string; name: string };
type Adj = {
  id: string;
  adjustmentNumber: string;
  reasonCode: string;
  status: string;
  warehouse?: Wh | null;
};

export default async function AdjustmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("inventory");
  const tCommon = await getTranslations("common");
  const session = await getSession();
  const canWrite = can(session?.user, "inventory.write");
  const canApprove = canAny(session?.user, "finance.approve", "finance.write");
  const [rows, warehouses, items] = await Promise.all([
    apiServer<Adj[]>(`/companies/${companyId}/inventory/adjustments`, { companyId }).catch(() => []),
    apiServer<Wh[]>(`/companies/${companyId}/inventory/warehouses`, { companyId }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, { companyId }).catch(() => []),
  ]);
  const create = createAdjustment.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("adjustmentsTitle")}
        actions={<Button href={`/c/${companyId}/inventory`} variant="secondary">{t("back")}</Button>}
      />
      <FlashFromSearch searchParams={flash} />
      {canWrite ? (
        <CreateFormDialog title={t("newAdjustment")} triggerLabel={t("addAdjustment")}>
          <form action={create} className="grid gap-3">
            <Select
              name="warehouseId"
              label={t("warehouse")}
              required
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            <Select
              name="reasonCode"
              label={t("reason")}
              required
              options={[
                { value: "DAMAGE", label: t("reasonDamage") },
                { value: "EXPIRY", label: t("reasonExpiry") },
                { value: "THEFT", label: t("reasonTheft") },
                { value: "SHRINKAGE", label: t("reasonShrinkage") },
                { value: "DOC_ERROR", label: t("reasonDoc") },
                { value: "WEIGHT_VARIANCE", label: t("reasonWeight") },
                { value: "WRITE_DOWN", label: t("reasonWriteDown") },
              ]}
            />
            <Select
              name="itemId"
              label={t("item")}
              required
              placeholder={tCommon("select")}
              options={items.map((i) => ({ value: i.id, label: i.name }))}
            />
            <Input name="quantityDelta" label={t("quantityDelta")} required />
            <Input name="unitCost" label={t("unitCost")} />
            <Input name="notes" label={t("notes")} />
            <Button type="submit">{t("create")}</Button>
          </form>
        </CreateFormDialog>
      ) : null}
      <Card>
        {rows.length === 0 ? (
          <EmptyState message={t("emptyAdjustments")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="px-2 py-2 text-start">{t("code")}</th>
                <th className="px-2 py-2 text-start">{t("warehouse")}</th>
                <th className="px-2 py-2 text-start">{t("reason")}</th>
                <th className="px-2 py-2 text-start">{t("status")}</th>
                <th className="px-2 py-2 text-start">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-2 py-2 font-mono text-xs">{row.adjustmentNumber}</td>
                  <td className="px-2 py-2">{row.warehouse?.code}</td>
                  <td className="px-2 py-2">{row.reasonCode}</td>
                  <td className="px-2 py-2">{row.status}</td>
                  <td className="px-2 py-2">
                    {canApprove && row.status === "PENDING" ? (
                      <ActionForm
                        action={approveAdjustment.bind(null, companyId, row.id)}
                        label={t("approve")}
                      />
                    ) : null}
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
