"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { erpMutate } from "@/lib/erp/mutate";
import { optStr, str } from "@/lib/erp/form";

function page(companyId: string) {
  return `/c/${companyId}/attachments`;
}

export async function uploadAttachment(companyId: string, formData: FormData) {
  const t = await getTranslations("attachments");
  const file = formData.get("file");
  let fileName = str(formData, "fileName");
  let mimeType = optStr(formData, "mimeType") ?? "application/octet-stream";
  let sizeBytes = optStr(formData, "sizeBytes") ?? "0";
  let contentBase64: string | undefined;

  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    contentBase64 = buf.toString("base64");
    fileName = file.name || fileName;
    mimeType = file.type || mimeType;
    sizeBytes = String(file.size);
  }

  if (!fileName || !contentBase64) {
    redirect(
      `${page(companyId)}?error=${encodeURIComponent(t("flash.chooseFile"))}`,
    );
  }

  await erpMutate({
    companyId,
    path: `/companies/${companyId}/attachments`,
    body: {
      entityType: str(formData, "entityType"),
      entityId: str(formData, "entityId"),
      fileName,
      mimeType,
      sizeBytes,
      contentBase64,
      checksumSha256: optStr(formData, "checksumSha256"),
    },
    pagePath: page(companyId),
    okMessage: t("flash.uploaded"),
  });
}
