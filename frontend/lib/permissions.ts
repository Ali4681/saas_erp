import type { AuthUser } from "@/lib/types/auth";

/** i18n key under `roles.*` (or guest/user). */
export function roleKey(user: AuthUser | null | undefined): string {
  if (!user) return "guest";
  const code =
    user.roleCode ??
    (user.isPlatformAdmin ? "PLATFORM_SUPER_ADMIN" : undefined);
  if (!code) return "user";
  return code;
}

/** Fallback Arabic labels when translations are unavailable. */
const ROLE_LABELS_AR: Record<string, string> = {
  PLATFORM_SUPER_ADMIN: "مدير المنصة",
  COMPANY_OWNER: "مالك الشركة",
  COMPANY_ADMIN: "مدير الشركة",
  ACCOUNTANT: "محاسب",
  OPERATIONS_MANAGER: "مدير العمليات",
  EMPLOYEE_VIEWER: "موظف / مشاهدة",
  COMPANY_EMPLOYEE: "موظف (خدمة ذاتية)",
  guest: "زائر",
  user: "مستخدم",
};

const ROLE_LABELS_EN: Record<string, string> = {
  PLATFORM_SUPER_ADMIN: "Platform admin",
  COMPANY_OWNER: "Company owner",
  COMPANY_ADMIN: "Company admin",
  ACCOUNTANT: "Accountant",
  OPERATIONS_MANAGER: "Operations manager",
  EMPLOYEE_VIEWER: "Employee / viewer",
  COMPANY_EMPLOYEE: "Employee (self-service)",
  guest: "Guest",
  user: "User",
};

export function roleLabel(
  user: AuthUser | null | undefined,
  locale?: "en" | "ar",
): string {
  const key = roleKey(user);
  if (locale === "en") {
    return ROLE_LABELS_EN[key] ?? key;
  }
  return ROLE_LABELS_AR[key] ?? key;
}

export function can(
  user: AuthUser | null | undefined,
  ...required: string[]
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  if (!required.length) return true;
  const set = new Set(user.permissions ?? []);
  return required.every((code) => set.has(code));
}

export function canAny(
  user: AuthUser | null | undefined,
  ...required: string[]
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  const set = new Set(user.permissions ?? []);
  return required.some((code) => set.has(code));
}

export function homePathFor(user: AuthUser): string {
  if (user.isPlatformAdmin) {
    return "/platform";
  }
  if (user.companyId) {
    return `/c/${user.companyId}`;
  }
  return "/login";
}
