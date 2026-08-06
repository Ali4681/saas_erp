"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";

type MutateOptions = {
  companyId?: string | null;
  path: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Path to revalidate and redirect back to on success/error */
  pagePath: string;
  okMessage?: string;
};

export async function erpMutate(opts: MutateOptions): Promise<void> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "common" });

  try {
    await apiServer(opts.path, {
      method: opts.method ?? "POST",
      companyId: opts.companyId,
      body:
        opts.body === undefined
          ? undefined
          : typeof opts.body === "string"
            ? opts.body
            : JSON.stringify(opts.body),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const message =
        error.status === 403
          ? t("forbiddenWithDetail", { detail: error.message })
          : error.message;
      redirect(`${opts.pagePath}?error=${encodeURIComponent(message)}`);
    }
    throw error;
  }

  revalidatePath(opts.pagePath);
  const msg = encodeURIComponent(opts.okMessage ?? t("savedSuccessfully"));
  redirect(`${opts.pagePath}?ok=${msg}`);
}
