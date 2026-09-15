"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { shouldSkipSalesCommission } from "@/lib/hr/cashier";

export function EmployeeCommissionFields({
  labels,
  defaultSalesTargetMode,
  defaultSalesTargetAmount,
  defaultSalesRewardAmount,
  defaultTargetPercent,
  forceHidden = false,
  watchLoginRole = true,
  watchJobTitle = true,
  invoiceCreateByRoleCode = {},
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
    cashierSkippedHint?: string;
  };
  defaultSalesTargetMode?: string | null;
  defaultSalesTargetAmount?: string | null;
  defaultSalesRewardAmount?: string | null;
  defaultTargetPercent?: string | null;
  forceHidden?: boolean;
  watchLoginRole?: boolean;
  watchJobTitle?: boolean;
  invoiceCreateByRoleCode?: Record<string, boolean>;
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
  const [loginRole, setLoginRole] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  useEffect(() => {
    if (!watchLoginRole && !watchJobTitle) return;

    function readFrom() {
      const form =
        document.querySelector("dialog[open] form") ??
        document.querySelector("form");
      if (!form) return;
      if (watchLoginRole) {
        const roleSelect = form.querySelector<HTMLSelectElement>(
          'select[name="loginRoleCode"]',
        );
        if (roleSelect) setLoginRole(roleSelect.value);
      }
      if (watchJobTitle) {
        const titleSelect = form.querySelector<HTMLSelectElement>(
          'select[name="jobTitle"]',
        );
        if (titleSelect) setJobTitle(titleSelect.value);
      }
    }

    function onChange(e: Event) {
      const target = e.target as HTMLElement | null;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.name === "loginRoleCode") setLoginRole(target.value);
      if (target.name === "jobTitle") setJobTitle(target.value);
    }

    const t = window.setTimeout(readFrom, 0);
    document.addEventListener("change", onChange);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("change", onChange);
    };
  }, [watchLoginRole, watchJobTitle]);

  const roleKey = loginRole.trim().toUpperCase();
  const roleCanCreateInvoice =
    roleKey.length > 0 ? Boolean(invoiceCreateByRoleCode[roleKey]) : null;

  const hidden =
    forceHidden ||
    shouldSkipSalesCommission({
      loginRoleCode: watchLoginRole ? loginRole || null : null,
      jobTitle: watchJobTitle ? jobTitle : null,
      roleCanCreateInvoice,
    });

  const salesTargetMode =
    plan === "NO_TARGET"
      ? "NO_TARGET_PERCENT"
      : rewardType === "FIXED"
        ? "TARGET_FIXED"
        : "TARGET_PERCENT";

  if (hidden) {
    return (
      <div className="space-y-1 md:col-span-2">
        <input type="hidden" name="salesTargetMode" value="" />
        <input type="hidden" name="salesTargetAmount" value="" />
        <input type="hidden" name="salesRewardAmount" value="" />
        <input type="hidden" name="targetPercent" value="" />
        {labels.cashierSkippedHint ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {labels.cashierSkippedHint}
          </p>
        ) : null}
      </div>
    );
  }

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
