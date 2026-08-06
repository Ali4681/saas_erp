"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function companyPage(companyId: string) {
  return `/platform/companies/${companyId}`;
}

export async function createCompany(formData: FormData) {
  const t = await getTranslations("platform");
  const pagePath = "/platform/companies";
  const file = formData.get("logo");
  const logoBlob =
    file instanceof Blob && file.size > 0 ? (file as Blob & { name?: string }) : null;

  if (logoBlob) {
    const mimeType = logoBlob.type || "";
    const fileName = logoBlob.name || "logo.png";
    const ok =
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        mimeType,
      ) || /\.(jpe?g|png|webp|gif)$/i.test(fileName);
    if (!ok) {
      redirect(
        `${pagePath}?error=${encodeURIComponent(t("flash.invalidLogoType"))}`,
      );
    }
    if (logoBlob.size > 5 * 1024 * 1024) {
      redirect(
        `${pagePath}?error=${encodeURIComponent(t("flash.logoTooLarge"))}`,
      );
    }
  }

  try {
    const planCode = optStr(formData, "planCode");
    if (!planCode) {
      redirect(
        `${pagePath}?error=${encodeURIComponent(t("flash.planRequired"))}`,
      );
    }

    const payload: Record<string, string> = {
      legalName: str(formData, "legalName"),
      displayName: str(formData, "displayName"),
      slug: str(formData, "slug"),
      defaultCurrency: optStr(formData, "defaultCurrency") ?? "SAR",
      timezone: optStr(formData, "timezone") ?? "Asia/Riyadh",
      countryCode: optStr(formData, "countryCode") ?? "SA",
      city: optStr(formData, "city") ?? "Riyadh",
      planCode,
      defaultTaxRate: optStr(formData, "defaultTaxRate") ?? "15",
    };

    const ownerFullName = optStr(formData, "ownerFullName");
    const ownerEmail = optStr(formData, "ownerEmail");
    const ownerPassword = optStr(formData, "ownerPassword");
    if ((ownerEmail && !ownerPassword) || (!ownerEmail && ownerPassword)) {
      redirect(
        `${pagePath}?error=${encodeURIComponent(t("flash.ownerCredsPair"))}`,
      );
    }
    if (ownerFullName) payload.ownerFullName = ownerFullName;
    if (ownerEmail) payload.ownerEmail = ownerEmail;
    if (ownerPassword) payload.ownerPassword = ownerPassword;

    if (logoBlob) {
      const buf = Buffer.from(await logoBlob.arrayBuffer());
      payload.logoFileName = logoBlob.name || "logo.png";
      payload.logoMimeType = logoBlob.type || "image/png";
      payload.logoSizeBytes = String(buf.length);
      payload.logoContentBase64 = buf.toString("base64");
    }

    const company = await apiServer<{ id: string }>("/companies", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    revalidatePath(pagePath);
    revalidatePath(`/c/${company.id}`);
    redirect(
      `${pagePath}?ok=${encodeURIComponent(
        logoBlob
          ? t("flash.companyCreatedWithLogo")
          : t("flash.companyCreated"),
      )}`,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(
        `${pagePath}?error=${encodeURIComponent(
          error.status === 403
            ? t("flash.forbidden", { message: error.message })
            : error.message,
        )}`,
      );
    }
    throw error;
  }
}

export async function createPlan(formData: FormData) {
  const t = await getTranslations("platform");
  await erpMutate({
    path: "/plans",
    body: {
      code: str(formData, "code"),
      name: str(formData, "name"),
      billingInterval: str(formData, "billingInterval") || "MONTHLY",
      price: Number(str(formData, "price") || "0"),
      currency: optStr(formData, "currency") ?? "SAR",
      sortOrder: Number(str(formData, "sortOrder") || "0"),
      isActive: str(formData, "isActive") !== "false",
    },
    pagePath: "/platform/plans",
    okMessage: t("flash.planCreated"),
  });
}

export async function updatePlan(code: string, formData: FormData) {
  const t = await getTranslations("platform");
  await erpMutate({
    path: `/plans/${code}`,
    method: "PATCH",
    body: {
      name: str(formData, "name"),
      billingInterval: str(formData, "billingInterval") || "MONTHLY",
      price: Number(str(formData, "price") || "0"),
      currency: optStr(formData, "currency") ?? "SAR",
      sortOrder: Number(str(formData, "sortOrder") || "0"),
      isActive: str(formData, "isActive") !== "false",
    },
    pagePath: "/platform/plans",
    okMessage: t("flash.planUpdated"),
  });
}

export async function deletePlan(code: string) {
  const t = await getTranslations("platform");
  await erpMutate({
    path: `/plans/${code}`,
    method: "DELETE",
    pagePath: "/platform/plans",
    okMessage: t("flash.planDeleted"),
  });
}

export async function changePlan(companyId: string, formData: FormData) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/subscriptions/change-plan`,
    body: { planCode: str(formData, "planCode") },
    pagePath: companyPage(companyId),
    okMessage: t("flash.planChanged"),
  });
}

export async function cancelSubscription(companyId: string) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/subscriptions/cancel`,
    pagePath: companyPage(companyId),
    okMessage: t("flash.subscriptionCancelled"),
  });
}

export async function suspendSubscription(companyId: string) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/subscriptions/suspend`,
    pagePath: companyPage(companyId),
    okMessage: t("flash.subscriptionSuspended"),
  });
}

export async function renewSubscription(companyId: string) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}/subscriptions/renew`,
    pagePath: companyPage(companyId),
    okMessage: t("flash.subscriptionRenewed"),
  });
}

export async function softDeleteCompany(companyId: string) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}`,
    method: "DELETE",
    pagePath: "/platform/companies",
    okMessage: t("flash.companyDeleted"),
  });
}

export async function updateCompanyStatus(
  companyId: string,
  formData: FormData,
) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}`,
    method: "PATCH",
    body: { status: str(formData, "status") },
    pagePath: companyPage(companyId),
    okMessage: t("flash.companyStatusUpdated"),
  });
}

export async function updateCompanyLocale(
  companyId: string,
  formData: FormData,
) {
  const t = await getTranslations("platform");
  await erpMutate({
    companyId,
    path: `/companies/${companyId}`,
    method: "PATCH",
    body: {
      countryCode: str(formData, "countryCode"),
      city: optStr(formData, "city") ?? undefined,
      defaultCurrency: str(formData, "defaultCurrency"),
      timezone: str(formData, "timezone"),
    },
    pagePath: companyPage(companyId),
    okMessage: t("flash.localeUpdated"),
  });
}

export async function runRetentionPurge(formData: FormData) {
  const t = await getTranslations("platform");
  const dryRun = str(formData, "dryRun") === "true";
  const qs = dryRun ? "?dryRun=true" : "";
  await erpMutate({
    path: `/admin/retention/purge${qs}`,
    pagePath: "/platform/retention",
    okMessage: dryRun ? t("flash.retentionDryRun") : t("flash.retentionDone"),
  });
}
