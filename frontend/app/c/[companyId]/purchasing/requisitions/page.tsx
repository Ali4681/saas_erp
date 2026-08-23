import { getTranslations } from "next-intl/server";
import { FlashFromSearch } from "@/components/erp/Flash";
import { CreateFormDialog } from "@/components/erp/CreateFormDialog";
import { ActionForm } from "@/components/erp/ActionForm";
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
import {
  approveRequisition,
  createRequisition,
  createRequisitionFromReorder,
  submitRequisition,
} from "../actions";

type Item = { id: string; name: string; sku: string | null };
type Requisition = {
  id: string;
  requisitionNumber: string;
  status: string;
  demandSource: string;
  neededBy: string | null;
  notes: string | null;
  createdAt: string;
  items: Array<{ id: string; description: string; quantity: string }>;
  requestedBy?: { fullName: string } | null;
};
type Suggestion = {
  itemId: string;
  name: string;
  sku: string | null;
  onHand: string;
  minStock: string;
  shortfall: string;
};

export default async function RequisitionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { companyId } = await params;
  const flash = await searchParams;
  const t = await getTranslations("purchasing");
  const { formatDate, formatNumber } = await getFormatters();
  const session = await getSession();
  const canWrite = can(session?.user, "purchasing.write");

  const [requisitions, items, suggestions] = await Promise.all([
    apiServer<Requisition[]>(`/companies/${companyId}/purchasing/requisitions`, {
      companyId,
    }).catch(() => []),
    apiServer<Item[]>(`/companies/${companyId}/inventory/items`, {
      companyId,
    }).catch(() => []),
    apiServer<Suggestion[]>(
      `/companies/${companyId}/purchasing/reorder-suggestions`,
      { companyId },
    ).catch(() => []),
  ]);

  const create = createRequisition.bind(null, companyId);
  const fromReorder = createRequisitionFromReorder.bind(null, companyId);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("requisitions.title")}
        actions={
          <Button href={`/c/${companyId}/purchasing`} variant="secondary">
            {t("back")}
          </Button>
        }
      />
      <FlashFromSearch searchParams={flash} />

      {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <CreateFormDialog
            title={t("requisitions.newTitle")}
            triggerLabel={t("requisitions.add")}
          >
            <form action={create} className="grid gap-3 md:grid-cols-2">
              <Select
                name="demandSource"
                label={t("requisitions.demandSource")}
                options={[
                  {
                    value: "BRANCH_REQUISITION",
                    label: t("requisitions.sourceBranch"),
                  },
                  {
                    value: "REORDER_POINT",
                    label: t("requisitions.sourceReorder"),
                  },
                  {
                    value: "MANAGEMENT_PLAN",
                    label: t("requisitions.sourceManagement"),
                  },
                  { value: "OTHER", label: t("requisitions.sourceOther") },
                ]}
              />
              <Input
                name="neededBy"
                label={t("requisitions.neededBy")}
                type="date"
              />
              <div className="md:col-span-2">
                <Textarea name="notes" label={t("notes")} />
              </div>
              <Select
                name="itemId"
                label={t("requisitions.item")}
                placeholder={t("optional")}
                options={items.map((i) => ({
                  value: i.id,
                  label: i.sku ? `${i.name} (${i.sku})` : i.name,
                }))}
              />
              <Input
                name="quantity"
                label={t("quantity")}
                defaultValue="1"
                required
              />
              <div className="md:col-span-2">
                <Input
                  name="description"
                  label={t("description")}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">{t("create")}</Button>
              </div>
            </form>
          </CreateFormDialog>
          {suggestions.length > 0 ? (
            <ActionForm
              label={t("requisitions.createFromReorder")}
              variant="primary"
              action={fromReorder}
            />
          ) : null}
        </div>
      ) : null}

      <Card title={t("requisitions.reorderTitle")}>
        {suggestions.length === 0 ? (
          <EmptyState message={t("requisitions.reorderEmpty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("name")}</th>
                  <th className="px-2 py-2 font-medium">{t("requisitions.onHand")}</th>
                  <th className="px-2 py-2 font-medium">{t("requisitions.minStock")}</th>
                  <th className="px-2 py-2 font-medium">{t("requisitions.shortfall")}</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr
                    key={s.itemId}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">
                      {s.name}
                      {s.sku ? (
                        <span className="ms-1 text-xs text-[var(--color-muted)]">
                          ({s.sku})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">{formatNumber(Number(s.onHand))}</td>
                    <td className="px-2 py-2">{formatNumber(Number(s.minStock))}</td>
                    <td className="px-2 py-2">{formatNumber(Number(s.shortfall))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        {requisitions.length === 0 ? (
          <EmptyState message={t("requisitions.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-start text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">{t("number")}</th>
                  <th className="px-2 py-2 font-medium">{t("requisitions.demandSource")}</th>
                  <th className="px-2 py-2 font-medium">{t("requisitions.neededBy")}</th>
                  <th className="px-2 py-2 font-medium">{t("status")}</th>
                  <th className="px-2 py-2 font-medium">{t("notes")}</th>
                  <th className="px-2 py-2 font-medium">{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-2 py-2 font-mono text-xs">
                      {r.requisitionNumber}
                      <p className="text-[var(--color-muted)]">
                        {r.requestedBy?.fullName ?? ""}
                      </p>
                    </td>
                    <td className="px-2 py-2">{r.demandSource}</td>
                    <td className="px-2 py-2">{formatDate(r.neededBy)}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2 max-w-[220px] truncate">
                      {r.notes ?? "—"}
                      {r.items.length ? (
                        <p className="text-xs text-[var(--color-muted)]">
                          {t("requisitions.lineCount", { count: r.items.length })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      {canWrite ? (
                        <div className="flex flex-wrap gap-1">
                          {r.status === "DRAFT" ? (
                            <ActionForm
                              label={t("requisitions.submit")}
                              action={submitRequisition.bind(
                                null,
                                companyId,
                                r.id,
                              )}
                            />
                          ) : null}
                          {["DRAFT", "SUBMITTED"].includes(r.status) ? (
                            <ActionForm
                              label={t("requisitions.approve")}
                              variant="primary"
                              action={approveRequisition.bind(
                                null,
                                companyId,
                                r.id,
                              )}
                            />
                          ) : null}
                        </div>
                      ) : null}
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
