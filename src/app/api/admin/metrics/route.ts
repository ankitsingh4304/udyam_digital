import { NextResponse } from "next/server";
import { adminMetrics } from "@/server/admin-metrics";
import { requireRole } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!requireRole("admin")) return NextResponse.json({ error: "Operations sign-in required." }, { status: 401 });
  return NextResponse.json(adminMetrics());
}
