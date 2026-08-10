"use client";

import dynamic from "next/dynamic";

function ChartSkeleton() {
  return (
    <div className="h-56 animate-pulse rounded-xl bg-[var(--muted)]/40" />
  );
}

export const RevenueAreaChart = dynamic(
  () =>
    import("@/components/charts/ErpCharts").then((m) => m.RevenueAreaChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const DistributionPieChart = dynamic(
  () =>
    import("@/components/charts/ErpCharts").then((m) => m.DistributionPieChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const GroupedBarChart = dynamic(
  () =>
    import("@/components/charts/ErpCharts").then((m) => m.GroupedBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
