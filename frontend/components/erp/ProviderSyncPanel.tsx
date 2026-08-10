"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatMoney } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  providerOpsConfig,
  type ProviderOpAction,
} from "@/lib/provider-ops";
import {
  fetchProviderSyncPanel,
  runProviderOrderOperation,
  type ProviderSyncPanelData,
} from "@/app/c/[companyId]/channels/actions";

type Row = {
  id: string;
  externalId: string;
  status: string;
  amount: string | number | null;
  currency: string | null;
  subtitle?: string;
  date?: string | null;
};

export function ProviderSyncPanel({
  companyId,
  projectId,
  categoryCode,
  projectStatus,
  providerCode,
  initialSyncStates: _initialSyncStates = [],
  initialOrders,
  initialInstallments = [],
  initialProducts = [],
  initialJobs: _initialJobs = [],
}: {
  companyId: string;
  projectId: string;
  categoryCode: string;
  projectStatus: string;
  providerCode?: string;
  initialSyncStates?: ProviderSyncPanelData["syncStates"];
  initialOrders: ProviderSyncPanelData["orders"];
  initialInstallments?: ProviderSyncPanelData["installments"];
  initialProducts?: ProviderSyncPanelData["products"];
  initialJobs?: ProviderSyncPanelData["jobs"];
}) {
  const t = useTranslations("channels");
  const locale = useLocale();
  const ops = providerOpsConfig(providerCode ?? "", locale as "ar" | "en");
  const [orders, setOrders] = useState(initialOrders);
  const [installments, setInstallments] = useState(initialInstallments);
  const [products, setProducts] = useState(initialProducts);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows: Row[] =
    ops.primaryEntity === "installments"
      ? installments.map((i) => ({
          id: i.id,
          externalId: i.externalId,
          status: i.status,
          amount: i.amount,
          currency: i.currency,
          subtitle: i.merchantOrderReference,
          date: i.lastSyncedAt,
        }))
      : ops.primaryEntity === "products"
        ? products.map((p) => ({
            id: p.id,
            externalId: p.externalId,
            status: p.status,
            amount: p.price,
            currency: p.currency,
            subtitle: p.name,
            date: null,
          }))
        : orders.map((o) => ({
            id: o.id,
            externalId: o.externalId,
            status: o.status,
            amount: o.totalAmount,
            currency: o.currency,
            subtitle: o.customer?.displayName ?? undefined,
            date: o.placedAt,
          }));

  function applyData(data: ProviderSyncPanelData) {
    setOrders(data.orders);
    setInstallments(data.installments);
    setProducts(data.products);
  }

  function onRefresh() {
    startTransition(async () => {
      try {
        const data = await fetchProviderSyncPanel({
          companyId,
          projectId,
          categoryCode,
          projectStatus,
          triggerSync: projectStatus === "ACTIVE",
        });
        applyData(data);
        toast.success(
          projectStatus === "ACTIVE"
            ? t("toastSyncRefreshed")
            : t("toastDataRefreshed"),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("toastSyncFailed"),
        );
      }
    });
  }

  function runOp(row: Row, action: ProviderOpAction) {
    setBusyId(row.externalId);
    startTransition(async () => {
      try {
        const result = await runProviderOrderOperation({
          companyId,
          projectId,
          capabilityCode: action.capabilityCode,
          orderExternalId: row.externalId,
          status: action.status,
          reason:
            action.capabilityCode.includes("CANCEL")
              ? "ITEM_UNAVAILABLE"
              : undefined,
          amount: action.includeAmount ? row.amount : undefined,
        });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(t("toastActionSent", { label: action.label }));
        await new Promise((r) => setTimeout(r, 1500));
        const data = await fetchProviderSyncPanel({
          companyId,
          projectId,
          categoryCode,
          projectStatus,
          triggerSync: false,
        });
        applyData(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("toastActionFailed"),
        );
      } finally {
        setBusyId(null);
      }
    });
  }

  const showActions = ops.actions.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            {ops.entityTitle}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title={t("refreshSync")}
            aria-label={t("refreshSync")}
            disabled={pending}
            onClick={onRefresh}
            className="h-8 w-8 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <RefreshCw
              className={`h-4 w-4 ${pending ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
        {projectStatus !== "ACTIVE" ? (
          <p className="mb-3 text-sm text-amber-800">{t("syncAfterActivate")}</p>
        ) : null}
        {ops.actionsHint ? (
          <p className="mb-3 text-xs text-[var(--muted-foreground)]">
            {ops.actionsHint}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState message={ops.emptyEntityMessage} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-start text-[var(--muted-foreground)]">
                  <th className="px-2 py-2 font-medium">{t("colId")}</th>
                  <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                  <th className="px-2 py-2 font-medium">{t("colAmount")}</th>
                  <th className="px-2 py-2 font-medium">{t("colDate")}</th>
                  {showActions ? (
                    <th className="px-2 py-2 font-medium">{t("colAction")}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="px-2 py-2">
                      <p className="font-mono text-xs">{row.externalId}</p>
                      {row.subtitle ? (
                        <p className="text-[var(--muted-foreground)]">
                          {row.subtitle}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-2 py-2">
                      {formatMoney(row.amount, row.currency ?? "SAR", locale)}
                    </td>
                    <td className="px-2 py-2">
                      {row.date ? formatDate(row.date, locale) : "—"}
                    </td>
                    {showActions ? (
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {ops.actions.map((action) => (
                            <Button
                              key={`${action.capabilityCode}-${action.status ?? action.label}`}
                              type="button"
                              size="sm"
                              variant={action.variant ?? "secondary"}
                              disabled={
                                pending || busyId === row.externalId
                              }
                              onClick={() => runOp(row, action)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </td>
                    ) : null}
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
