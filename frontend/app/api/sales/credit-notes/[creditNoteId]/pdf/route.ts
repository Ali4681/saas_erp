import { getSession } from "@/lib/auth/session";
import { nestFetch, ApiError } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ creditNoteId: string }> },
) {
  const { creditNoteId } = await context.params;
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ message: "companyId مطلوب" }, { status: 400 });
  }

  const session = await getSession();
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
      `/companies/${companyId}/sales/credit-notes/${creditNoteId}/pdf?theme=${encodeURIComponent(theme)}`,
      {
        accessToken: session.accessToken,
        companyId,
      },
    );

    const bytes = Buffer.from(pdf.contentBase64, "base64");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": pdf.mimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.fileName || "credit-note.pdf"}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "تعذّر تحميل PDF";
    return NextResponse.json({ message }, { status: 502 });
  }
}
