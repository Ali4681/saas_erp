import { readSessionFromCookies } from "@/lib/auth/session";
import {
  applyResolvedSessionCookies,
  resolveApiSession,
} from "@/lib/auth/resolve-api-session";
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

  // Prefer plain cookie read for hot image traffic; fall back to refresh once.
  let resolved = {
    session: await readSessionFromCookies(),
    cookieSession: null as Awaited<
      ReturnType<typeof resolveApiSession>
    >["cookieSession"],
  };
  if (!resolved.session) {
    resolved = await resolveApiSession();
  }
  if (!resolved.session) {
    return NextResponse.json({ message: "غير مسجّل" }, { status: 401 });
  }

  try {
    const file = await nestFetch<{
      fileName: string;
      mimeType: string;
      contentBase64?: string;
    }>(`/companies/${companyId}/attachments/${attachmentId}`, {
      accessToken: resolved.session.accessToken,
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
    return applyResolvedSessionCookies(
      new NextResponse(bytes, {
        headers: {
          "Content-Type": file.mimeType || "application/octet-stream",
          "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.fileName || "file"}"`,
          "Cache-Control": "private, max-age=3600",
        },
      }),
      resolved,
    );
  } catch (error) {
    // One refresh+retry on auth failure (short-lived access cookie).
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await resolveApiSession();
      if (refreshed.session) {
        try {
          const file = await nestFetch<{
            fileName: string;
            mimeType: string;
            contentBase64?: string;
          }>(`/companies/${companyId}/attachments/${attachmentId}`, {
            accessToken: refreshed.session.accessToken,
            companyId,
          });
          if (file.contentBase64) {
            const bytes = Buffer.from(file.contentBase64, "base64");
            const inline =
              req.nextUrl.searchParams.get("inline") === "1" ||
              (file.mimeType || "").startsWith("image/");
            return applyResolvedSessionCookies(
              new NextResponse(bytes, {
                headers: {
                  "Content-Type": file.mimeType || "application/octet-stream",
                  "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.fileName || "file"}"`,
                  "Cache-Control": "private, max-age=3600",
                },
              }),
              refreshed,
            );
          }
        } catch {
          /* fall through */
        }
      }
    }

    const status = error instanceof ApiError ? error.status || 502 : 502;
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "تعذّر التحميل";
    return applyResolvedSessionCookies(
      NextResponse.json({ message }, { status }),
      resolved,
    );
  }
}
