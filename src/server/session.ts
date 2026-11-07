import { cookies } from "next/headers";
import type { Role } from "./accounts";
import { signToken, verifyToken } from "./signed-token";

export const SESSION_COOKIE = "udyam_session";
const HOURS = 8;

export interface Session {
  id: string;
  role: Role;
  name: string;
  city?: string;
  exp: number;
}

export function createSessionValue(s: Omit<Session, "exp">): string {
  return signToken({ ...s, exp: Date.now() + HOURS * 3_600_000 });
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: HOURS * 3600,
};

/** Current back-office session from the signed cookie, or undefined. Server only. */
export function getSession(): Session | undefined {
  const raw = cookies().get(SESSION_COOKIE)?.value;
  const s = raw ? verifyToken<Session>(raw) : undefined;
  return s && s.exp > Date.now() ? s : undefined;
}

/** For API routes: the session if it has one of the allowed roles. */
export function requireRole(...roles: Role[]): Session | undefined {
  const s = getSession();
  return s && roles.includes(s.role) ? s : undefined;
}
