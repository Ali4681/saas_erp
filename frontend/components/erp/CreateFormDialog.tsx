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
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { lockPageScroll } from "@/lib/lock-page-scroll";

type Props = {
  title: string;
  description?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary" | "outline" | "ghost";
  showPlus?: boolean;
  children: ReactNode;
  className?: string;
  closeOnSuccess?: boolean;
  /** Controlled open state — when set, hideTrigger is typically true. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

/**
 * Modal for create forms. Overlay is portaled to `document.body` so it paints
 * above the sidebar (sibling stacking context). Middleware must not rewrite
 * POST/Server Action request headers, or form actions break under Turbopack.
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
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: Props) {
  const t = useTranslations("common");
  const resolvedTrigger = triggerLabel ?? t("add");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
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
    const unlock = lockPageScroll();
    document.addEventListener("keydown", onKey);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const body = closeOnSuccess && isValidElement(children)
    ? cloneElement(children as ReactElement<{ onSuccess?: () => void }>, {
        onSuccess: () => setOpen(false),
      })
    : children;

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center overflow-hidden p-4 sm:p-6"
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
                "relative z-10 flex w-full min-w-0 max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-2xl",
                "max-h-[min(92dvh,calc(100dvh-2rem))]",
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
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-4">
                {body}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          variant={triggerVariant}
          onClick={() => setOpen(true)}
        >
          {showPlus ? <Plus className="h-4 w-4" /> : null}
          {resolvedTrigger}
        </Button>
      )}
      {dialog}
    </>
  );
}
