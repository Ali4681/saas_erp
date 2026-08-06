import { getSession } from "@/lib/auth/session";
import { nestFetch, ApiError } from "@/lib/api/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await context.params;
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ message: "companyId مطلوب" }, { status: 400 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "غير مسجّل" }, { status: 401 });
  }

  try {
    const file = await nestFetch<{
      fileName: string;
      mimeType: string;
      contentBase64?: string;
    }>(`/companies/${companyId}/attachments/${attachmentId}`, {
      accessToken: session.accessToken,
      companyId,
    });

    if (!file.contentBase64) {
      return NextResponse.json(
        { message: "لا يوجد محتوى قابل للتحميل" },
        { status: 404 },
      );
    }

    const bytes = Buffer.from(file.contentBase64, "base64");
    const inline =
      req.nextUrl.searchParams.get("inline") === "1" ||
      (file.mimeType || "").startsWith("image/");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.fileName || "file"}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "تعذّر التحميل";
    return NextResponse.json({ message }, { status: 502 });
  }
}
