import type { ReactNode } from "react";
import type { AuthUser } from "@/lib/types/auth";
import { can } from "@/lib/permissions";

export function PermissionGate({
  user,
  permissions,
  any,
  children,
  fallback = null,
}: {
  user: AuthUser | null | undefined;
  permissions?: string[];
  any?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!permissions?.length) {
    return <>{children}</>;
  }
  const ok = any
    ? permissions.some((p) => can(user, p))
    : can(user, ...permissions);
  return ok ? <>{children}</> : <>{fallback}</>;
}
