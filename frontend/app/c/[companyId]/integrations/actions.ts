"use server";

import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string, segment = "") {
  return `/c/${companyId}/integrations${segment}`;
}

export async function createApiKey(companyId: string, formData: FormData) {
  const t = await getTranslations("integrations");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/integration-center/api-keys`,
    body: {
      name: str(formData, "name"),
      scopes: (optStr(formData, "scopes") ?? "*")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      rateLimitPerMin: Number(optStr(formData, "rateLimitPerMin") ?? "60"),
    },
    pagePath: page(companyId, "/center"),
    okMessage: t("flash.apiKeyCreated"),
  });
}

export async function setApiKeyStatus(
  companyId: string,
  apiKeyId: string,
  status: string,
) {
  const t = await getTranslations("integrations");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/integration-center/api-keys/${apiKeyId}/status`,
    method: "PATCH",
    body: { status },
    pagePath: page(companyId, "/center"),
    okMessage: t("flash.apiKeyStatusUpdated", { status }),
  });
}

export async function createWebhook(companyId: string, formData: FormData) {
  const t = await getTranslations("integrations");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/integration-center/webhooks`,
    body: {
      name: str(formData, "name"),
      targetUrl: str(formData, "targetUrl"),
      events: (optStr(formData, "events") ?? "order.created")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
    pagePath: page(companyId, "/center"),
    okMessage: t("flash.webhookCreated"),
  });
}

export async function deliverWebhook(
  companyId: string,
  webhookId: string,
  formData: FormData,
) {
  const t = await getTranslations("integrations");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/integration-center/webhooks/${webhookId}/deliver`,
    body: {
      eventType: str(formData, "eventType"),
      payload: { message: optStr(formData, "message") ?? "test from UI" },
    },
    pagePath: page(companyId, "/center"),
    okMessage: t("flash.testDeliverySent"),
  });
}

export async function createMessagingChannel(
  companyId: string,
  formData: FormData,
) {
  const t = await getTranslations("integrations");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/messaging/channels`,
    body: {
      provider: str(formData, "provider"),
      name: str(formData, "name"),
    },
    pagePath: page(companyId, "/messaging"),
    okMessage: t("flash.channelCreated"),
  });
}

export async function sendMessage(companyId: string, formData: FormData) {
  const t = await getTranslations("integrations");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/messaging/send`,
    body: {
      messagingChannelId: str(formData, "messagingChannelId"),
      recipient: str(formData, "recipient"),
      subject: optStr(formData, "subject"),
      body: optStr(formData, "body"),
    },
    pagePath: page(companyId, "/messaging"),
    okMessage: t("flash.messageSent"),
  });
}
