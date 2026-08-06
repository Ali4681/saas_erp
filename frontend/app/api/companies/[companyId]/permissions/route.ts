import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  try {
    const permissions = await apiServer<unknown[]>(
      `/companies/${companyId}/permissions`,
      { companyId },
    ).catch(() =>
      apiServer<unknown[]>(`/permissions`, { companyId }),
    );
    return NextResponse.json(permissions);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "تعذّر تحميل الصلاحيات";
    return NextResponse.json({ message }, { status });
  }
}
