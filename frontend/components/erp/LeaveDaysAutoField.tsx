"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";

function daysInclusive(start: string, end: string): number {
  if (!start || !end) return 1;
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) {
    return 1;
  }
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

export function LeaveDaysAutoField({
  labels,
}: {
  labels: { from: string; to: string; days: string };
}) {
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const days = daysInclusive(startsOn, endsOn);

  useEffect(() => {
    if (startsOn && !endsOn) setEndsOn(startsOn);
  }, [startsOn, endsOn]);

  return (
    <>
      <Input
        name="startsOn"
        label={labels.from}
        type="date"
        required
        value={startsOn}
        onChange={(e) => setStartsOn(e.target.value)}
      />
      <Input
        name="endsOn"
        label={labels.to}
        type="date"
        required
        value={endsOn}
        onChange={(e) => setEndsOn(e.target.value)}
      />
      <Input
        name="requestedDays"
        label={labels.days}
        type="number"
        min={1}
        required
        readOnly
        value={String(days)}
      />
    </>
  );
}
