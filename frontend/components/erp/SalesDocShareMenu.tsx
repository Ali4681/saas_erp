"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { DocActionMenu, DocMenuItem } from "@/components/erp/DocActionMenu";
import { buildWhatsAppUrl, formatPhoneDisplay } from "@/lib/phone";
import { fetchPdfFileFromUrl, sharePdfFile } from "@/lib/print-pdf";

export function SalesDocShareMenu({
  title,
  customerName,
  customerPhone,
  totalLine,
  pdfUrl,
}: {
  title: string;
  customerName?: string | null;
  customerPhone?: string | null;
  totalLine: string;
  pdfUrl: string;
}) {
  const t = useTranslations("sales");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasCustomerPhone = Boolean(customerPhone?.trim());
  const phoneLabel = hasCustomerPhone
    ? formatPhoneDisplay(customerPhone)
    : t("whatsappNoPhone");

  function absolutePdfUrl() {
    return new URL(pdfUrl, window.location.origin).toString();
  }

  function captionText() {
    return [
      title,
      `${t("customer")}: ${customerName ?? "—"}`,
      `${t("total")}: ${totalLine}`,
    ].join("\n");
  }

  async function loadPdfFile() {
    return fetchPdfFileFromUrl(
      absolutePdfUrl(),
      `${title.replace(/\s+/g, "-")}.pdf`,
    );
  }

  async function sharePdfToApp() {
    const file = await loadPdfFile();
    await sharePdfFile(file);
  }

  async function sendWhatsApp() {
    setMsg(null);
    if (!customerPhone?.trim()) {
      setMsg(t("whatsappNoPhone"));
      return;
    }
    const url = buildWhatsAppUrl(customerPhone, captionText());
    if (!url) {
      setMsg(t("whatsappInvalidPhone"));
      return;
    }
    setBusy(true);
    try {
      try {
        await sharePdfToApp();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMsg(error instanceof Error ? error.message : t("shareFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendTelegram() {
    setMsg(null);
    setBusy(true);
    try {
      await sharePdfToApp();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMsg(
        !navigator.share
          ? t("shareNativeUnavailable")
          : error instanceof Error
            ? error.message
            : t("shareFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function shareEmail() {
    setMsg(null);
    setBusy(true);
    try {
      try {
        await sharePdfToApp();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(captionText())}`;
        window.open(mailto, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMsg(error instanceof Error ? error.message : t("shareFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function shareWithSystem() {
    await sendTelegram();
  }

  return (
    <div className="flex flex-col gap-1">
      <DocActionMenu
        label={t("share")}
        title={t("shareChooseTitle")}
        icon={<Share2 className="h-3.5 w-3.5" />}
      >
        <DocMenuItem disabled={busy} onClick={() => void sendWhatsApp()}>
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          <span className="flex min-w-0 flex-col">
            <span>{t("shareViaWhatsApp")}</span>
            <span className="truncate text-[10px] text-[var(--muted-foreground)]">
              {t("shareToCustomerPhone", { phone: phoneLabel })}
            </span>
          </span>
        </DocMenuItem>
        <DocMenuItem disabled={busy} onClick={() => void sendTelegram()}>
          <Send className="h-4 w-4 text-sky-600" />
          {t("shareViaTelegram")}
        </DocMenuItem>
        <DocMenuItem disabled={busy} onClick={() => void shareEmail()}>
          <Mail className="h-4 w-4" />
          {t("shareViaEmail")}
        </DocMenuItem>
        <DocMenuItem disabled={busy} onClick={() => void shareWithSystem()}>
          <Share2 className="h-4 w-4" />
          {busy ? "…" : t("shareViaSystem")}
        </DocMenuItem>
      </DocActionMenu>
      {msg ? (
        <span className="max-w-[10rem] text-[10px] text-[var(--muted-foreground)]">
          {msg}
        </span>
      ) : null}
    </div>
  );
}
