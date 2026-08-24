"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
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
  closeOnSuccess?: boolean;
};

/**
 * Modal for create forms. Renders fixed overlay in-tree (no createPortal)
 * so Next.js Server Action form submissions keep working.
 */
export function CreateFormDialog({
  title,
  description,
  triggerLabel,
  triggerVariant = "primary",
  showPlus = true,
  children,
  className,
  closeOnSuccess = false,
}: Props) {
  const t = useTranslations("common");
  const resolvedTrigger = triggerLabel ?? t("add");
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descId = useId();

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

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        onClick={() => setOpen(true)}
      >
        {showPlus ? <Plus className="h-4 w-4" /> : null}
        {resolvedTrigger}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-[200] overflow-y-auto p-4 sm:p-6"
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
              "relative z-10 mx-auto my-4 flex w-full min-w-0 max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-2xl",
              "max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]",
              className,
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {closeOnSuccess && isValidElement(children)
                ? cloneElement(
                    children as ReactElement<{ onSuccess?: () => void }>,
                    { onSuccess: () => setOpen(false) },
                  )
                : children}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
