import { NextResponse } from "next/server";
import { nestFetch, ApiError } from "@/lib/api/client";
import {
  applySessionCookies,
  clearSessionCookiesOn,
  getSession,
} from "@/lib/auth/session";
import { userFromAccessToken } from "@/lib/auth/jwt";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.refreshToken) {
      return NextResponse.json({ message: "لا توجد جلسة" }, { status: 401 });
    }

    const tokens = await nestFetch<{
      accessToken: string;
      refreshToken: string;
      expiresAt: string;
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    const user = userFromAccessToken(tokens.accessToken, session.user);
    const res = NextResponse.json({ user });
    applySessionCookies(res, {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
    return res;
  } catch (error) {
    const res =
      error instanceof ApiError
        ? NextResponse.json(
            { message: error.message },
            { status: error.status },
          )
        : NextResponse.json({ message: "فشل تجديد الجلسة" }, { status: 500 });
    clearSessionCookiesOn(res);
    return res;
  }
}
