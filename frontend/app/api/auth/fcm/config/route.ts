import { NextResponse } from "next/server";
import { nestFetch } from "@/lib/api/client";

export async function GET() {
  try {
    const config = await nestFetch<{
      enabled: boolean;
      vapidKey: string | null;
      firebase: Record<string, string> | null;
    }>("/auth/fcm/config");
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ enabled: false, vapidKey: null, firebase: null });
  }
}
