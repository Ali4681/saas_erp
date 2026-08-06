"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastItem,
  type ToastVariant,
} from "@/lib/toast";
import { cn } from "@/lib/utils";

const variantStyles: Record<
  ToastVariant,
  {
    ring: string;
    icon: string;
    bar: string;
    glow: string;
    accent: string;
    shimmer: string;
  }
> = {
  success: {
    ring: "border-emerald-500/30",
    icon: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_8px_24px_-6px_rgba(16,185,129,0.55)]",
    bar: "bg-gradient-to-l from-emerald-400 to-emerald-600",
    glow: "from-emerald-500/12 via-emerald-400/5",
    accent: "bg-gradient-to-b from-emerald-400 to-emerald-600",
    shimmer:
      "bg-gradient-to-r from-transparent via-emerald-400/25 to-transparent",
  },
  error: {
    ring: "border-red-500/30",
    icon: "bg-gradient-to-br from-red-400 to-red-600 text-white shadow-[0_8px_24px_-6px_rgba(239,68,68,0.55)]",
    bar: "bg-gradient-to-l from-red-400 to-red-600",
    glow: "from-red-500/12 via-red-400/5",
    accent: "bg-gradient-to-b from-red-400 to-red-600",
    shimmer: "bg-gradient-to-r from-transparent via-red-400/25 to-transparent",
  },
  warning: {
    ring: "border-amber-500/30",
    icon: "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_8px_24px_-6px_rgba(245,158,11,0.55)]",
    bar: "bg-gradient-to-l from-amber-400 to-amber-600",
    glow: "from-amber-500/12 via-amber-400/5",
    accent: "bg-gradient-to-b from-amber-400 to-amber-600",
    shimmer:
      "bg-gradient-to-r from-transparent via-amber-400/25 to-transparent",
  },
  info: {
    ring: "border-sky-500/30",
    icon: "bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-[0_8px_24px_-6px_rgba(14,165,233,0.55)]",
    bar: "bg-gradient-to-l from-sky-400 to-sky-600",
    glow: "from-sky-500/12 via-sky-400/5",
    accent: "bg-gradient-to-b from-sky-400 to-sky-600",
    shimmer: "bg-gradient-to-r from-transparent via-sky-400/25 to-transparent",
  },
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const cls = "h-4 w-4";
  if (variant === "success") return <CheckCircle2 className={cls} />;
  if (variant === "error") return <XCircle className={cls} />;
  if (variant === "warning") return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

function ToastCard({
  item,
  index,
  onDismiss,
  closeLabel,
}: {
  item: ToastItem;
  index: number;
  onDismiss: (id: string) => void;
  closeLabel: string;
}) {
  const styles = variantStyles[item.variant];
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(item.duration);
  const startedAtRef = useRef(Date.now());

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleDismiss = useCallback(
    (delay: number) => {
      clearTimer();
      startedAtRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        setExiting(true);
        window.setTimeout(() => onDismiss(item.id), 280);
      }, delay);
    },
    [clearTimer, item.id, onDismiss],
  );

  useEffect(() => {
    scheduleDismiss(item.duration);
    return clearTimer;
  }, [item.duration, scheduleDismiss, clearTimer]);

  const handleDismiss = () => {
    clearTimer();
    setExiting(true);
    window.setTimeout(() => onDismiss(item.id), 280);
  };

  const handlePause = () => {
    if (paused || exiting) return;
    setPaused(true);
    remainingRef.current -= Date.now() - startedAtRef.current;
    clearTimer();
  };

  const handleResume = () => {
    if (!paused || exiting) return;
    setPaused(false);
    scheduleDismiss(Math.max(remainingRef.current, 800));
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ animationDelay: `${index * 60}ms` }}
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      onFocus={handlePause}
      onBlur={handleResume}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-2xl border bg-[var(--card)]/95 p-4 text-[var(--card-foreground)] shadow-[0_22px_55px_-22px_rgba(15,23,42,0.42)] backdrop-blur-2xl transition-shadow hover:shadow-[0_28px_60px_-20px_rgba(15,23,42,0.48)]",
        styles.ring,
        exiting ? "toast-exit" : "toast-enter",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-3 end-0 w-1 rounded-full opacity-90",
          styles.accent,
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-l opacity-70",
          styles.glow,
          "to-transparent",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px toast-shimmer opacity-60",
          styles.shimmer,
        )}
      />
      <div className="relative flex items-start gap-3 pe-1">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/30",
            styles.icon,
          )}
        >
          <VariantIcon variant={item.variant} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-snug text-[var(--foreground)]">
            {item.title}
          </p>
          {item.description ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {item.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={closeLabel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className={cn(
            "toast-progress h-full w-full rounded-full",
            styles.bar,
            paused && "[animation-play-state:paused]",
          )}
          style={{ animationDuration: `${item.duration}ms` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    setItems(getToasts());
    const unsubscribe = subscribeToasts(() => setItems([...getToasts()]));
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      {children}
      <div
        aria-label={t("systemToasts")}
        className="pointer-events-none fixed inset-x-4 top-4 z-[200] flex flex-col items-end gap-3 sm:inset-x-auto sm:end-4 sm:top-5 sm:w-[min(100%,26rem)]"
      >
        {items.map((item, index) => (
          <ToastCard
            key={item.id}
            item={item}
            index={index}
            onDismiss={dismissToast}
            closeLabel={t("close")}
          />
        ))}
      </div>
    </>
  );
}
