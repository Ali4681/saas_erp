import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,32,0.08)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[var(--primary)] via-[var(--chart-2)] to-transparent opacity-80" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            {label}
          </p>
          <div className="mt-2 truncate text-2xl font-semibold tracking-tight">
            {value}
          </div>
          {hint ? (
            <p
              className={cn(
                "mt-1 text-xs",
                trend === "up" &&
                  "text-[var(--primary)] dark:text-[var(--accent-foreground)]",
                trend === "down" && "text-red-700 dark:text-red-400",
                (!trend || trend === "neutral") &&
                  "text-[var(--muted-foreground)]",
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)]">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
