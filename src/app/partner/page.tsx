import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { PartnerApp } from "./PartnerApp";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner portal · Accel Business" };

export default function PartnerPage() {
  const s = getSession();
  if (!s) redirect("/login?next=/partner&role=partner");
  return <PartnerApp user={{ id: s.id, role: s.role, name: s.name, city: s.city }} />;
}
