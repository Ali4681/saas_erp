"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type WindowRow = { key: string; start: string; end: string };
type Mode = "ONE_SHIFT" | "TWO_SHIFTS" | "FLEXIBLE";

function normalizeWindows(
  mode: Mode,
  windows?: Array<{ start: string; end: string }>,
): WindowRow[] {
  if (windows && windows.length > 0) {
    return windows.map((w, i) => ({
      key: String(i + 1),
      start: w.start.slice(0, 5),
      end: w.end.slice(0, 5),
    }));
  }
  if (mode === "TWO_SHIFTS") {
    return [
      { key: "1", start: "08:00", end: "14:00" },
      { key: "2", start: "16:00", end: "22:00" },
    ];
  }
  if (mode === "FLEXIBLE") {
    return [
      { key: "1", start: "06:00", end: "14:00" },
      { key: "2", start: "14:00", end: "22:00" },
      { key: "3", start: "22:00", end: "06:00" },
    ];
  }
  return [{ key: "1", start: "09:00", end: "17:00" }];
}

export function EmployeeShiftPatternFields({
  labels,
  defaultMode,
  defaultWindows,
}: {
  labels: {
    pattern: string;
    one: string;
    two: string;
    flexible: string;
    hint: string;
    start: string;
    end: string;
    addShift: string;
    remove: string;
    shiftN: string;
  };
  defaultMode?: string | null;
  defaultWindows?: Array<{ start: string; end: string }> | null;
}) {
  const initialMode: Mode =
    defaultMode === "TWO_SHIFTS" || defaultMode === "FLEXIBLE"
      ? defaultMode
      : "ONE_SHIFT";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [windows, setWindows] = useState<WindowRow[]>(() =>
    normalizeWindows(initialMode, defaultWindows ?? undefined),
  );

  function applyMode(next: Mode) {
    setMode(next);
    setWindows(normalizeWindows(next));
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <input type="hidden" name="shiftPatternMode" value={mode} />
      <Select
        name="shiftPatternModeUi"
        label={labels.pattern}
        value={mode}
        onChange={(e) => applyMode(e.target.value as Mode)}
        showPlaceholderOption={false}
        options={[
          { value: "ONE_SHIFT", label: labels.one },
          { value: "TWO_SHIFTS", label: labels.two },
          { value: "FLEXIBLE", label: labels.flexible },
        ]}
      />
      <p className="text-xs text-[var(--muted-foreground)]">{labels.hint}</p>
      <div className="space-y-2">
        {windows.map((w, index) => (
          <div
            key={w.key}
            className="grid gap-2 rounded-lg border border-[var(--border)] p-3 md:grid-cols-[1fr_1fr_auto]"
          >
            <input
              type="hidden"
              name={`shiftWindowStart_${index}`}
              value={w.start}
            />
            <input
              type="hidden"
              name={`shiftWindowEnd_${index}`}
              value={w.end}
            />
            <Input
              label={`${labels.shiftN} ${index + 1} — ${labels.start}`}
              type="time"
              value={w.start}
              onChange={(e) =>
                setWindows((prev) =>
                  prev.map((row) =>
                    row.key === w.key
                      ? { ...row, start: e.target.value }
                      : row,
                  ),
                )
              }
            />
            <Input
              label={labels.end}
              type="time"
              value={w.end}
              onChange={(e) =>
                setWindows((prev) =>
                  prev.map((row) =>
                    row.key === w.key ? { ...row, end: e.target.value } : row,
                  ),
                )
              }
            />
            {mode === "FLEXIBLE" ? (
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setWindows((prev) =>
                      prev.length <= 1
                        ? prev
                        : prev.filter((row) => row.key !== w.key),
                    )
                  }
                >
                  {labels.remove}
                </Button>
              </div>
            ) : (
              <span />
            )}
          </div>
        ))}
        <input
          type="hidden"
          name="shiftWindowCount"
          value={String(windows.length)}
        />
        {mode === "FLEXIBLE" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setWindows((prev) => [
                ...prev,
                { key: `${Date.now()}`, start: "09:00", end: "17:00" },
              ])
            }
          >
            {labels.addShift}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
