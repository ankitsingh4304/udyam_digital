import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { AdminApp } from "./AdminApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operations · Accel Business" };

export default function AdminPage() {
  const s = getSession();
  if (!s || s.role !== "admin") redirect("/login?next=/admin&role=admin");
  return <AdminApp user={{ id: s.id, role: s.role, name: s.name }} />;
}
