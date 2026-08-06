"use server";

import { getTranslations } from "next-intl/server";
import { apiServer } from "@/lib/api/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr } from "@/lib/erp/form";
import { ALL_CREDENTIAL_FORM_KEYS } from "@/lib/provider-ops";

function page(
  companyId: string,
  channelSlug: string,
  providerCode: string,
) {
  return `/c/${companyId}/channels/${channelSlug}/${providerCode.toLowerCase()}`;
}

function syncEntitiesForCategory(categoryCode: string) {
  if (categoryCode === "INSTALLMENT") return ["installment", "order"];
  if (categoryCode === "ECOMMERCE") return ["order", "product", "category"];
  return ["order", "product", "category", "location"];
}

function collectCredentialPayload(formData: FormData) {
  const payload: Record<string, string> = {};
  for (const key of ALL_CREDENTIAL_FORM_KEYS) {
    const value = optStr(formData, key);
    if (value) payload[key] = value;
  }
  return payload;
}

export type ProviderSyncPanelData = {
  syncStates: Array<{
    entityType: string;
    lastSyncedAt: string | null;
    lastStatus: string;
  }>;
  orders: Array<{
    id: string;
    externalId: string;
    status: string;
    totalAmount: string | number | null;
    currency: string | null;
    placedAt: string | null;
    customer?: { displayName: string | null } | null;
  }>;
  installments: Array<{
    id: string;
    externalId: string;
    status: string;
    amount: string | number;
    currency: string;
    merchantOrderReference: string;
    lastSyncedAt: string;
  }>;
  products: Array<{
    id: string;
    externalId: string;
    name: string;
    status: string;
    price: string | number | null;
    currency: string | null;
  }>;
  jobs: Array<{
    id: string;
    entityType: string | null;
    jobType: string;
    status: string;
    scheduledAt: string;
    finishedAt: string | null;
  }>;
};

/** Soft refresh: enqueue sync (if active) and return panel data — no page redirect. */
export async function fetchProviderSyncPanel(input: {
  companyId: string;
  projectId: string;
  categoryCode: string;
  projectStatus: string;
  triggerSync?: boolean;
}): Promise<ProviderSyncPanelData> {
  const { companyId, projectId, categoryCode, projectStatus } = input;

  if (input.triggerSync !== false && projectStatus === "ACTIVE") {
    for (const entityType of syncEntitiesForCategory(categoryCode)) {
      try {
        await apiServer(
          `/companies/${companyId}/projects/${projectId}/jobs/sync`,
          {
            method: "POST",
            companyId,
            body: JSON.stringify({ entityType, fullSync: true }),
          },
        );
      } catch {
        // continue fetching current panel state
      }
    }
  }

  const [syncStates, orders, installments, products, jobs] = await Promise.all([
    apiServer<ProviderSyncPanelData["syncStates"]>(
      `/companies/${companyId}/projects/${projectId}/sync-states`,
      { companyId },
    ).catch(() => []),
    apiServer<ProviderSyncPanelData["orders"]>(
      `/companies/${companyId}/projects/${projectId}/mirrors/orders?take=15`,
      { companyId },
    ).catch(() => []),
    apiServer<ProviderSyncPanelData["installments"]>(
      `/companies/${companyId}/projects/${projectId}/mirrors/installments?take=15`,
      { companyId },
    ).catch(() => []),
    apiServer<ProviderSyncPanelData["products"]>(
      `/companies/${companyId}/projects/${projectId}/mirrors/products?take=15`,
      { companyId },
    ).catch(() => []),
    apiServer<ProviderSyncPanelData["jobs"]>(
      `/companies/${companyId}/projects/${projectId}/jobs`,
      { companyId },
    ).catch(() => []),
  ]);

  return { syncStates, orders, installments, products, jobs };
}

export async function connectProviderProject(
  companyId: string,
  channelSlug: string,
  categoryCode: string,
  providerCode: string,
  formData: FormData,
) {
  const t = await getTranslations("channels");
  const name =
    optStr(formData, "name")?.trim() ||
    `${providerCode} — ${companyId.slice(0, 8)}`;

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/projects`,
    body: {
      categoryCode,
      providerCode,
      name,
      environment: optStr(formData, "environment") ?? "PRODUCTION",
      defaultCurrency: optStr(formData, "defaultCurrency") ?? "SAR",
    },
    pagePath: page(companyId, channelSlug, providerCode),
    okMessage: t("flash.linkCreated"),
  });
}

export async function saveExtensionSession(
  companyId: string,
  channelSlug: string,
  providerCode: string,
  extensionChannel: string,
) {
  const t = await getTranslations("channels");
  await erpMutate({
    companyId,
    path: `/integrations/extension/${extensionChannel}/save-session`,
    pagePath: page(companyId, channelSlug, providerCode),
    okMessage: t("flash.sessionSaved"),
  });
}

export async function setProviderProjectStatus(
  companyId: string,
  channelSlug: string,
  providerCode: string,
  projectId: string,
  status: string,
) {
  const t = await getTranslations("channels");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/projects/${projectId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, channelSlug, providerCode),
    okMessage:
      status === "ACTIVE"
        ? t("flash.linkActivated")
        : t("flash.linkStatusUpdated", { status }),
  });
}

export async function testProviderAuth(
  companyId: string,
  channelSlug: string,
  providerCode: string,
  projectId: string,
) {
  const t = await getTranslations("channels");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/projects/${projectId}/test-auth`,
    pagePath: page(companyId, channelSlug, providerCode),
    okMessage: t("flash.connectionTested"),
  });
}

export async function saveProviderCredentials(
  companyId: string,
  channelSlug: string,
  providerCode: string,
  projectId: string,
  formData: FormData,
) {
  const t = await getTranslations("channels");
  const authType = optStr(formData, "authType") ?? "API_KEY";
  const payload = collectCredentialPayload(formData);

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/projects/${projectId}/credentials`,
    method: "PUT",
    body: { authType, payload },
    pagePath: page(companyId, channelSlug, providerCode),
    okMessage: t("flash.credentialsSaved"),
  });
}

export async function runProviderOperation(input: {
  companyId: string;
  projectId: string;
  capabilityCode: string;
  operationType?: string;
  externalTargetId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<
  | {
      ok: true;
      id: string;
      status: string;
      rawResponse: Record<string, unknown> | null;
      failureMessage?: string | null;
    }
  | { ok: false; error: string }
> {
  const t = await getTranslations("channels");
  const idempotencyKey = `${input.capabilityCode}-${input.externalTargetId ?? "x"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const result = await apiServer<{
      id: string;
      status: string;
      rawResponse: Record<string, unknown> | null;
      failureMessage: string | null;
    }>(
      `/companies/${input.companyId}/projects/${input.projectId}/operations/invoke`,
      {
        method: "POST",
        companyId: input.companyId,
        body: JSON.stringify({
          capabilityCode: input.capabilityCode,
          operationType: input.operationType ?? input.capabilityCode,
          idempotencyKey,
          externalTargetId: input.externalTargetId ?? undefined,
          payload: input.payload ?? {},
        }),
      },
    );

    if (result.status === "FAILED") {
      return {
        ok: false,
        error: result.failureMessage || t("flash.commandFailed"),
      };
    }

    return {
      ok: true,
      id: result.id,
      status: result.status,
      rawResponse: result.rawResponse,
      failureMessage: result.failureMessage,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : t("flash.commandFailed"),
    };
  }
}

export async function runProviderOrderOperation(input: {
  companyId: string;
  projectId: string;
  capabilityCode: string;
  orderExternalId: string;
  status?: string;
  reason?: string;
  amount?: number | string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const result = await runProviderOperation({
    companyId: input.companyId,
    projectId: input.projectId,
    capabilityCode: input.capabilityCode,
    externalTargetId: input.orderExternalId,
    payload: {
      ...(input.status
        ? { status: input.status, order_status: input.status }
        : {}),
      ...(input.reason
        ? { reason: input.reason, cancellationReason: input.reason }
        : {}),
      ...(input.amount != null && input.amount !== ""
        ? { amount: Number(input.amount) }
        : {}),
    },
  });
  if (!result.ok) return result;
  return { ok: true, id: result.id };
}

export async function fetchHungerStationReports(input: {
  companyId: string;
  projectId: string;
  daysBack?: number;
}): Promise<
  | {
      ok: true;
      insights: Record<string, unknown> | null;
    }
  | { ok: false; error: string }
> {
  const daysBack = input.daysBack ?? 7;
  const insights = await runProviderOperation({
    companyId: input.companyId,
    projectId: input.projectId,
    capabilityCode: "REPORT_READ",
    payload: { kind: "insights", daysBack },
  });

  if (!insights.ok) {
    return { ok: false, error: insights.error };
  }

  return {
    ok: true,
    insights: insights.rawResponse,
  };
}

export async function connectProviderWithCredentials(
  companyId: string,
  channelSlug: string,
  categoryCode: string,
  providerCode: string,
  formData: FormData,
) {
  const t = await getTranslations("channels");
  const name =
    optStr(formData, "name")?.trim() ||
    `${providerCode} — ${companyId.slice(0, 8)}`;
  const authType = optStr(formData, "authType") ?? "API_KEY";
  const payload = collectCredentialPayload(formData);

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/projects`,
    body: {
      categoryCode,
      providerCode,
      name,
      environment: optStr(formData, "environment") ?? "PRODUCTION",
      defaultCurrency: "SAR",
      ...(Object.keys(payload).length
        ? { credentials: { authType, payload } }
        : {}),
    },
    pagePath: page(companyId, channelSlug, providerCode),
    okMessage: t("flash.linkCreatedWithCreds"),
  });
}
