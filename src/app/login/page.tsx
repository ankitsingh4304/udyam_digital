import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Accel Business" };

export default function LoginPage({ searchParams }: { searchParams: { next?: string; role?: string } }) {
  const s = getSession();
  // Same-site paths only ("//host" would leave the site).
  const next = searchParams.next && /^\/(?![\/\\])/.test(searchParams.next) ? searchParams.next : undefined;
  const role = searchParams.role === "admin" ? "admin" : searchParams.role === "partner" ? "partner" : undefined;
  const home = (r: string) => (r === "admin" ? "/admin" : "/partner");
  // Already signed in with the role this page asks for → go there. A partner opening /admin sees the
  // sign-in form (to switch account) instead of bouncing between the two pages.
  if (s && (!role || role === s.role)) redirect(next && next.startsWith(home(s.role)) ? next : home(s.role));
  return <LoginForm next={next} initialRole={role ?? "partner"} />;
}
