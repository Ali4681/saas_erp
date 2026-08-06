"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AiReportResultView } from "@/components/erp/AiReportResultView";
import type { AiActionResult } from "@/lib/erp/ai-actions";
import { toast } from "@/lib/toast";

export function AiToolForm({
  action,
  children,
  submitLabel,
  resultVariant = "json",
}: {
  action: (formData: FormData) => Promise<AiActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  resultVariant?: "json" | "report";
}) {
  const t = useTranslations("common");
  const resolvedSubmitLabel = submitLabel ?? t("run");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AiActionResult | null>(null);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await action(fd);
            setResult(res);
            if (res.error) {
              toast.error(res.error);
            } else if (res.data != null) {
              toast.success(t("processedOk"));
            }
          });
        }}
        className="grid gap-3 md:grid-cols-2"
      >
        {children}
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("processing") : resolvedSubmitLabel}
          </Button>
        </div>
      </form>

      {result?.data != null ? (
        resultVariant === "report" ? (
          <AiReportResultView data={result.data} />
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-4">
            <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
              {t("result")}
            </p>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
              {typeof result.data === "string"
                ? result.data
                : JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )
      ) : null}
    </div>
  );
}
