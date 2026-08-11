"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { aiAssistantAskQuestion } from "@/lib/erp/ai-actions";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function AiChatWidget({ companyId }: { companyId: string }) {
  const t = useTranslations("ai");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0) {
        return [
          { id: "welcome", role: "assistant", text: t("chatWelcome") },
        ];
      }
      if (prev.length === 1 && prev[0]?.id === "welcome") {
        return [
          { id: "welcome", role: "assistant", text: t("chatWelcome") },
        ];
      }
      return prev;
    });
  }, [t]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    inputRef.current?.focus();
  }, [open, messages, pending]);

  function extractAnswer(data: unknown): string {
    if (data == null) return t("chatNoAnswer");
    if (typeof data === "string") return data;
    if (typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (typeof obj.answer === "string" && obj.answer.trim()) {
        const parts = [obj.answer.trim()];
        if (Array.isArray(obj.highlights) && obj.highlights.length) {
          const lines = obj.highlights
            .filter((h): h is string => typeof h === "string" && h.trim().length > 0)
            .map((h) => `• ${h}`);
          if (lines.length) parts.push("", t("chatHighlights"), ...lines);
        }
        return parts.join("\n");
      }
    }
    return JSON.stringify(data, null, 2);
  }

  function send() {
    const question = input.trim();
    if (!question || pending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    startTransition(async () => {
      const res = await aiAssistantAskQuestion(companyId, question);
      const text = res.error ? res.error : extractAnswer(res.data);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text,
        },
      ]);
    });
  }

  return (
    <div className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] end-[max(1.25rem,env(safe-area-inset-right))] z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="pointer-events-auto flex h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_50px_rgba(15,23,32,0.18)]"
          role="dialog"
          aria-label={t("chatTitle")}
        >
          <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--primary)] px-4 py-3 text-[var(--primary-foreground)]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t("chatTitle")}</p>
              <p className="truncate text-[11px] opacity-80">
                {t("chatSubtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/15"
              aria-label={tCommon("close")}
            >
              <CloseIcon />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[var(--muted)]/35 px-3 py-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-start" : "justify-end",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "rounded-br-md bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "rounded-bl-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
                  {t("chatThinking")}
                </div>
              </div>
            ) : null}
          </div>

          <form
            className="border-t border-[var(--border)] bg-[var(--card)] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={t("chatPlaceholder")}
                disabled={pending}
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-sm outline-none focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/25 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:brightness-110 disabled:opacity-50"
                aria-label={t("chatSend")}
              >
                <SendIcon />
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_12px_28px_var(--brand-glow)] transition hover:scale-105 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
          open && "ring-2 ring-[var(--ring)] ring-offset-2",
        )}
        aria-label={open ? t("chatClose") : t("chatOpen")}
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <BotIcon />}
      </button>
    </div>
  );
}

function BotIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
      <path
        d="M12 3v2.5M8.5 10h7M9.5 14h.01M14.5 14h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="7.5"
        width="14"
        height="11"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9 18.5v1.2a1.3 1.3 0 0 0 1.3 1.3h3.4a1.3 1.3 0 0 0 1.3-1.3v-1.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M5 12h12M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
