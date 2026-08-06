import { after, NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session";
import {
  defaultTheme,
  isAppTheme,
  THEME_COOKIE,
  type AppTheme,
} from "@/lib/theme";

export async function POST(request: Request) {
  let theme: AppTheme = defaultTheme;
  try {
    const body = (await request.json()) as { theme?: unknown };
    if (isAppTheme(body.theme)) theme = body.theme;
  } catch {
    theme = defaultTheme;
  }

  const session = await getSession();
  if (session) {
    const accessToken = session.accessToken;
    const nextTheme = theme;
    after(async () => {
      try {
        await nestFetch("/auth/me/theme", {
          method: "PATCH",
          accessToken,
          body: JSON.stringify({ theme: nextTheme }),
        });
      } catch {
        // Preference cookie already set; DB sync is best-effort
      }
    });
  }

  const res = NextResponse.json({ theme });
  res.cookies.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}
