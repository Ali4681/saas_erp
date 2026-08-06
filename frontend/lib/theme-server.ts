import { cookies } from "next/headers";
import {
  defaultTheme,
  isAppTheme,
  THEME_COOKIE,
  type AppTheme,
} from "@/lib/theme";

/** Server-side theme from cookie. */
export async function getAppTheme(): Promise<AppTheme> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  return isAppTheme(raw) ? raw : defaultTheme;
}
