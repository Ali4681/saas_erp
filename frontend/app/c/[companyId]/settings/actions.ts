"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function bhPage(companyId: string) {
  return `/c/${companyId}/settings/business-hours`;
}
function indPage(companyId: string) {
  return `/c/${companyId}/settings/industry`;
}
function govPage(companyId: string) {
  return `/c/${companyId}/settings/governance`;
}

export async function saveBusinessHours(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/business-hours`,
    method: "PUT",
    body: {
      mode: str(formData, "mode"),
      defaultStartTime: str(formData, "defaultStartTime"),
      defaultEndTime: str(formData, "defaultEndTime"),
      autoSplitShifts: formData.get("autoSplitShifts") === "on",
      autoShiftHours: Number(optStr(formData, "autoShiftHours") ?? "8"),
      twelveHourMode: optStr(formData, "twelveHourMode") ?? "FIXED",
      period2StartTime: optStr(formData, "period2StartTime"),
      period2EndTime: optStr(formData, "period2EndTime"),
      notes: optStr(formData, "notes"),
    },
    pagePath: bhPage(companyId),
    okMessage: "Business hours saved",
  });
}

export async function generateBusinessShifts(companyId: string) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/business-hours/install-standard-shifts`,
    method: "POST",
    body: {},
    pagePath: bhPage(companyId),
    okMessage: "Standard shifts installed",
  });
}

export async function addDynamicWindow(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/business-hours/windows`,
    method: "POST",
    body: {
      label: optStr(formData, "label"),
      startsAt: str(formData, "startsAt"),
      endsAt: str(formData, "endsAt"),
    },
    pagePath: bhPage(companyId),
    okMessage: "Window added",
  });
}

export async function applyIndustryPack(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/industry-activations`,
    method: "POST",
    body: {
      industryActivityId: str(formData, "industryActivityId"),
    },
    pagePath: indPage(companyId),
    okMessage: "Industry pack applied",
  });
}

export async function saveApprovalThreshold(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/governance/thresholds`,
    method: "POST",
    body: {
      actionType: str(formData, "actionType"),
      maxAmount: str(formData, "maxAmount"),
      currency: optStr(formData, "currency") ?? "SAR",
      requiredPermission:
        optStr(formData, "requiredPermission") ?? "finance.write",
      escalatePermission: optStr(formData, "escalatePermission"),
    },
    pagePath: govPage(companyId),
    okMessage: "Threshold saved",
  });
}

export async function lockFinancialPeriod(
  companyId: string,
  formData: FormData,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/governance/period-locks`,
    method: "POST",
    body: {
      periodStart: str(formData, "periodStart"),
      periodEnd: str(formData, "periodEnd"),
      backdateUntil: optStr(formData, "backdateUntil"),
      notes: optStr(formData, "notes"),
    },
    pagePath: govPage(companyId),
    okMessage: "Period locked",
  });
}

export async function openBreakGlass(companyId: string, formData: FormData) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/governance/break-glass`,
    method: "POST",
    body: {
      reason: str(formData, "reason"),
      durationMinutes: Number(optStr(formData, "durationMinutes") ?? "60"),
    },
    pagePath: govPage(companyId),
    okMessage: "Break-glass session opened — owners notified",
  });
}

export async function revokeBreakGlass(
  companyId: string,
  sessionId: string,
) {
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/governance/break-glass/${sessionId}/revoke`,
    method: "POST",
    body: {},
    pagePath: govPage(companyId),
    okMessage: "Break-glass revoked",
  });
}
