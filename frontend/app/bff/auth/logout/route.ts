import { after, NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";
import {
  clearSessionCookiesOn,
  getSession,
} from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  const refreshToken = session?.refreshToken;
  const res = NextResponse.json({ ok: true });
  // Clear cookies on the response so Set-Cookie reaches the browser.
  clearSessionCookiesOn(res);

  if (refreshToken) {
    after(async () => {
      try {
        await nestFetch("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // ignore backend logout errors
      }
    });
  }

  return res;
}
