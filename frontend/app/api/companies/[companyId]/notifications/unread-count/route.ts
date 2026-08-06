import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;

  try {
    const unread = await apiServer<{ count: number }>(
      `/companies/${companyId}/notifications/unread-count`,
      { companyId },
    );
    return NextResponse.json(unread);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "تعذّر تحميل عدد الإشعارات";
    return NextResponse.json({ message }, { status });
  }
}
