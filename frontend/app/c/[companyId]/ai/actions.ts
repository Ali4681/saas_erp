"use server";

import { erpMutate } from "@/lib/erp/mutate";
import { optStr } from "@/lib/erp/form";

export async function updateAiBotConfig(
  companyId: string,
  channel: "WHATSAPP" | "VOICE_CALL",
  formData: FormData,
) {
  const settings: Record<string, string> = {};
  const webhookUrl = optStr(formData, "webhookUrl");
  const token = optStr(formData, "token");
  const apiUrl = optStr(formData, "apiUrl");
  if (webhookUrl) settings.webhookUrl = webhookUrl;
  if (token) settings.token = token;
  if (apiUrl) settings.apiUrl = apiUrl;

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/ai/bots/${channel}`,
    method: "PATCH",
    body: {
      status: optStr(formData, "status") ?? "DRAFT",
      settings,
    },
    pagePath: `/c/${companyId}/ai/bots/${channel === "WHATSAPP" ? "whatsapp" : "calls"}`,
    okMessage: "Bot settings saved",
  });
}
