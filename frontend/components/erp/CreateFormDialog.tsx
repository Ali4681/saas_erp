"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "outline" | "ghost";
  showPlus?: boolean;
  children: ReactNode;
  className?: string;
};

export function CreateFormDialog({
  title,
  description,
  triggerLabel,
  triggerVariant = "primary",
  showPlus = true,
  children,
  className,
}: Props) {
  const t = useTranslations("common");
  const resolvedTrigger = triggerLabel ?? t("add");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
            role="presentation"
          >
            <button
              type="button"
              aria-label={t("close")}
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              className={cn(
                "relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-2xl",
                "max-h-[min(92vh,880px)]",
              )}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                <div className="space-y-1">
                  <h2
                    id={titleId}
                    className="text-lg font-semibold tracking-tight"
                  >
                    {title}
                  </h2>
                  {description ? (
                    <p
                      id={descId}
                      className="text-sm text-[var(--muted-foreground)]"
                    >
                      {description}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("close")}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        onClick={() => setOpen(true)}
        className={className}
      >
        {showPlus ? <Plus className="h-4 w-4" /> : null}
        {resolvedTrigger}
      </Button>
      {dialog}
    </>
  );
}
