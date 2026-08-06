"use client";

type FcmConfig = {
  enabled: boolean;
  vapidKey: string | null;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    messagingSenderId: string;
    appId: string;
  } | null;
};

let registerPromise: Promise<boolean> | null = null;

async function loadConfig(): Promise<FcmConfig | null> {
  try {
    const res = await fetch("/api/auth/fcm/config", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as FcmConfig;
  } catch {
    return null;
  }
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration(
    "/firebase-messaging-sw.js",
  );
  if (existing) return existing;
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
  });
}

export async function obtainFcmToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;

  const config = await loadConfig();
  if (!config?.enabled || !config.firebase || !config.vapidKey) {
    return null;
  }

  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import(
    "firebase/messaging"
  );

  if (!(await isSupported())) return null;

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await ensureServiceWorker();
  if (!registration) return null;
  await navigator.serviceWorker.ready;

  const app = getApps().length
    ? getApps()[0]
    : initializeApp(config.firebase);
  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: config.vapidKey,
    serviceWorkerRegistration: registration,
  });

  return token || null;
}

export async function registerFcmDevice(companyId?: string): Promise<boolean> {
  if (registerPromise) return registerPromise;

  registerPromise = (async () => {
    const token = await obtainFcmToken();
    if (!token) return false;

    const res = await fetch("/api/auth/fcm/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: "WEB",
        deviceName:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 120)
            : "Web",
        ...(companyId ? { companyId } : {}),
      }),
    });

    return res.ok;
  })().finally(() => {
    registerPromise = null;
  });

  return registerPromise;
}
