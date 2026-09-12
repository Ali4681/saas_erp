import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";
import type { PosBootstrap } from "@/app/c/[companyId]/me/pos/actions";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await ctx.params;
  const url = new URL(req.url);
  const pointOfSaleId = url.searchParams.get("pointOfSaleId")?.trim();
  const q = pointOfSaleId
    ? `?pointOfSaleId=${encodeURIComponent(pointOfSaleId)}`
    : "";

  try {
    const data = await apiServer<PosBootstrap>(
      `/companies/${companyId}/sales/pos/terminal/bootstrap${q}`,
      { companyId },
    );
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Failed to load POS terminal";
    return NextResponse.json({ message }, { status });
  }
}
