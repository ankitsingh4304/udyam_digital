import Link from "next/link";
import { notFound } from "next/navigation";
import { milestones, promisedBy, type OrderPayload } from "@/domain/orders/tracker";
import { verifyToken } from "@/server/signed-token";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order status · Accel Business" };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const DOT: Record<string, string> = { done: "bg-ok border-ok", current: "bg-white border-khata", upcoming: "bg-white border-rule" };

export default function TrackPage({ params, searchParams }: { params: { token: string }; searchParams: { lang?: string } }) {
  const order = verifyToken<OrderPayload>(decodeURIComponent(params.token));
  if (!order || order.v !== 1) notFound();
  const lang = searchParams.lang === "hi" || searchParams.lang === "hinglish" ? searchParams.lang : "en";
  const steps = milestones(order, new Date(), lang);
  const live = steps.every((s) => s.status === "done");
  const current = steps.find((s) => s.status === "current");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 lg:py-10">
      <AutoRefresh seconds={live ? 0 : 10} />
      <p className="text-sm text-ink-soft">
        Order {order.id} · {order.business}
      </p>
      <h1 className="mt-1 text-3xl font-bold">{live ? "Your business is live" : `Next: ${current?.title}`}</h1>
      <p className="mt-1 text-ink-soft">
        {live ? "All services are active." : `Everything active by ${promisedBy(order)}. You don't need to call; this page updates by itself.`}
      </p>
      <nav className="mt-3 flex gap-3 text-sm" aria-label="Language">
        {(["en", "hi", "hinglish"] as const).map((l) => (
          <Link key={l} href={`?lang=${l}`} className={l === lang ? "font-bold" : "text-ink-soft underline underline-offset-4"}>
            {l === "en" ? "English" : l === "hi" ? "हिंदी" : "Hinglish"}
          </Link>
        ))}
      </nav>

      <ol className="mt-8">
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex gap-4 pb-8 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className={`absolute left-[11px] top-6 h-full w-0.5 ${s.status === "done" ? "bg-ok" : "bg-rule"}`} />}
            <span aria-hidden className={`relative z-10 mt-0.5 h-6 w-6 shrink-0 rounded-full border-[3px] ${DOT[s.status]}`} />
            <div>
              <p className={`font-bold ${s.status === "upcoming" ? "text-ink-soft" : ""}`}>
                {s.title}
                <span className="sr-only"> ({s.status})</span>
              </p>
              <p className="text-sm text-ink-soft">{s.at}</p>
              <p className="mt-1 text-[15px]">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-10 rounded-2xl border border-rule bg-white p-5">
        <h2 className="font-bold">Your bundle</h2>
        <ul className="mt-2 divide-y divide-rule text-[15px]">
          {order.lines.map((l) => (
            <li key={l.productId} className="flex justify-between py-1.5">
              <span>{l.name}</span>
              <span className="text-ink-soft">×{l.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-baseline justify-between">
          <span className="text-ink-soft">One monthly bill</span>
          <span className="text-2xl font-bold text-khata">{inr(order.monthly)}</span>
        </p>
        <p className="text-sm text-ink-soft">
          {order.setup ? `${inr(order.setup)} one-time setup · ` : ""}
          {order.contractMonths}-month contract
        </p>
      </section>
      {order.speed > 1 && <p className="mt-4 text-xs text-ink-soft">Demo mode: one day of progress passes every minute so you can watch the whole journey.</p>}
    </main>
  );
}
