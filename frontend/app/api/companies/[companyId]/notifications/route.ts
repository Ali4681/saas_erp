import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  const limit = new URL(req.url).searchParams.get("limit") ?? "15";

  try {
    const notifications = await apiServer<unknown[]>(
      `/companies/${companyId}/notifications?limit=${encodeURIComponent(limit)}`,
      { companyId },
    );
    return NextResponse.json(notifications);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "تعذّر تحميل الإشعارات";
    return NextResponse.json({ message }, { status });
  }
}
