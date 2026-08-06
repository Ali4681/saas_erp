export const themes = ["light", "dark"] as const;
export type AppTheme = (typeof themes)[number];
export const defaultTheme: AppTheme = "light";
export const THEME_COOKIE = "NEXT_THEME";

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

/** Apply `dark` class on `<html>` for immediate client updates. */
export function applyThemeClass(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Persist theme cookie (and user preference when logged in). */
export async function persistTheme(theme: AppTheme) {
  applyThemeClass(theme);
  await fetch("/api/theme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme }),
  });
}

/** Client-side theme from document cookie. */
export function readThemeFromDocument(): AppTheme {
  if (typeof document === "undefined") return defaultTheme;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`),
  );
  const raw = match ? decodeURIComponent(match[1]) : null;
  return isAppTheme(raw) ? raw : defaultTheme;
}
