"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { apiServer } from "@/lib/api/server";

export async function updateServiceRequestStatus(
  requestId: string,
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED",
) {
  const pagePath = "/platform/service-requests";
  try {
    await apiServer(`/companies/service-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      redirect(`${pagePath}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(pagePath);
  redirect(`${pagePath}?ok=${encodeURIComponent("Updated")}`);
}
