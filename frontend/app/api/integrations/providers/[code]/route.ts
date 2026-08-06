import { NextResponse } from "next/server";
import { apiServer } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";
import type { IntegrationProviderDetail } from "@/lib/integrations";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  try {
    const provider = await apiServer<IntegrationProviderDetail>(
      `/integrations/providers/${encodeURIComponent(code)}`,
    );
    return NextResponse.json(provider);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "تعذّر تحميل بيانات الشركة";
    return NextResponse.json({ message }, { status });
  }
}
