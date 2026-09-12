"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function DocActionMenu({
  label,
  title,
  icon,
  variant = "outline",
  align = "end",
  children,
  className,
}: {
  label: string;
  title?: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  align?: "start" | "end";
  children: ReactNode;
  className?: string;
}) {
  const tCommon = useTranslations("common");
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 240;
    const left =
      align === "end"
        ? Math.min(window.innerWidth - width - 8, Math.max(8, rect.right - width))
        : Math.min(window.innerWidth - width - 8, Math.max(8, rect.left));
    setPos({
      top: Math.min(window.innerHeight - 16, rect.bottom + 6),
      left,
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, align]);

  const panel =
    open && mounted && pos
      ? createPortal(
          <div className="fixed inset-0 z-[350]" role="presentation">
            <button
              type="button"
              aria-label={tCommon("close")}
              className="absolute inset-0 cursor-default bg-transparent"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="menu"
              aria-labelledby={titleId}
              className="absolute w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl"
              style={{ top: pos.top, left: pos.left }}
              onClick={() => setOpen(false)}
              onKeyDown={() => undefined}
            >
              {title ? (
                <p
                  id={titleId}
                  className="px-2.5 py-1.5 text-xs font-medium text-[var(--muted-foreground)]"
                >
                  {title}
                </p>
              ) : null}
              <div className="grid gap-0.5" role="none">
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          buttonVariants({ variant, size: "sm" }),
          "gap-1.5",
          className,
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        suppressHydrationWarning
      >
        {icon}
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {panel}
    </>
  );
}

export function DocMenuItem({
  children,
  onClick,
  disabled,
  danger,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition hover:bg-[var(--secondary)] disabled:cursor-not-allowed disabled:opacity-50",
        danger && "text-[var(--destructive)] hover:bg-[var(--destructive)]/10",
        className,
      )}
    >
      {children}
    </button>
  );
}
