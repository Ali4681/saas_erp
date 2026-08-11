/** Next.js BFF auth routes — must NOT share `/api/*` with Nest behind Nginx. */
export const BFF_AUTH = {
  login: "/bff/auth/login",
  adminLogin: "/bff/auth/admin-login",
  logout: "/bff/auth/logout",
  refresh: "/bff/auth/refresh",
  me: "/bff/auth/me",
  fcmConfig: "/bff/auth/fcm/config",
  fcmRegister: "/bff/auth/fcm/register",
} as const;
