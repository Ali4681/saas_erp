import { NextResponse } from "next/server";
import { nestFetch, ApiError } from "@/lib/api/client";
import { applySessionCookies } from "@/lib/auth/session";
import type { LoginResponse } from "@/lib/types/auth";
import { isAppTheme, THEME_COOKIE } from "@/lib/theme";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
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
      }),
    });

    if (!data.user.isPlatformAdmin) {
      return NextResponse.json(
        {
          message:
            "هذا الحساب ليس لمدير المنصة. استخدم صفحة دخول الشركات.",
        },
        { status: 403 },
      );
    }

    const res = NextResponse.json({ user: data.user });
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
