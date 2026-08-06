"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { ProviderSyncPanel } from "@/components/erp/ProviderSyncPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  fetchHungerStationReports,
  runProviderOperation,
  type ProviderSyncPanelData,
} from "@/app/c/[companyId]/channels/actions";
import { toast } from "@/lib/toast";

type TabId = "orders" | "reports" | "catalog" | "store";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function moneySar(value: unknown): string {
  const n = num(value);
  return `${n.toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
}

function formatDurationSeconds(value: unknown): string {
  const s = Math.max(0, Math.floor(num(value)));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}ي ${hours}س`;
  if (hours > 0) return `${hours}س ${mins}د`;
  if (mins > 0) return `${mins}د`;
  return `${s}ث`;
}

function formatMetricValue(
  value: unknown,
  dataType?: unknown,
): string {
  const type = String(dataType ?? "").toUpperCase();
  if (type === "DURATION") return formatDurationSeconds(value);
  if (type === "FLOAT") {
    const n = num(value);
    return `${(n <= 1 && n > 0 ? n * 100 : n).toLocaleString("ar-SA", {
      maximumFractionDigits: 1,
    })}%`;
  }
  return num(value).toLocaleString("ar-SA");
}

function ReportError({ message }: { message: string }) {
  return (
    <p className="text-sm text-[var(--destructive)]">{message}</p>
  );
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2"
        >
          <p className="text-xs text-[var(--muted-foreground)]">{item.label}</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function productName(row: Record<string, unknown>): string {
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  const names = asArray(row.names);
  for (const entry of names) {
    const n = asRecord(entry);
    if (n.locale === "ar-SA" || n.locale === "ar") {
      return String(n.value ?? n.name ?? "Product");
    }
  }
  return String(row.title ?? row.id ?? "Product");
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function HungerStationHub({
  companyId,
  projectId,
  categoryCode,
  projectStatus,
  providerCode,
  activeTab = "orders",
  initialSyncStates,
  initialOrders,
  initialInstallments = [],
  initialProducts = [],
  initialJobs,
}: {
  companyId: string;
  projectId: string;
  categoryCode: string;
  projectStatus: string;
  providerCode: string;
  activeTab?: TabId;
  initialSyncStates: ProviderSyncPanelData["syncStates"];
  initialOrders: ProviderSyncPanelData["orders"];
  initialInstallments?: ProviderSyncPanelData["installments"];
  initialProducts?: ProviderSyncPanelData["products"];
  initialJobs: ProviderSyncPanelData["jobs"];
}) {
  const t = useTranslations("channels.hungerstation");
  const tab = activeTab;
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [insights, setInsights] = useState<Record<string, unknown> | null>(
    null,
  );
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [liveOrders, setLiveOrders] = useState<Record<string, unknown>[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [menuProducts, setMenuProducts] = useState<Record<string, unknown>[]>(
    [],
  );
  const [menuCategories, setMenuCategories] = useState<
    Record<string, unknown>[]
  >([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newProductNameAr, setNewProductNameAr] = useState("");
  const [newProductNameEn, setNewProductNameEn] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newCategoryNameAr, setNewCategoryNameAr] = useState("");
  const [newCategoryNameEn, setNewCategoryNameEn] = useState("");
  const [imageProductId, setImageProductId] = useState("");

  const [openingTimes, setOpeningTimes] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [openingTimesJson, setOpeningTimesJson] = useState("");
  const [storeError, setStoreError] = useState<string | null>(null);

  const catalogOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const cat of menuCategories) {
      const id = String(cat.catalogId ?? "");
      if (id) ids.add(id);
    }
    return [...ids];
  }, [menuCategories]);

  const categoryOptions = useMemo(() => {
    return menuCategories.filter((c) => {
      if (!selectedCatalogId) return true;
      return String(c.catalogId ?? "") === selectedCatalogId;
    });
  }, [menuCategories, selectedCatalogId]);

  function runOp(
    key: string,
    work: () => Promise<void>,
  ) {
    setBusyKey(key);
    startTransition(async () => {
      try {
        await work();
      } finally {
        setBusyKey(null);
      }
    });
  }

  function loadOrders() {
    runOp("orders-load", async () => {
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "ORDER_READ",
        payload: { kind: "list", pageSize: 50, daysBack: 14 },
      });
      if (!result.ok) {
        setOrdersError(result.error);
        toast.error(result.error);
        return;
      }
      const raw = asRecord(result.rawResponse);
      const orders = asArray(raw.orders).map((row) => asRecord(row));
      setLiveOrders(orders);
      setOrdersError(null);
      toast.success(t("ordersLoaded", { count: orders.length }));
    });
  }

  function loadReports() {
    runOp("reports", async () => {
      const result = await fetchHungerStationReports({
        companyId,
        projectId,
        daysBack: 7,
      });
      if (!result.ok) {
        setReportsError(result.error);
        toast.error(result.error);
        return;
      }
      setReportsError(null);
      setInsights(result.insights);
      toast.success(t("reportsLoaded"));
    });
  }

  function loadCatalog() {
    runOp("catalog-load", async () => {
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "PRODUCT_READ",
        payload: { kind: "menu" },
      });
      if (!result.ok) {
        setCatalogError(result.error);
        toast.error(result.error);
        return;
      }
      const raw = asRecord(result.rawResponse);
      const products = asArray(raw.products).map((row) => asRecord(row));
      const categories = asArray(raw.categories).map((row) => asRecord(row));
      setMenuProducts(products);
      setMenuCategories(categories);
      setCatalogError(null);
      if (!selectedCatalogId && categories[0]) {
        setSelectedCatalogId(String(categories[0].catalogId ?? ""));
      }
      if (!selectedCategoryId && categories[0]) {
        setSelectedCategoryId(
          String(categories[0].externalId ?? categories[0].id ?? ""),
        );
      }
      toast.success(t("catalogLoaded"));
    });
  }

  function loadStore() {
    runOp("store-load", async () => {
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "LOCATION_READ",
        payload: { kind: "opening_times" },
      });
      if (!result.ok) {
        setStoreError(result.error);
        toast.error(result.error);
        return;
      }
      const raw = asRecord(result.rawResponse);
      setOpeningTimes(raw);
      setOpeningTimesJson(JSON.stringify(raw, null, 2));
      setStoreError(null);
      toast.success(t("storeLoaded"));
    });
  }

  function setStoreAvailability(open: boolean) {
    runOp(open ? "store-open" : "store-close", async () => {
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "LOCATION_STATUS_UPDATE",
        payload: { kind: "availability", availability: open ? "OPEN" : "CLOSED" },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(open ? t("storeOpened") : t("storeClosed"));
    });
  }

  function saveOpeningTimes() {
    runOp("store-save-hours", async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(openingTimesJson);
      } catch {
        toast.error(t("invalidJson"));
        return;
      }
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "LOCATION_UPDATE",
        payload: {
          kind: "update_opening_times",
          openingTimes: parsed,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpeningTimes(asRecord(result.rawResponse ?? parsed));
      toast.success(t("openingTimesSaved"));
    });
  }

  function createProduct() {
    runOp("product-create", async () => {
      if (
        !selectedCatalogId ||
        !selectedCategoryId ||
        !newProductNameAr.trim() ||
        !newProductNameEn.trim()
      ) {
        toast.error(t("productFormRequired"));
        return;
      }
      if (!/[a-zA-Z]/.test(newProductNameEn)) {
        toast.error(t("productNameEnRequired"));
        return;
      }
      const price = Number(newProductPrice);
      if (!Number.isFinite(price) || price <= 0) {
        toast.error(t("productPriceRequired"));
        return;
      }
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "PRODUCT_CREATE",
        payload: {
          kind: "create",
          product: {
            catalogId: selectedCatalogId,
            categoryId: selectedCategoryId,
            nameAr: newProductNameAr.trim(),
            nameEn: newProductNameEn.trim(),
            descriptionAr: "وصف المنتج",
            descriptionEn: "Product description",
            names: [
              { locale: "ar-SA", value: newProductNameAr.trim() },
              { locale: "en-SA", value: newProductNameEn.trim() },
            ],
            descriptions: [
              { locale: "ar-SA", value: "وصف المنتج" },
              { locale: "en-SA", value: "Product description" },
            ],
            unitPrice: price,
          },
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewProductNameAr("");
      setNewProductNameEn("");
      setNewProductPrice("");
      toast.success(t("productCreated"));
      loadCatalog();
    });
  }

  function createCategory() {
    runOp("category-create", async () => {
      if (!selectedCatalogId || !newCategoryNameAr.trim()) {
        toast.error(t("categoryFormRequired"));
        return;
      }
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "CATEGORY_WRITE",
        payload: {
          kind: "create",
          catalogId: selectedCatalogId,
          category: {
            names: [
              { locale: "ar-SA", value: newCategoryNameAr.trim() },
              {
                locale: "en-SA",
                value: (() => {
                  const en = (newCategoryNameEn || "").trim();
                  if (en && /[a-zA-Z]/.test(en)) return en;
                  return "Category";
                })(),
              },
            ],
          },
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setNewCategoryNameAr("");
      setNewCategoryNameEn("");
      toast.success(t("categoryCreated"));
      loadCatalog();
    });
  }

  function setProductAvailable(productId: string, available: boolean) {
    runOp(`avail-${productId}`, async () => {
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "PRODUCT_UPDATE",
        externalTargetId: productId,
        payload: { kind: "availability", available },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(available ? t("productEnabled") : t("productDisabled"));
      loadCatalog();
    });
  }

  function deleteProduct(productId: string) {
    runOp(`del-${productId}`, async () => {
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "PRODUCT_UPDATE",
        externalTargetId: productId,
        payload: { kind: "delete" },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("productDeleted"));
      loadCatalog();
    });
  }

  function uploadImage(file: File | null) {
    if (!file) return;
    runOp("upload-image", async () => {
      const fileBase64 = await fileToBase64(file);
      const result = await runProviderOperation({
        companyId,
        projectId,
        capabilityCode: "PRODUCT_UPDATE",
        externalTargetId: imageProductId.trim() || undefined,
        payload: {
          kind: "upload_image",
          fileBase64,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("imageUploaded"));
    });
  }

  const insightRec = asRecord(insights);
  const performance = asRecord(insightRec.performance);
  const sales = asRecord(insightRec.sales);
  const opsHealth = asRecord(insightRec.opsHealth);
  const todayIssues = asRecord(insightRec.todayIssues);
  const reviewsRoot = asRecord(insightRec.reviews);

  const performanceError =
    typeof performance.error === "string" ? performance.error : null;
  const salesError = typeof sales.error === "string" ? sales.error : null;
  const opsError = typeof opsHealth.error === "string" ? opsHealth.error : null;
  const issuesError =
    typeof todayIssues.error === "string" ? todayIssues.error : null;
  const reviewsError =
    typeof reviewsRoot.error === "string" ? reviewsRoot.error : null;

  const salesOrders = num(sales.order_count ?? sales.total_orders);
  const salesRevenue = sales.revenue ?? sales.total_revenue ?? 0;
  const perfRows = asArray(performance.data ?? performance.details ?? performance.rows);
  const perfOrders =
    num(performance.total_orders ?? performance.order_count ?? performance.orderCount) ||
    perfRows.reduce(
      (sum, row) =>
        sum + num(asRecord(row).orderCount ?? asRecord(row).order_count),
      0,
    );
  const perfRevenue =
    num(performance.total_revenue ?? performance.revenue ?? performance.totalRevenue) ||
    perfRows.reduce(
      (sum, row) =>
        sum + num(asRecord(row).revenue ?? asRecord(row).total_revenue),
      0,
    );
  const perfCancelled = num(
    performance.cancelled_orders ?? performance.cancelledOrderCount,
  );

  const prep = asRecord(opsHealth.avgPreparationTime);
  const delay = asRecord(opsHealth.delayRate);
  const rejections = asRecord(opsHealth.rejections);
  const offline = asRecord(opsHealth.offlineDuration);
  const scheduled = asRecord(opsHealth.scheduledDuration);
  const issues = asRecord(todayIssues.issues);

  const reviewsBlock = asRecord(reviewsRoot.reviews);
  const ratingsBlock = asRecord(reviewsRoot.ratings);
  const avgRating = num(
    asRecord(asArray(ratingsBlock.avgRatings)[0]).avgRating,
  );
  const reviewRows = asArray(reviewsBlock.reviews).map((row) => asRecord(row));

  return (
    <div className="space-y-4">
      {tab === "orders" ? (
        <div className="space-y-4">
          <Card title={t("ordersTitle")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("ordersHint")}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={loadOrders}
              >
                <RefreshCw
                  className={`size-3.5 ${busyKey === "orders-load" ? "animate-spin" : ""}`}
                />
                {t("refreshOrders")}
              </Button>
            </div>
            {ordersError ? <EmptyState message={ordersError} /> : null}
            {!ordersError && liveOrders.length === 0 ? (
              <EmptyState message={t("ordersEmpty")} />
            ) : null}
            {liveOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-start text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                      <th className="px-2 py-2 font-medium">{t("colOrderId")}</th>
                      <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                      <th className="px-2 py-2 font-medium">{t("colAmount")}</th>
                      <th className="px-2 py-2 font-medium">{t("colPlacedAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveOrders.map((order) => {
                      const id = String(order.externalId ?? order.orderId ?? "");
                      return (
                        <tr
                          key={id}
                          className="border-b border-[var(--border)]/70"
                        >
                          <td className="px-2 py-2 font-mono text-xs">{id}</td>
                          <td className="px-2 py-2">
                            {String(order.status ?? order.orderStatus ?? "—")}
                          </td>
                          <td className="px-2 py-2">
                            {String(
                              order.totalAmount ?? order.subtotal ?? "—",
                            )}{" "}
                            {String(order.currency ?? "SAR")}
                          </td>
                          <td className="px-2 py-2 text-xs text-[var(--muted-foreground)]">
                            {String(
                              order.placedAt ?? order.placedTimestamp ?? "—",
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          <ProviderSyncPanel
            companyId={companyId}
            projectId={projectId}
            categoryCode={categoryCode}
            projectStatus={projectStatus}
            providerCode={providerCode}
            initialSyncStates={initialSyncStates}
            initialOrders={initialOrders}
            initialInstallments={initialInstallments}
            initialProducts={initialProducts}
            initialJobs={initialJobs}
          />
        </div>
      ) : null}

      {tab === "reports" ? (
        <div className="space-y-4">
          <Card title={t("reportsTitle")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("reportsHint")}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={loadReports}
              >
                <RefreshCw
                  className={`size-3.5 ${busyKey === "reports" ? "animate-spin" : ""}`}
                />
                {t("refreshReports")}
              </Button>
            </div>
            {reportsError ? (
              <EmptyState message={reportsError} />
            ) : !insights ? (
              <EmptyState message={t("reportsEmpty")} />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard title={t("performance")}>
                  {performanceError ? (
                    <ReportError message={performanceError} />
                  ) : perfOrders <= 0 && perfRevenue <= 0 && perfRows.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {t("noDataPeriod")}
                    </p>
                  ) : (
                    <MetricGrid
                      items={[
                        {
                          label: t("metricOrders"),
                          value: perfOrders.toLocaleString("ar-SA"),
                        },
                        {
                          label: t("metricRevenue"),
                          value: moneySar(perfRevenue),
                        },
                        {
                          label: t("metricCancelled"),
                          value: perfCancelled.toLocaleString("ar-SA"),
                        },
                      ]}
                    />
                  )}
                </SectionCard>

                <SectionCard title={t("sales")}>
                  {salesError ? (
                    <ReportError message={salesError} />
                  ) : (
                    <MetricGrid
                      items={[
                        {
                          label: t("metricOrders"),
                          value: salesOrders.toLocaleString("ar-SA"),
                        },
                        {
                          label: t("metricRevenue"),
                          value: moneySar(salesRevenue),
                        },
                      ]}
                    />
                  )}
                </SectionCard>

                <SectionCard title={t("opsHealth")}>
                  {opsError ? (
                    <ReportError message={opsError} />
                  ) : (
                    <MetricGrid
                      items={[
                        {
                          label: t("metricPrepTime"),
                          value: formatMetricValue(
                            prep.current,
                            prep.dataType,
                          ),
                          hint: `${t("previousPeriod")}: ${formatMetricValue(prep.previous, prep.dataType)}`,
                        },
                        {
                          label: t("metricDelayRate"),
                          value: formatMetricValue(
                            delay.current,
                            delay.dataType,
                          ),
                          hint: `${t("previousPeriod")}: ${formatMetricValue(delay.previous, delay.dataType)}`,
                        },
                        {
                          label: t("metricRejections"),
                          value: formatMetricValue(
                            rejections.current,
                            rejections.dataType,
                          ),
                          hint: `${t("previousPeriod")}: ${formatMetricValue(rejections.previous, rejections.dataType)}`,
                        },
                        {
                          label: t("metricOffline"),
                          value: formatMetricValue(
                            offline.current,
                            offline.dataType,
                          ),
                          hint: `${t("previousPeriod")}: ${formatMetricValue(offline.previous, offline.dataType)}`,
                        },
                        {
                          label: t("metricScheduled"),
                          value: formatMetricValue(
                            scheduled.current,
                            scheduled.dataType,
                          ),
                          hint: `${t("previousPeriod")}: ${formatMetricValue(scheduled.previous, scheduled.dataType)}`,
                        },
                      ]}
                    />
                  )}
                </SectionCard>

                <SectionCard title={t("todayIssues")}>
                  {issuesError ? (
                    <ReportError message={issuesError} />
                  ) : (
                    <MetricGrid
                      items={[
                        {
                          label: t("metricCancelledToday"),
                          value: num(todayIssues.cancelled_orders).toLocaleString(
                            "ar-SA",
                          ),
                        },
                        {
                          label: t("metricDelayedToday"),
                          value: num(todayIssues.delayed_orders).toLocaleString(
                            "ar-SA",
                          ),
                        },
                        {
                          label: t("metricOfflineVendors"),
                          value: num(issues.offlineVendorsCount).toLocaleString(
                            "ar-SA",
                          ),
                        },
                        {
                          label: t("metricOneStar"),
                          value: num(issues.oneStarRatingsCount).toLocaleString(
                            "ar-SA",
                          ),
                        },
                      ]}
                    />
                  )}
                </SectionCard>

                <SectionCard title={t("reviews")}>
                  {reviewsError ? (
                    <ReportError message={reviewsError} />
                  ) : (
                    <div className="space-y-3">
                      <MetricGrid
                        items={[
                          {
                            label: t("metricAvgRating"),
                            value:
                              avgRating > 0
                                ? avgRating.toLocaleString("ar-SA", {
                                    maximumFractionDigits: 2,
                                  })
                                : "—",
                          },
                        ]}
                      />
                      {reviewRows.length === 0 ? (
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {t("noReviews")}
                        </p>
                      ) : (
                        <ul className="max-h-56 space-y-2 overflow-auto">
                          {reviewRows.slice(0, 12).map((row, idx) => (
                            <li
                              key={String(row.id ?? idx)}
                              className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
                                <span>
                                  {num(row.rating).toLocaleString("ar-SA")} / 5
                                </span>
                                <span>{String(row.date ?? "—")}</span>
                              </div>
                              {row.text ? (
                                <p className="mt-1 leading-relaxed">
                                  {String(row.text)}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "catalog" ? (
        <div className="space-y-4">
          <Card title={t("catalogTitle")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("catalogHint")}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={loadCatalog}
              >
                <RefreshCw
                  className={`size-3.5 ${busyKey === "catalog-load" ? "animate-spin" : ""}`}
                />
                {t("refreshCatalog")}
              </Button>
            </div>
            {catalogError ? <EmptyState message={catalogError} /> : null}
            {!catalogError && menuProducts.length === 0 && menuCategories.length === 0 ? (
              <EmptyState message={t("catalogEmpty")} />
            ) : null}

            {menuProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-start text-sm">
                  <thead className="text-[var(--muted-foreground)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-2 py-2 font-medium">{t("colProduct")}</th>
                      <th className="px-2 py-2 font-medium">{t("colCategory")}</th>
                      <th className="px-2 py-2 font-medium">{t("colPrice")}</th>
                      <th className="px-2 py-2 font-medium">{t("colStatus")}</th>
                      <th className="px-2 py-2 font-medium">{t("colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuProducts.slice(0, 80).map((p) => {
                      const id = String(p.id ?? p.externalId ?? "");
                      const available = !(
                        p.active === false ||
                        p.available === false
                      );
                      return (
                        <tr
                          key={id || productName(p)}
                          className="border-b border-[var(--border)]/70"
                        >
                          <td className="px-2 py-2">
                            <div className="font-medium">{productName(p)}</div>
                            <div className="font-mono text-xs text-[var(--muted-foreground)]">
                              {id}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-[var(--muted-foreground)]">
                            {String(p.categoryName ?? p.catalogCategoryId ?? "—")}
                          </td>
                          <td className="px-2 py-2">
                            {String(p.unitPrice ?? p.price ?? "—")}
                          </td>
                          <td className="px-2 py-2">
                            {available ? t("available") : t("unavailable")}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={pending || !id}
                                onClick={() =>
                                  setProductAvailable(id, !available)
                                }
                              >
                                {available ? t("disable") : t("enable")}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={pending || !id}
                                onClick={() => deleteProduct(id)}
                              >
                                {t("delete")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t("createProduct")}>
              <div className="grid gap-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("catalogId")}</span>
                  <select
                    className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3"
                    value={selectedCatalogId}
                    onChange={(e) => setSelectedCatalogId(e.target.value)}
                  >
                    <option value="">{t("selectCatalog")}</option>
                    {catalogOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">{t("categoryId")}</span>
                  <select
                    className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                  >
                    <option value="">{t("selectCategory")}</option>
                    {categoryOptions.map((c) => {
                      const id = String(c.externalId ?? c.id ?? "");
                      return (
                        <option key={id} value={id}>
                          {String(c.name ?? id)}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <Input
                  label={t("productNameAr")}
                  value={newProductNameAr}
                  onChange={(e) => setNewProductNameAr(e.target.value)}
                />
                <Input
                  label={t("productNameEn")}
                  value={newProductNameEn}
                  onChange={(e) => setNewProductNameEn(e.target.value)}
                />
                <Input
                  label={t("productPrice")}
                  type="number"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={createProduct}
                >
                  {t("createProduct")}
                </Button>
              </div>
            </Card>

            <Card title={t("createCategory")}>
              <div className="grid gap-3">
                <Input
                  label={t("categoryNameAr")}
                  value={newCategoryNameAr}
                  onChange={(e) => setNewCategoryNameAr(e.target.value)}
                />
                <Input
                  label={t("categoryNameEn")}
                  value={newCategoryNameEn}
                  onChange={(e) => setNewCategoryNameEn(e.target.value)}
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={createCategory}
                >
                  {t("createCategory")}
                </Button>
              </div>
            </Card>

            <Card title={t("uploadImageTitle")}>
              <div className="grid gap-3">
                <Input
                  label={t("imageProductId")}
                  value={imageProductId}
                  onChange={(e) => setImageProductId(e.target.value)}
                  placeholder={t("imageProductIdHint")}
                />
                <Input
                  label={t("imageFile")}
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    uploadImage(e.target.files?.[0] ?? null)
                  }
                />
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "store" ? (
        <div className="space-y-4">
          <Card title={t("storeTitle")}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t("storeHint")}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={loadStore}
              >
                <RefreshCw
                  className={`size-3.5 ${busyKey === "store-load" ? "animate-spin" : ""}`}
                />
                {t("refreshStore")}
              </Button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() => setStoreAvailability(true)}
              >
                {t("openStore")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setStoreAvailability(false)}
              >
                {t("closeStore")}
              </Button>
            </div>
            {storeError ? <EmptyState message={storeError} /> : null}
            {!storeError && !openingTimes ? (
              <EmptyState message={t("storeEmpty")} />
            ) : null}
            {openingTimes ? (
              <div className="grid gap-3">
                <Textarea
                  label={t("openingTimesJson")}
                  value={openingTimesJson}
                  onChange={(e) => setOpeningTimesJson(e.target.value)}
                  className="min-h-48 font-mono text-xs"
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={saveOpeningTimes}
                >
                  {t("saveOpeningTimes")}
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
