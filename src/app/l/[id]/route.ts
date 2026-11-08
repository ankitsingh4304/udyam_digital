import { NextResponse } from "next/server";
import { resolveLink } from "@/server/shortlink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const path = /^[A-Za-z0-9_-]{8}$/.test(params.id) ? await resolveLink(params.id) : undefined;
  if (!path || !path.startsWith("/")) return new NextResponse("Link not found", { status: 404 });
  return NextResponse.redirect(new URL(path, req.url), 302);
}
