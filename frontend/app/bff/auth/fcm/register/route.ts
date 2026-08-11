import { NextResponse } from "next/server";
import { nestFetch, ApiError } from "@/lib/api/client";
import { getSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "غير مصرح" }, { status: 401 });
    }

    const body = (await request.json()) as {
      token?: string;
      platform?: string;
      deviceName?: string;
      companyId?: string;
    };

    if (!body.token || !body.platform) {
      return NextResponse.json(
        { message: "token و platform مطلوبان" },
        { status: 400 },
      );
    }

    const device = await nestFetch("/auth/fcm/register", {
      method: "POST",
      accessToken: session.accessToken,
      companyId: body.companyId ?? session.user.companyId ?? null,
      body: JSON.stringify({
        token: body.token,
        platform: body.platform,
        deviceName: body.deviceName,
        companyId: body.companyId,
      }),
    });

    return NextResponse.json(device);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { message: error.message, payload: error.payload },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: "تعذر تسجيل جهاز FCM" },
      { status: 500 },
    );
  }
}
