import {
  applyResolvedSessionCookies,
  resolveApiSession,
} from "@/lib/auth/resolve-api-session";
import { nestFetch, ApiError } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await context.params;
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ message: "companyId مطلوب" }, { status: 400 });
  }

  const resolved = await resolveApiSession();
  if (!resolved?.session) {
    return applyResolvedSessionCookies(
      NextResponse.json({ message: "غير مسجّل" }, { status: 401 }),
      resolved,
    );
  }

  try {
    const theme = req.nextUrl.searchParams.get("theme") ?? "MODERN";
    const format = req.nextUrl.searchParams.get("format") ?? "A4";
    const noQr = req.nextUrl.searchParams.get("noQr") === "1";
    const download = req.nextUrl.searchParams.get("download") === "1";
    const pdf = await nestFetch<{
      fileName: string;
      mimeType: string;
      contentBase64: string;
    }>(
      `/companies/${companyId}/sales/invoices/${invoiceId}/pdf?theme=${encodeURIComponent(theme)}&format=${encodeURIComponent(format)}&noQr=${noQr ? "1" : "0"}`,
      {
        accessToken: resolved.session.accessToken,
        companyId,
      },
    );

    const bytes = Buffer.from(pdf.contentBase64, "base64");
    const fileName = pdf.fileName || "invoice.pdf";
    return applyResolvedSessionCookies(
      new NextResponse(bytes, {
        headers: {
          "Content-Type": pdf.mimeType || "application/pdf",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
        },
      }),
      resolved,
    );
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "تعذّر تحميل PDF";
    const status = error instanceof ApiError ? error.status || 502 : 502;
    return applyResolvedSessionCookies(
      NextResponse.json({ message }, { status }),
      resolved,
    );
  }
}
