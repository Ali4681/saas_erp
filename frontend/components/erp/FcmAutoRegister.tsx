"use client";

import { useEffect, useRef } from "react";
import { registerFcmDevice } from "@/lib/fcm/client";

export function FcmAutoRegister({ companyId }: { companyId?: string }) {
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const key = companyId ?? "platform";
    if (lastKey.current === key) return;
    lastKey.current = key;

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void registerFcmDevice(companyId).catch(() => {
        // FCM is optional when Firebase web config is missing.
      });
    };

    // Don't compete with first navigation / paint.
    const idle = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    if (typeof idle === "function") {
      const id = idle(run, { timeout: 4000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const t = setTimeout(run, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [companyId]);

  return null;
}
