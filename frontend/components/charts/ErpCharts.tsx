"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { intlLocaleTag } from "@/lib/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(15,23,32,0.08)",
};

export function ChartShell({
  children,
  className,
  height = 260,
}: {
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueAreaChart({
  data,
  className,
}: {
  data: Array<{ name: string; value: number }>;
  className?: string;
}) {
  const t = useTranslations("common");

  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
        {t("noChartData")}
      </p>
    );
  }

  return (
    <ChartShell className={className}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="value"
          name={t("chartValue")}
          stroke="var(--chart-1)"
          fill="url(#fillRevenue)"
          strokeWidth={2.5}
        />
      </AreaChart>
    </ChartShell>
  );
}

export function RankingBarChart({
  data,
  className,
  color = "var(--chart-2)",
}: {
  data: Array<{ name: string; value: number }>;
  className?: string;
  color?: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const gradientId = useId().replace(/:/g, "");
  const numberLocale = intlLocaleTag(locale);

  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
        {t("noChartData")}
      </p>
    );
  }

  const rows = data.slice(0, 5);
  const longLabels = rows.some((r) => r.name.length > 14);

  return (
    <ChartShell className={cn("pt-1", className)} height={260}>
      <BarChart
        data={rows}
        margin={{ top: 28, right: 12, left: 4, bottom: longLabels ? 16 : 4 }}
        barCategoryGap="22%"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 8"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          interval={0}
          height={longLabels ? 72 : 36}
          angle={longLabels ? -28 : 0}
          textAnchor={longLabels ? "end" : "middle"}
          tick={{
            fill: "var(--foreground)",
            fontSize: 12,
            fontWeight: 600,
          }}
        />
        <YAxis type="number" hide domain={[0, "auto"]} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.45 }}
          contentStyle={tooltipStyle}
          formatter={(value) => [
            typeof value === "number"
              ? new Intl.NumberFormat(numberLocale, {
                  maximumFractionDigits: 2,
                }).format(value)
              : String(value ?? ""),
            t("chartCount"),
          ]}
        />
        <Bar
          dataKey="value"
          name={t("chartCount")}
          fill={`url(#${gradientId})`}
          radius={[12, 12, 4, 4]}
          maxBarSize={48}
        >
          <LabelList
            dataKey="value"
            position="top"
            offset={8}
            formatter={(value) =>
              new Intl.NumberFormat(numberLocale, {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(Number(value) || 0)
            }
            style={{
              fill: "var(--foreground)",
              fontSize: 11,
              fontWeight: 700,
            }}
          />
        </Bar>
      </BarChart>
    </ChartShell>
  );
}

export function DistributionPieChart({
  data,
  className,
}: {
  data: Array<{ name: string; value: number }>;
  className?: string;
}) {
  const t = useTranslations("common");
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
        {t("noChartData")}
      </p>
    );
  }

  return (
    <ChartShell className={className} height={240}>
      <PieChart>
        <Pie
          data={filtered}
          dataKey="value"
          nameKey="name"
          innerRadius={48}
          outerRadius={72}
          paddingAngle={3}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {filtered.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          verticalAlign="bottom"
          layout="horizontal"
          align="center"
          wrapperStyle={{ paddingTop: 12, fontSize: 12, lineHeight: "20px" }}
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ChartShell>
  );
}

export function GroupedBarChart({
  data,
  keys,
  className,
}: {
  data: Array<Record<string, string | number>>;
  keys: Array<{ key: string; label: string; color?: string }>;
  className?: string;
}) {
  const t = useTranslations("common");

  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted-foreground)]">
        {t("noChartData")}
      </p>
    );
  }

  return (
    <ChartShell className={className}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
              {value}
            </span>
          )}
        />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.label}
            fill={k.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartShell>
  );
}
