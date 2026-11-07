import { NextResponse } from "next/server";
import { z } from "zod";
import { findAccount } from "@/server/accounts";
import { rateLimit } from "@/server/rate-limit";
import { SESSION_COOKIE, createSessionValue, sessionCookieOptions } from "@/server/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const limited = rateLimit(req, "login", 30);
  if (limited) return limited;
  const parsed = z.object({ id: z.string().max(20), pin: z.string().max(12) }).safeParse(await req.json().catch(() => null));
  const acc = parsed.success ? findAccount(parsed.data.id, parsed.data.pin) : undefined;
  if (!acc) return NextResponse.json({ error: "Wrong ID or PIN." }, { status: 401 });
  const res = NextResponse.json({ role: acc.role, name: acc.name, home: acc.role === "admin" ? "/admin" : "/partner" });
  res.cookies.set(SESSION_COOKIE, createSessionValue({ id: acc.id, role: acc.role, name: acc.name, city: acc.city }), sessionCookieOptions);
  return res;
}
