"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";

function flashPath(pagePath: string, key: "ok" | "error", message: string) {
  const sep = pagePath.includes("?") ? "&" : "?";
  return `${pagePath}${sep}${key}=${encodeURIComponent(message)}`;
}
export async function saveOnboardingStep(
  companyId: string,
  step: number,
  data: Record<string, unknown>,
) {
  const t = await getTranslations("onboarding");
  const pagePath = `/c/${companyId}/onboarding?step=${step}`;
  try {
    await apiServer(`/companies/${companyId}/onboarding/steps/${step}`, {
      method: "PATCH",
      companyId,
      body: JSON.stringify({ data }),
    });
    const templateCode =
      typeof data.posTemplateCode === "string"
        ? data.posTemplateCode.trim()
        : "";
    if (templateCode) {
      try {
        await apiServer(
          `/companies/${companyId}/sales/pos/terminal/templates/apply`,
          {
            method: "POST",
            companyId,
            body: JSON.stringify({
              templateCode,
              seedCategories: true,
            }),
          },
        );
      } catch {
        // Template apply is best-effort during onboarding.
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
  revalidatePath(`/c/${companyId}/onboarding`);
  const nextStep = Math.min(5, step + 1);
  redirect(
    flashPath(
      `/c/${companyId}/onboarding?step=${nextStep}`,
      "ok",
      t("saved"),
    ),
  );
}

export async function skipOnboardingStep(companyId: string, step: number) {
  const pagePath = `/c/${companyId}/onboarding?step=${step}`;
  try {
    await apiServer(
      `/companies/${companyId}/onboarding/steps/${step}/skip`,
      { method: "POST", companyId },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
  revalidatePath(`/c/${companyId}/onboarding`);
  redirect(`/c/${companyId}/onboarding?step=${Math.min(5, step + 1)}`);
}

export async function completeOnboarding(companyId: string) {
  const t = await getTranslations("onboarding");
  try {
    await apiServer(`/companies/${companyId}/onboarding/complete`, {
      method: "POST",
      companyId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(
        flashPath(`/c/${companyId}/onboarding`, "error", error.message),
      );
    }
    throw error;
  }
  revalidatePath(`/c/${companyId}`);
  redirect(flashPath(`/c/${companyId}`, "ok", t("finish")));
}

export async function requestOnboardingService(
  companyId: string,
  step: number,
  requestType: string,
  note?: string,
) {
  const t = await getTranslations("onboarding");
  const pagePath = `/c/${companyId}/onboarding?step=${step}`;
  try {
    await apiServer(`/companies/${companyId}/onboarding/service-requests`, {
      method: "POST",
      companyId,
      body: JSON.stringify({ step, requestType, note }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(flashPath(pagePath, "error", error.message));
    }
    throw error;
  }
  revalidatePath(pagePath);
  redirect(flashPath(pagePath, "ok", t("requestSent")));
}
