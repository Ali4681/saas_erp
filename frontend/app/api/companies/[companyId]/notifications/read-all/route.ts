import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";

export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;

  try {
    const result = await apiServer<{ updated: number }>(
      `/companies/${companyId}/notifications/read-all`,
      { companyId, method: "PATCH" },
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "تعذّر تعليم الإشعارات كمقروءة";
    return NextResponse.json({ message }, { status });
  }
}
