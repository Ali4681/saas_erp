import { getSession } from "@/lib/auth/session";
import type { AuthUser } from "@/lib/types/auth";

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const json =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export function userFromAccessToken(
  accessToken: string,
  previous?: AuthUser | null,
): AuthUser {
  const payload = decodeJwtPayload(accessToken);
  return {
    id: String(payload.sub ?? previous?.id ?? ""),
    fullName: previous?.fullName ?? String(payload.email ?? "مستخدم"),
    email:
      (payload.email as string | null | undefined) ?? previous?.email ?? null,
    isPlatformAdmin: Boolean(payload.isPlatformAdmin),
    companyId: (payload.companyId as string | undefined) ?? previous?.companyId,
    companyName: previous?.companyName ?? null,
    logoAttachmentId: previous?.logoAttachmentId ?? null,
    roleCode: (payload.roleCode as string | undefined) ?? previous?.roleCode,
    permissions: Array.isArray(payload.permissions)
      ? (payload.permissions as string[])
      : (previous?.permissions ?? []),
    locale: previous?.locale,
    theme: previous?.theme,
  };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return session;
}
