"use client";

import { useEffect, useRef } from "react";
import { registerFcmDevice } from "@/lib/fcm/client";

export function FcmAutoRegister({ companyId }: { companyId?: string }) {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const key = companyId ?? "platform";
    if (lastKey.current === key) return;
    lastKey.current = key;

    void registerFcmDevice(companyId).catch(() => {
      // FCM is optional when Firebase web config is missing.
    });
  }, [companyId]);

  return null;
}
