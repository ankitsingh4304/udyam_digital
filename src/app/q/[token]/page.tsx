import { notFound } from "next/navigation";
import { verifyToken } from "@/server/signed-token";
import { ContinueFromChat } from "./ContinueFromChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Continue · Accel Business" };

/** Signed link from the WhatsApp chat: opens the document check with the quote already filled in. */
export default function QuoteLink({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  const q = verifyToken<{ v: 1; profile: unknown; cart: { productId: string; quantity: number }[]; lang?: string; waRef?: string }>(token);
  if (!q || q.v !== 1 || !Array.isArray(q.cart)) notFound();
  return <ContinueFromChat quote={{ profile: q.profile, cart: q.cart }} lang={q.lang} waToken={q.waRef ? token : undefined} />;
}
