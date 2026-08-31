import { resolveApiSession } from "@/lib/auth/resolve-api-session";
import { nestFetch, ApiError } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await context.params;
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ message: "companyId مطلوب" }, { status: 400 });
  }

  const session = await resolveApiSession();
  if (!session) {
    return NextResponse.json({ message: "غير مسجّل" }, { status: 401 });
  }

  try {
    const theme = req.nextUrl.searchParams.get("theme") ?? "MODERN";
    const pdf = await nestFetch<{
      fileName: string;
      mimeType: string;
      contentBase64: string;
    }>(
      `/companies/${companyId}/sales/quotes/${quoteId}/pdf?theme=${encodeURIComponent(theme)}`,
      {
        accessToken: session.accessToken,
        companyId,
      },
    );

    const bytes = Buffer.from(pdf.contentBase64, "base64");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": pdf.mimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.fileName || "quote.pdf"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "تعذّر تحميل PDF";
    const status = error instanceof ApiError ? error.status || 502 : 502;
    return NextResponse.json({ message }, { status });
  }
}
