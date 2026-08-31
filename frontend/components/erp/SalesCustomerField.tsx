"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { ContactCreateFields } from "@/components/erp/ContactCreateFields";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { lockPageScroll } from "@/lib/lock-page-scroll";
import { createContactInline } from "@/app/c/[companyId]/sales/actions";

type ContactOpt = { id: string; name: string };

/**
 * Customer select + “new contact” dialog (same fields as CRM contacts).
 * Modal is portaled to document.body so it never nests a <form> inside
 * quote/invoice forms.
 */
export function SalesCustomerField({
  companyId,
  contacts,
  label,
  name = "contactId",
  defaultValue,
  required = true,
  onChange,
}: {
  companyId: string;
  contacts: ContactOpt[];
  label: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
  onChange?: (contactId: string) => void;
}) {
  const t = useTranslations("sales");
  const tCrm = useTranslations("crm");
  const tCommon = useTranslations("common");
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [options, setOptions] = useState(contacts);
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
  }, [open]);

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[400] flex items-center justify-center p-4"
            role="presentation"
          >
            <button
              type="button"
              aria-label={tCommon("close")}
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-10 flex max-h-[min(92dvh,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                <h3 id={titleId} className="text-lg font-semibold">
                  {tCrm("contacts.newTitle")}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={tCommon("close")}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <form
                  className="grid gap-3 md:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    setError(null);
                    startTransition(async () => {
                      const result = await createContactInline(companyId, fd);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      setOptions((prev) => {
                        if (prev.some((c) => c.id === result.contact.id)) {
                          return prev;
                        }
                        return [...prev, result.contact].sort((a, b) =>
                          a.name.localeCompare(b.name),
                        );
                      });
                      setSelected(result.contact.id);
                      onChange?.(result.contact.id);
                      setOpen(false);
                      form.reset();
                    });
                  }}
                >
                  <ContactCreateFields />
                  {error ? (
                    <p className="md:col-span-2 text-sm text-red-600">{error}</p>
                  ) : null}
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={pending}>
                      {pending ? "…" : tCrm("create")}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Select
            name={name}
            label={label}
            required={required}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              onChange?.(e.target.value);
            }}
            placeholder={tCommon("select")}
            options={options.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          {t("newCustomer")}
        </Button>
      </div>
      {modal}
    </div>
  );
}
