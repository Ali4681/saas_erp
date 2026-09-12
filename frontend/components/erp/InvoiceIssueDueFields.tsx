"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";

/** Keeps due date aligned with issue date until the user edits due date manually. */
export function InvoiceIssueDueFields({
  issuedLabel,
  dueLabel,
  defaultIssuedOn,
  defaultDueOn,
}: {
  issuedLabel: string;
  dueLabel: string;
  defaultIssuedOn: string;
  defaultDueOn?: string;
}) {
  const initialDue = defaultDueOn ?? defaultIssuedOn;
  const [issuedOn, setIssuedOn] = useState(defaultIssuedOn);
  const [dueOn, setDueOn] = useState(initialDue);
  const [dueTouched, setDueTouched] = useState(
    Boolean(defaultDueOn && defaultDueOn !== defaultIssuedOn),
  );

  return (
    <>
      <Input
        name="issuedOn"
        label={issuedLabel}
        type="date"
        value={issuedOn}
        onChange={(event) => {
          const next = event.target.value;
          setIssuedOn(next);
          if (!dueTouched) setDueOn(next);
        }}
      />
      <Input
        name="dueOn"
        label={dueLabel}
        type="date"
        value={dueOn}
        onChange={(event) => {
          setDueTouched(true);
          setDueOn(event.target.value);
        }}
      />
    </>
  );
}
