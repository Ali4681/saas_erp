"use client";

import { useRef, useTransition, type ReactNode } from "react";

/**
 * Client form that invokes a Server Action via startTransition.
 * Needed inside portaled dialogs where native form action={...} may not POST.
 */
export function ServerActionForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);

  return (
    <form
      className={className}
      action={action}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || locked.current) return;
        const form = e.currentTarget;
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        locked.current = true;
        const formData = new FormData(form);
        startTransition(() => {
          void Promise.resolve(action(formData)).finally(() => {
            locked.current = false;
          });
        });
      }}
    >
      <fieldset disabled={pending} className="contents min-w-0 border-0 p-0">
        {children}
      </fieldset>
    </form>
  );
}
