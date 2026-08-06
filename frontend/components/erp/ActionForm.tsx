"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function ActionForm({
  action,
  label,
  variant = "secondary",
  confirm,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(e) => {
          if (!confirm) return;
          if (confirmedRef.current) {
            confirmedRef.current = false;
            return;
          }
          e.preventDefault();
          setConfirmOpen(true);
        }}
      >
        <Button
          type="submit"
          variant={variant}
          disabled={pending}
          className="!px-2 !py-1 text-xs"
        >
          {pending ? "…" : label}
        </Button>
      </form>

      {confirm ? (
        <ConfirmDialog
          open={confirmOpen}
          message={confirm}
          variant={variant === "danger" ? "danger" : "primary"}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            confirmedRef.current = true;
            const form = formRef.current;
            if (!form) return;
            startTransition(() => {
              const formData = new FormData(form);
              void Promise.resolve(action(formData));
            });
          }}
        />
      ) : null}
    </>
  );
}
