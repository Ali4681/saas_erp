export type AuthUser = {
  id: string;
  fullName: string;
  email: string | null;
  isPlatformAdmin: boolean;
  companyId?: string;
  roleCode?: string;
  permissions: string[];
  locale?: "ar" | "en";
  theme?: "light" | "dark";
};

export type LoginResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type SessionPayload = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};
