import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { nestFetch, ApiError } from "@/lib/api/client";
import { setSessionCookies } from "@/lib/auth/session";
import type { LoginResponse } from "@/lib/types/auth";
import { isAppTheme, THEME_COOKIE } from "@/lib/theme";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      companyId?: string;
      companySlug?: string;
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

    await setSessionCookies({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    });

    if (isAppTheme(data.user.theme)) {
      const jar = await cookies();
      jar.set(THEME_COOKIE, data.user.theme, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message, payload: error.payload },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: "تعذر تسجيل الدخول" },
      { status: 500 },
    );
  }
}
