import { NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";
import { clearSessionCookies, getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (session?.refreshToken) {
    try {
      await nestFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // ignore backend logout errors; still clear local cookies
    }
  }
  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
