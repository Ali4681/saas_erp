"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

export function EmployeeQiwaEditFields({
  qiwaUrl,
  defaultStatus = "PENDING",
  labels,
}: {
  qiwaUrl: string;
  defaultStatus?: string;
  labels: {
    status: string;
    registered: string;
    notRegistered: string;
    file: string;
    fileHint: string;
    goQiwa: string;
  };
}) {
  const [status, setStatus] = useState<"PENDING" | "APPROVED">(
    defaultStatus === "APPROVED" ? "APPROVED" : "PENDING",
  );

  return (
    <div className="space-y-3 md:col-span-2">
      <Select
        name="approvalStatus"
        label={labels.status}
        value={status}
        onChange={(e) =>
          setStatus(e.target.value as "PENDING" | "APPROVED")
        }
        showPlaceholderOption={false}
        options={[
          { value: "PENDING", label: labels.notRegistered },
          { value: "APPROVED", label: labels.registered },
        ]}
      />
      {status === "APPROVED" ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-[var(--foreground)]">
            {labels.file}
          </span>
          <input
            type="file"
            name="qiwaContractFile"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf"
            required
            className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
          />
          <span className="text-xs text-[var(--muted-foreground)]">
            {labels.fileHint}
          </span>
        </label>
      ) : (
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.open(qiwaUrl, "_blank", "noopener,noreferrer")}
        >
          {labels.goQiwa}
        </Button>
      )}
    </div>
  );
}
