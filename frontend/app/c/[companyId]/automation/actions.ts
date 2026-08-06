"use server";

import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment = "") {
  return `/c/${companyId}/automation${segment}`;
}

function buildActionFromLegacy(formData: FormData): Record<string, unknown> {
  const actionType = optStr(formData, "actionType") ?? "notify";
  const title = optStr(formData, "notifyTitle") ?? str(formData, "name");
  const body =
    optStr(formData, "notifyBody") ??
    `Triggered by ${str(formData, "triggerEvent")}`;
  const userId = optStr(formData, "notifyUserId");
  const daysFromNow = optStr(formData, "daysFromNow") ?? "1";

  switch (actionType) {
    case "notify_role":
      return {
        type: "notify_role",
        roleCode: str(formData, "notifyRoleCode"),
        title,
        body,
      };
    case "assign_user":
      return {
        type: "assign_user",
        userId: str(formData, "notifyUserId"),
      };
    case "create_task":
      return {
        type: "create_task",
        title,
        body,
        userId: userId ?? undefined,
        daysFromNow: Number(daysFromNow) || 1,
      };
    case "create_crm_activity":
      return {
        type: "create_crm_activity",
        title,
        body,
        userId: userId ?? undefined,
        daysFromNow: Number(daysFromNow) || 1,
      };
    case "convert_quote_to_invoice":
      return { type: "convert_quote_to_invoice" };
    case "update_contact_status":
      return {
        type: "update_contact_status",
        status: optStr(formData, "contactStatus") ?? "ACTIVE",
      };
    case "create_purchase_order":
      return { type: "create_purchase_order" };
    case "ensure_stock_deduction":
      return { type: "ensure_stock_deduction" };
    case "update_leave_balance":
      return { type: "update_leave_balance" };
    case "prepare_payroll_run":
      return { type: "prepare_payroll_run" };
    case "open_next_phase":
      return { type: "open_next_phase" };
    default:
      return {
        type: "notify",
        userId: str(formData, "notifyUserId"),
        title,
        body,
      };
  }
}

export async function createRule(companyId: string, formData: FormData) {
  const t = await getTranslations("automation");
  const triggerEvent = str(formData, "triggerEvent");
  const actionsRaw = optStr(formData, "actionsJson");
  const conditionsRaw = optStr(formData, "conditionsJson");

  let actions: Record<string, unknown>[] = [];
  if (actionsRaw) {
    try {
      const parsed = JSON.parse(actionsRaw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("empty");
      }
      actions = parsed as Record<string, unknown>[];
    } catch {
      actions = [buildActionFromLegacy(formData)];
    }
  } else {
    actions = [buildActionFromLegacy(formData)];
  }

  let conditions: unknown[] = [];
  if (conditionsRaw) {
    try {
      const parsed = JSON.parse(conditionsRaw) as unknown;
      if (Array.isArray(parsed)) conditions = parsed;
    } catch {
      conditions = [];
    }
  }

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/automation/rules`,
    body: {
      name: str(formData, "name"),
      module: str(formData, "module"),
      triggerEvent,
      scheduleCron:
        triggerEvent === "schedule.cron"
          ? optStr(formData, "scheduleCron")
          : undefined,
      conditions,
      actions,
    },
    pagePath: page(companyId),
    okMessage: t("flash.ruleCreated"),
  });
}

export async function installTemplate(
  companyId: string,
  templateCode: string,
  formData: FormData,
) {
  const t = await getTranslations("automation");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/automation/templates/install`,
    body: {
      templateCode,
      assigneeUserId: optStr(formData, "assigneeUserId") ?? undefined,
      activate: true,
    },
    pagePath: page(companyId),
    okMessage: t("flash.templateActivated"),
  });
}

export async function installTemplatesBulk(
  companyId: string,
  module: string | null,
  formData: FormData,
) {
  const t = await getTranslations("automation");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/automation/templates/install-bulk`,
    body: {
      module: module || undefined,
      assigneeUserId: optStr(formData, "assigneeUserId") ?? undefined,
      activate: true,
    },
    pagePath: page(companyId),
    okMessage: module
      ? t("flash.moduleTemplatesInstalled")
      : t("flash.allTemplatesInstalled"),
  });
}

export async function setRuleStatus(
  companyId: string,
  ruleId: string,
  status: string,
) {
  const t = await getTranslations("automation");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/automation/rules/${ruleId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId),
    okMessage: t("flash.ruleStatusUpdated", { status }),
  });
}

export async function executeRule(
  companyId: string,
  ruleId: string,
  formData?: FormData,
) {
  const t = await getTranslations("automation");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/automation/rules/${ruleId}/execute`,
    body: {
      entityType: formData ? optStr(formData, "entityType") : undefined,
      entityId: formData ? optStr(formData, "entityId") : undefined,
    },
    pagePath: page(companyId, "/runs"),
    okMessage: t("flash.ruleExecuted"),
  });
}
