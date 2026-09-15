import { NextResponse } from "next/server";
import { nestFetch, ApiError } from "@/lib/api/client";
import { applySessionCookies } from "@/lib/auth/session";
import { homePathFor, posHomePathFor } from "@/lib/permissions";
import type { LoginResponse } from "@/lib/types/auth";
import { isAppTheme, THEME_COOKIE } from "@/lib/theme";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      companyId?: string;
      companySlug?: string;
      /** `pos` → land on cashier terminal after auth */
      intent?: "pos" | "company";
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { message: "البريد وكلمة المرور مطلوبان" },
        { status: 400 },
      );
    }

    const data = await nestFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: body.email,
        password: body.password,
        ...(body.companyId ? { companyId: body.companyId } : {}),
        ...(body.companySlug ? { companySlug: body.companySlug } : {}),
      }),
    });

    if (data.user.isPlatformAdmin) {
      return NextResponse.json(
        {
          message:
            "حساب مدير المنصة — استخدم /admin/login لتسجيل الدخول",
        },
        { status: 403 },
      );
    }

    let landingPath =
      body.intent === "pos"
        ? posHomePathFor(data.user)
        : homePathFor(data.user);

    if (body.intent === "pos" && data.user.companyId) {
      const canPos = posHomePathFor(data.user).includes("/me/pos");
      if (!canPos) {
        return NextResponse.json(
          {
            message:
              "هذا الحساب لا يملك صلاحية نقطة البيع — استخدم تسجيل دخول الشركة",
          },
          { status: 403 },
        );
      }
    }

    if (data.user.companyId && body.intent !== "pos") {
      try {
        const status = await nestFetch<{
          onboarding: { completedAt: string | null };
        }>(`/companies/${data.user.companyId}/onboarding`, {
          accessToken: data.accessToken,
          companyId: data.user.companyId,
        });
        if (!status.onboarding.completedAt) {
          const role = data.user.roleCode;
          if (
            role !== "CASHIER" &&
            role !== "SALES_REP" &&
            role !== "POS_MARKETER" &&
            role !== "COMPANY_EMPLOYEE"
          ) {
            landingPath = `/c/${data.user.companyId}/onboarding`;
          }
        }
      } catch {
        // Keep home; company layout gate still applies on full load.
      }
    }

    const res = NextResponse.json({ user: data.user, landingPath });
    applySessionCookies(res, {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    });

    if (isAppTheme(data.user.theme)) {
      res.cookies.set(THEME_COOKIE, data.user.theme, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return res;
  } catch (error) {
    if (error instanceof ApiError) {
      const backendDown = error.status === 502 || error.status === 503;
      return NextResponse.json(
        {
          message: backendDown
            ? "خدمة الـ API غير متاحة. تأكد أن خادم Nest يعمل وأن NEXT_PUBLIC_API_BASE_URL يشير إليه."
            : error.message,
          payload: error.payload,
        },
        { status: backendDown ? 503 : error.status },
      );
    }
    return NextResponse.json(
      { message: "تعذر تسجيل الدخول" },
      { status: 500 },
    );
  }
}
