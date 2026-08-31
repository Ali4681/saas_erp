"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function EmployeeQiwaContractFields({
  qiwaUrl,
  labels,
  defaultQiwaRegistered,
  defaultEmploymentCategory,
  defaultTrialStartsOn,
  defaultTrialEndsOn,
}: {
  qiwaUrl: string;
  labels: {
    qiwaRegistered: string;
    qiwaYes: string;
    qiwaNo: string;
    qiwaFile: string;
    qiwaFileHint: string;
    goQiwa: string;
    contractType: string;
    employment: string;
    ajeer: string;
    trial: string;
    trialStart: string;
    trialEnd: string;
    trialHint: string;
  };
  defaultQiwaRegistered?: "yes" | "no";
  defaultEmploymentCategory?:
    | "EMPLOYMENT_CONTRACT"
    | "WAGE_WORKER"
    | "TRIAL_PERIOD";
  defaultTrialStartsOn?: string | null;
  defaultTrialEndsOn?: string | null;
}) {
  const initiallyRegistered = defaultQiwaRegistered === "yes";
  const [qiwaRegistered, setQiwaRegistered] = useState<"yes" | "no">(
    defaultQiwaRegistered ?? "no",
  );
  const [contractType, setContractType] = useState<
    "EMPLOYMENT_CONTRACT" | "WAGE_WORKER" | "TRIAL_PERIOD"
  >(defaultEmploymentCategory ?? "EMPLOYMENT_CONTRACT");

  // Already registered: file optional. Newly selecting registered: required.
  const fileRequired = qiwaRegistered === "yes" && !initiallyRegistered;

  return (
    <div className="space-y-3 md:col-span-2">
      <Select
        name="qiwaRegistered"
        label={labels.qiwaRegistered}
        value={qiwaRegistered}
        onChange={(e) => setQiwaRegistered(e.target.value as "yes" | "no")}
        showPlaceholderOption={false}
        options={[
          { value: "yes", label: labels.qiwaYes },
          { value: "no", label: labels.qiwaNo },
        ]}
      />
      {qiwaRegistered === "yes" ? (
        <>
          <input type="hidden" name="approvalStatus" value="APPROVED" />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--foreground)]">
              {labels.qiwaFile}
              {!fileRequired ? ` (${labels.qiwaFileHint})` : ""}
            </span>
            <input
              type="file"
              name="qiwaContractFile"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf"
              required={fileRequired}
              className="h-10 rounded-lg border border-[var(--input)] bg-[var(--card)] px-3 text-sm file:me-3 file:rounded-md file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-1.5"
            />
            {fileRequired ? (
              <span className="text-xs text-[var(--muted-foreground)]">
                {labels.qiwaFileHint}
              </span>
            ) : null}
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="approvalStatus" value="PENDING" />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              window.open(qiwaUrl, "_blank", "noopener,noreferrer")
            }
          >
            {labels.goQiwa}
          </Button>
        </>
      )}

      <Select
        name="employmentCategory"
        label={labels.contractType}
        value={contractType}
        onChange={(e) =>
          setContractType(
            e.target.value as
              | "EMPLOYMENT_CONTRACT"
              | "WAGE_WORKER"
              | "TRIAL_PERIOD",
          )
        }
        required
        showPlaceholderOption={false}
        options={[
          { value: "EMPLOYMENT_CONTRACT", label: labels.employment },
          { value: "WAGE_WORKER", label: labels.ajeer },
          { value: "TRIAL_PERIOD", label: labels.trial },
        ]}
      />
      {contractType === "TRIAL_PERIOD" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            name="trialStartsOn"
            label={labels.trialStart}
            type="date"
            required
            defaultValue={defaultTrialStartsOn?.slice(0, 10) ?? ""}
          />
          <Input
            name="trialEndsOn"
            label={labels.trialEnd}
            type="date"
            required
            defaultValue={defaultTrialEndsOn?.slice(0, 10) ?? ""}
          />
          <p className="text-xs text-[var(--muted-foreground)] md:col-span-2">
            {labels.trialHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}
