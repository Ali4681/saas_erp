import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";

export async function PATCH(
  _req: Request,
  ctx: {
    params: Promise<{ companyId: string; notificationId: string }>;
  },
) {
  const { companyId, notificationId } = await ctx.params;

  try {
    const notification = await apiServer<unknown>(
      `/companies/${companyId}/notifications/${notificationId}/read`,
      { companyId, method: "PATCH" },
    );
    return NextResponse.json(notification);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "تعذّر تعليم الإشعار كمقروء";
    return NextResponse.json({ message }, { status });
  }
}
