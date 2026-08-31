"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api/server";

export async function updateCompanyLogo(companyId: string, formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const safeReturn =
    returnTo.startsWith(`/c/${companyId}`) ? returnTo : `/c/${companyId}`;
  const file = formData.get("logo");
  if (!(file instanceof Blob) || file.size === 0) {
    redirect(`${safeReturn}?error=${encodeURIComponent("Choose a logo image")}`);
  }
  if (file.size > 5 * 1024 * 1024) {
    redirect(`${safeReturn}?error=${encodeURIComponent("Logo must be smaller than 5MB")}`);
  }
  const named = file as Blob & { name?: string };
  const bytes = Buffer.from(await file.arrayBuffer());
  await apiServer(`/companies/${companyId}/logo`, {
    companyId,
    method: "PATCH",
    body: JSON.stringify({
      logoFileName: named.name || "logo.png",
      logoMimeType: file.type || "image/png",
      logoSizeBytes: String(bytes.length),
      logoContentBase64: bytes.toString("base64"),
    }),
  });
  revalidatePath(`/c/${companyId}`);
  revalidatePath(`/c/${companyId}/settings`);
  redirect(`${safeReturn}?ok=${encodeURIComponent("Company logo saved")}`);
}
