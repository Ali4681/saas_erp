"use server";

import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";
import { optStr, str } from "@/lib/erp/form";

export type AiActionResult<T = unknown> = {
  data?: T;
  error?: string;
};

async function aiCall<T>(
  companyId: string,
  path: string,
  body: unknown,
): Promise<AiActionResult<T>> {
  try {
    const data = await apiServer<T>(path, {
      method: "POST",
      companyId,
      body: JSON.stringify(body),
    });
    return { data };
  } catch (error) {
    if (error instanceof ApiError) {
      const msg =
        error.status === 403
          ? `مرفوض (403): ${error.message} — قد تحتاج خطة ENTERPRISE أو صلاحية ai.write`
          : error.message;
      return { error: msg };
    }
    return { error: "فشل طلب الذكاء الاصطناعي" };
  }
}

export async function aiAssistantAsk(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/assistant/ask`, {
    question: str(formData, "question"),
    from: optStr(formData, "from"),
    to: optStr(formData, "to"),
  });
}

export async function aiAssistantAskQuestion(
  companyId: string,
  question: string,
  opts?: { from?: string; to?: string },
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/assistant/ask`, {
    question: question.trim(),
    from: opts?.from,
    to: opts?.to,
  });
}

export async function aiProductGenerate(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/products/generate`, {
    prompt: str(formData, "prompt"),
    language: optStr(formData, "language") ?? "ar",
    targetCurrency: optStr(formData, "targetCurrency") ?? "SAR",
  });
}

export async function aiProductImprove(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/products/improve-text`, {
    text: str(formData, "text"),
    goal: optStr(formData, "goal") ?? "improve",
    language: optStr(formData, "language") ?? "ar",
  });
}

export async function aiReportsAnalyze(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/reports/analyze`, {
    scope: str(formData, "scope"),
    from: optStr(formData, "from"),
    to: optStr(formData, "to"),
  });
}

export async function aiNotesAnalyze(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/notes/analyze`, {
    noteId: optStr(formData, "noteId"),
    text: optStr(formData, "text"),
  });
}

export async function aiNotesSearch(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/notes/search`, {
    query: str(formData, "query"),
    limit: Number(optStr(formData, "limit") ?? "20"),
  });
}

export async function aiMarketingGenerate(
  companyId: string,
  formData: FormData,
): Promise<AiActionResult> {
  return aiCall(companyId, `/companies/${companyId}/ai/marketing/generate`, {
    topic: str(formData, "topic"),
    channel: optStr(formData, "channel"),
    tone: optStr(formData, "tone"),
    language: optStr(formData, "language") ?? "ar",
    variants: Number(optStr(formData, "variants") ?? "3"),
  });
}
