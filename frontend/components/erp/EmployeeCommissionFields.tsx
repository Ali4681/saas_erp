"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export function EmployeeCommissionFields({
  labels,
  defaultSalesTargetMode,
  defaultSalesTargetAmount,
  defaultSalesRewardAmount,
  defaultTargetPercent,
}: {
  labels: {
    plan: string;
    withTarget: string;
    noTarget: string;
    targetAmount: string;
    rewardType: string;
    rewardFixed: string;
    rewardPercent: string;
    rewardAmount: string;
    commissionPercent: string;
    hintTarget: string;
    hintNoTarget: string;
  };
  defaultSalesTargetMode?: string | null;
  defaultSalesTargetAmount?: string | null;
  defaultSalesRewardAmount?: string | null;
  defaultTargetPercent?: string | null;
}) {
  const initialPlan: "TARGET" | "NO_TARGET" =
    defaultSalesTargetMode === "NO_TARGET_PERCENT" ||
    defaultSalesTargetMode === "PERCENT"
      ? "NO_TARGET"
      : "TARGET";
  const initialReward: "FIXED" | "PERCENT" =
    defaultSalesTargetMode === "TARGET_PERCENT" ||
    defaultSalesTargetMode === "PERCENT" ||
    defaultSalesTargetMode === "BOTH"
      ? "PERCENT"
      : "FIXED";

  const [plan, setPlan] = useState<"TARGET" | "NO_TARGET">(initialPlan);
  const [rewardType, setRewardType] = useState<"FIXED" | "PERCENT">(
    initialReward,
  );

  const salesTargetMode =
    plan === "NO_TARGET"
      ? "NO_TARGET_PERCENT"
      : rewardType === "FIXED"
        ? "TARGET_FIXED"
        : "TARGET_PERCENT";

  return (
    <div className="space-y-3 md:col-span-2">
      <input type="hidden" name="salesTargetMode" value={salesTargetMode} />
      <Select
        name="commissionPlanUi"
        label={labels.plan}
        value={plan}
        onChange={(e) => setPlan(e.target.value as "TARGET" | "NO_TARGET")}
        showPlaceholderOption={false}
        options={[
          { value: "TARGET", label: labels.withTarget },
          { value: "NO_TARGET", label: labels.noTarget },
        ]}
      />
      {plan === "TARGET" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              name="salesTargetAmount"
              label={labels.targetAmount}
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={defaultSalesTargetAmount ?? ""}
            />
            <Select
              name="rewardTypeUi"
              label={labels.rewardType}
              value={rewardType}
              onChange={(e) =>
                setRewardType(e.target.value as "FIXED" | "PERCENT")
              }
              showPlaceholderOption={false}
              options={[
                { value: "FIXED", label: labels.rewardFixed },
                { value: "PERCENT", label: labels.rewardPercent },
              ]}
            />
            {rewardType === "FIXED" ? (
              <Input
                name="salesRewardAmount"
                label={labels.rewardAmount}
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={defaultSalesRewardAmount ?? ""}
              />
            ) : (
              <Input
                name="targetPercent"
                label={labels.commissionPercent}
                type="number"
                min={0}
                max={100}
                step="0.01"
                required
                defaultValue={defaultTargetPercent ?? ""}
              />
            )}
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {labels.hintTarget}
          </p>
        </>
      ) : (
        <>
          <Input
            name="targetPercent"
            label={labels.commissionPercent}
            type="number"
            min={0}
            max={100}
            step="0.01"
            required
            defaultValue={defaultTargetPercent ?? ""}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            {labels.hintNoTarget}
          </p>
        </>
      )}
    </div>
  );
}
