import { after, NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";
import { clearSessionCookies, getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  const refreshToken = session?.refreshToken;
  // Clear cookies first so the client can navigate immediately.
  await clearSessionCookies();

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

  return NextResponse.json({ ok: true });
}
