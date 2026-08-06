"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBellDropdown({ companyId }: { companyId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("notifications");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(352, window.innerWidth - 24);
    const gutter = 12;
    const left = Math.min(
      Math.max(gutter, rect.right - width),
      window.innerWidth - width - gutter,
    );

    setPanelStyle({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();

    function onLayoutChange() {
      updatePanelPosition();
    }

    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, updatePanelPosition]);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/companies/${companyId}/notifications/unread-count`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { count: number };
      setUnreadCount(data.count ?? 0);
    } catch {
      // optional
    }
  }, [companyId]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/notifications?limit=15`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as NotificationItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadUnreadCount();
    const timer = window.setInterval(() => {
      void loadUnreadCount();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadUnreadCount]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
    void loadUnreadCount();
  }, [open, loadNotifications, loadUnreadCount]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markRead(notification: NotificationItem) {
    if (!notification.readAt) {
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));

      await fetch(
        `/api/companies/${companyId}/notifications/${notification.id}/read`,
        { method: "PATCH" },
      ).catch(() => {
        void loadNotifications();
        void loadUnreadCount();
      });
    }

    if (notification.actionUrl) {
      setOpen(false);
      router.push(notification.actionUrl);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/notifications/read-all`,
        { method: "PATCH" },
      );
      if (!res.ok) return;
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={t("ariaLabel")}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) updatePanelPosition();
            return next;
          });
        }}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]/80 text-[var(--foreground)] shadow-sm transition",
          "hover:-translate-y-0.5 hover:border-[var(--primary)]/35 hover:bg-[var(--accent)] hover:text-[var(--primary)]",
          open && "border-[var(--primary)]/35 bg-[var(--accent)] text-[var(--primary)]",
        )}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute end-1.5 top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold text-[var(--primary-foreground)] ring-2 ring-[var(--card)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {mounted && open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
              }}
              className={cn(
                "fixed z-[300] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[0_24px_60px_-20px_rgba(15,23,42,0.45)]",
                "animate-fade-up",
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {t("title")}
                  </p>
                  {unreadCount > 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t("unreadCount", { count: unreadCount })}
                    </p>
                  ) : null}
                </div>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    disabled={markingAll}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--accent)] disabled:opacity-50"
                  >
                    {markingAll ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    {t("markAll")}
                  </button>
                ) : null}
              </div>

              <div className="max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto bg-[var(--card)]">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--muted-foreground)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("loading")}
                  </div>
                ) : items.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
                    {t("empty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--border)]">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void markRead(item)}
                          className={cn(
                            "flex w-full flex-col gap-1 px-4 py-3 text-right transition hover:bg-[var(--accent)]/60",
                            !item.readAt && "bg-[var(--accent)]/30",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {!item.readAt ? (
                                <span className="me-2 inline-block h-2 w-2 rounded-full bg-[var(--primary)]" />
                              ) : null}
                              {item.title}
                            </p>
                            <time className="shrink-0 text-[11px] text-[var(--muted-foreground)]">
                              {formatDate(item.createdAt, locale)}
                            </time>
                          </div>
                          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                            {item.body}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
