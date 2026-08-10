import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiServer } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createWarehouse } from "../actions";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  status: string;
  addressLine: string | null;
};

export default async function WarehousesPage({
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

  const warehouses = await apiServer<Warehouse[]>(
    `/companies/${companyId}/inventory/warehouses`,
    { companyId },
  ).catch(() => []);

  const create = createWarehouse.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("warehousesTitle")}
        actions={
          <Button href={`/c/${companyId}/inventory`} variant="secondary">
            {t("title")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <CreateFormDialog
          title={t("newWarehouse")}
          triggerLabel={t("addWarehouse")}
        >
          <form action={create} className="grid gap-3 md:grid-cols-2">
            <Input name="code" label={t("code")} required />
            <Input name="name" label={t("name")} required />
            <Input name="addressLine" label={t("address")} />
            <div className="md:col-span-2">
              <Button type="submit">{t("create")}</Button>
            </div>
          </form>
        </CreateFormDialog>
      ) : null}

      <Card>
        {warehouses.length === 0 ? (
          <EmptyState message={t("emptyWarehouses")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("code")}</th>
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("address")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">{w.code}</td>
                    <td className="px-2 py-2 font-medium">{w.name}</td>
                    <td className="px-2 py-2">{w.addressLine ?? "—"}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={w.status} />
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
