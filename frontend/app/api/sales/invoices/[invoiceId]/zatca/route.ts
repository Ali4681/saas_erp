import { getSession } from "@/lib/auth/session";
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

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "غير مسجّل" }, { status: 401 });
  }

  try {
    const doc = await nestFetch<Record<string, unknown>>(
      `/companies/${companyId}/sales/invoices/${invoiceId}/zatca`,
      {
        accessToken: session.accessToken,
        companyId,
      },
    );
    return NextResponse.json(doc);
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : "تعذّر إنشاء فاتورة الزكاة";
    return NextResponse.json({ message }, { status: 502 });
  }
}
