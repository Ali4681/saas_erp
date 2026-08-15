import { getSession } from "@/lib/auth/session";
import {
  decodeJwtPayload,
  userFromAccessToken,
} from "@/lib/auth/jwt-payload";

export { decodeJwtPayload, userFromAccessToken };

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return null;
  }
  return session;
}
