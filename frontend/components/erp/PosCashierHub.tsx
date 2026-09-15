"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Package,
  Quote,
  Zap,
} from "lucide-react";
import { PosCashierDocuments } from "@/components/erp/PosCashierDocuments";
import { PosQuickInvoice } from "@/components/erp/PosQuickInvoice";
import { PosTerminal } from "@/components/erp/PosTerminal";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  posTerminalBootstrap,
  type PosBootstrap,
} from "@/app/c/[companyId]/me/pos/actions";
import { resolvePosRoleOps } from "@/lib/pos-permissions";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type PosHubMode =
  | "invoice"
  | "quick"
  | "quote"
  | "products"
  | "documents";

export function PosCashierHub({
  companyId,
  companyName,
  companyLogoUrl,
}: {
  companyId: string;
  companyName?: string | null;
  companyLogoUrl?: string | null;
}) {
  const t = useTranslations("pos");
  const [pending, startTransition] = useTransition();
  const [boot, setBoot] = useState<PosBootstrap | null>(null);
  const [mode, setMode] = useState<PosHubMode | null>(null);
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await posTerminalBootstrap(companyId);
      if (res.error || !res.data) {
        toast.error(res.error || t("loading"));
        return;
      }
      setBoot(res.data);
    });
  }, [companyId, t]);

  function reloadBoot() {
    startTransition(async () => {
      const res = await posTerminalBootstrap(companyId);
      if (res.error || !res.data) {
        toast.error(res.error || t("loading"));
        return;
      }
      setBoot(res.data);
    });
  }

  const roleOps = resolvePosRoleOps(null, boot?.roleOps ?? null);

  if (mode === "documents") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode(null)}
          >
            <ArrowLeft className="me-1 h-4 w-4" />
            {t("hubBack")}
          </Button>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {t("hubDocuments")}
          </p>
        </div>
        <PosCashierDocuments
          companyId={companyId}
          roleOps={boot?.roleOps}
          currency={boot?.companyDefaults.currency ?? "SAR"}
          onEditQuote={(quoteId) => {
            setEditQuoteId(quoteId);
            setMode("quote");
          }}
        />
      </div>
    );
  }

  if (mode === "quick" && boot) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode(null)}
          >
            <ArrowLeft className="me-1 h-4 w-4" />
            {t("hubBack")}
          </Button>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {t("hubQuick")}
          </p>
        </div>
        <PosQuickInvoice
          companyId={companyId}
          boot={boot}
          onDone={() => {
            reloadBoot();
            setMode("documents");
          }}
        />
      </div>
    );
  }

  if (mode) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditQuoteId(null);
              setMode(null);
            }}
          >
            <ArrowLeft className="me-1 h-4 w-4" />
            {t("hubBack")}
          </Button>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {mode === "invoice"
              ? t("hubInvoice")
              : mode === "quote"
                ? t("hubQuote")
                : t("hubProducts")}
          </p>
        </div>
        <PosTerminal
          companyId={companyId}
          companyName={companyName}
          companyLogoUrl={companyLogoUrl}
          initialDocMode={mode === "quote" ? "quote" : "invoice"}
          browseOnly={mode === "products"}
          lockDocMode={mode === "invoice" || mode === "quote"}
          initialEditQuoteId={mode === "quote" ? editQuoteId : null}
        />
      </div>
    );
  }

  const tiles: Array<{
    id: PosHubMode;
    title: string;
    desc: string;
    icon: typeof FileText;
    enabled: boolean;
    onClick?: () => void;
  }> = [
    {
      id: "invoice",
      title: t("hubInvoice"),
      desc: t("hubInvoiceDesc"),
      icon: FileText,
      enabled: roleOps.invoiceCreate,
      onClick: () => {
        setEditQuoteId(null);
        setMode("invoice");
      },
    },
    {
      id: "quick",
      title: t("hubQuick"),
      desc: t("hubQuickDesc"),
      icon: Zap,
      enabled: roleOps.quickInvoice,
      onClick: () => setMode("quick"),
    },
    {
      id: "quote",
      title: t("hubQuote"),
      desc: t("hubQuoteDesc"),
      icon: Quote,
      enabled: roleOps.quoteCreate,
      onClick: () => {
        setEditQuoteId(null);
        setMode("quote");
      },
    },
    {
      id: "products",
      title: t("hubProducts"),
      desc: t("hubProductsDesc"),
      icon: Package,
      enabled: true,
      onClick: () => {
        setEditQuoteId(null);
        setMode("products");
      },
    },
    {
      id: "documents",
      title: t("hubDocuments"),
      desc: t("hubDocumentsDesc"),
      icon: ClipboardList,
      enabled: true,
      onClick: () => setMode("documents"),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title={t("hubTitle")} description={t("hubDesc")} />
      {pending && !boot ? (
        <p className="text-sm text-[var(--muted-foreground)]">{t("loading")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.id}
                type="button"
                disabled={!tile.enabled}
                onClick={tile.onClick}
                className={cn(
                  "flex min-h-[8.5rem] flex-col items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-start transition",
                  tile.enabled
                    ? "hover:border-[var(--primary)]/50 hover:shadow-sm"
                    : "cursor-not-allowed opacity-50",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-base font-semibold">{tile.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {tile.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
