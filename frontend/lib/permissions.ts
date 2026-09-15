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
  B2B_ACCOUNT_MANAGER: "مدير حسابات شركات",
  CASHIER: "كاشير",
  SALES_REP: "مندوب مبيعات",
  POS_MARKETER: "مسوق",
  POS_SUPERVISOR: "مشرف كاشير",
  SHIFT_SUPERVISOR: "مشرف وردية",
  MARKETING_SPECIALIST: "أخصائي تسويق",
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
  B2B_ACCOUNT_MANAGER: "B2B account manager",
  CASHIER: "Cashier",
  SALES_REP: "Sales rep",
  POS_MARKETER: "Marketer",
  POS_SUPERVISOR: "POS supervisor",
  SHIFT_SUPERVISOR: "Shift supervisor",
  MARKETING_SPECIALIST: "Marketing specialist",
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

/** Regular employee self-service role (not HR admin). */
export function isCompanyEmployee(user: AuthUser | null | undefined): boolean {
  return roleKey(user) === "COMPANY_EMPLOYEE";
}

/** Roles that use the employee portal + POS only (not full ERP). */
export const POS_PORTAL_ROLE_CODES = [
  "CASHIER",
  "SALES_REP",
  "POS_MARKETER",
] as const;

export function isPosPortalRoleCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const upper = code.toUpperCase();
  if ((POS_PORTAL_ROLE_CODES as readonly string[]).includes(upper)) {
    return true;
  }
  // Company-prefixed custom clones e.g. C019FD70C_CASHIER
  return POS_PORTAL_ROLE_CODES.some(
    (r) => upper.endsWith(`_${r}`) || upper === r,
  );
}

/** Dedicated cashier / POS portal roles — employee portal + POS access. */
export function isCashierPortalUser(user: AuthUser | null | undefined): boolean {
  return isPosPortalRoleCode(roleKey(user));
}

/** Fine-grained POS ops (or full sales.write). */
export const POS_ROLE_OPS = [
  "pos.invoice_create",
  "pos.quick_invoice",
  "pos.quote_create",
  "pos.quote_delete",
  "pos.quote_convert",
  "pos.invoice_send_whatsapp",
  "pos.quote_send_whatsapp",
] as const;

export function canAccessPos(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  return can(user, "sales.write") || canAny(user, ...POS_ROLE_OPS);
}

export function employeePortalBase(companyId: string): string {
  return `/c/${companyId}/me`;
}

export function isEmployeePortalPath(
  pathname: string,
  companyId: string,
): boolean {
  const base = employeePortalBase(companyId);
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Who may open employee-portal routes under `/c/{id}/me/*`.
 * - COMPANY_EMPLOYEE: full self-service portal
 * - CASHIER / SALES_REP / POS_MARKETER: full self-service portal + POS
 * - sales.write or pos.* (non-portal): POS terminal (+ customer display) only
 */
export function canUseEmployeePortalPath(
  user: AuthUser | null | undefined,
  pathname: string,
  companyId: string,
): boolean {
  if (!user || !isEmployeePortalPath(pathname, companyId)) return false;
  if (user.isPlatformAdmin) return true;
  if (isCompanyEmployee(user) || isCashierPortalUser(user)) return true;

  const base = employeePortalBase(companyId);
  const posBase = `${base}/pos`;
  const onPos =
    pathname === posBase || pathname.startsWith(`${posBase}/`);
  if (!onPos) return false;

  return canAccessPos(user);
}

/** Default landing after company login (not POS-specific). */
export function homePathFor(user: AuthUser): string {
  if (user.isPlatformAdmin) {
    return "/platform";
  }
  if (user.companyId) {
    if (isCashierPortalUser(user) || isCompanyEmployee(user)) {
      return employeePortalBase(user.companyId);
    }
    return `/c/${user.companyId}`;
  }
  return "/login";
}

/** Landing after dedicated cashier POS login. */
export function posHomePathFor(user: AuthUser): string {
  if (user.companyId && (isCashierPortalUser(user) || canAccessPos(user))) {
    return `${employeePortalBase(user.companyId)}/pos`;
  }
  return homePathFor(user);
}
