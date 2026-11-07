import { notFound } from "next/navigation";
import type { OrderPayload } from "@/domain/orders/tracker";
import { verifyToken } from "@/server/signed-token";
import { TrackView } from "./TrackView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order status · Accel Business" };

/** The signed token is verified on the server; the page then renders and refreshes on the phone. */
export default function TrackPage({ params }: { params: { token: string } }) {
  const order = verifyToken<OrderPayload>(decodeURIComponent(params.token));
  if (!order || order.v !== 1) notFound();
  return <TrackView order={order} />;
}
