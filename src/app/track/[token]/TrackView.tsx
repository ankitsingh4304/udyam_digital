"use client";

import { fromPacks } from "@/i18n/packs";
import { AlertTriangle, CheckCircle2, CircleDot, Circle, Phone, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/components/LangContext";
import type { Lang } from "@/domain/advisor/state";
import { milestones, promisedBy, type OrderEvent, type OrderPayload } from "@/domain/orders/tracker";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const T: Record<Lang, Record<string, string>> = {
  en: { order: "Order", live: "Your business is live!", liveSub: "All services are active.", next: "Next:", by: "Everything active by", noCall: "No need to call. This page updates by itself.", bundle: "Your bundle", bill: "One monthly bill", setup: "one-time setup", contract: "-month contract", share: "Share this page", help: "Need help? Call 1800-000-0000", demo: "Demo: one day of progress passes every minute so you can watch the whole journey.", delayed: "Delayed", newDate: "New date", ops: "Updated by Accel operations", sorry: "Sorry for the delay. We have moved your date; no need to call.", data: "Your data", dataSub: "Download everything we hold about this order, or ask us to delete it. Document photos are never kept.", download: "Download my data", erase: "Ask to delete my data", erased: "Deletion request recorded. We erase everything except what telecom rules require us to keep." },
  hi: { order: "ऑर्डर", live: "आपका बिज़नेस चालू है!", liveSub: "सभी सेवाएँ चालू हैं।", next: "अगला:", by: "सब चालू होगा", noCall: "कॉल करने की ज़रूरत नहीं। यह पेज खुद अपडेट होता है।", bundle: "आपका बंडल", bill: "एक मासिक बिल", setup: "एक बार का सेटअप", contract: " महीने का कॉन्ट्रैक्ट", share: "यह पेज शेयर करें", help: "मदद चाहिए? 1800-000-0000 पर कॉल करें", demo: "डेमो: हर मिनट एक दिन की प्रगति होती है।", delayed: "देरी", newDate: "नई तारीख", ops: "Accel ऑपरेशंस द्वारा अपडेट", sorry: "देरी के लिए माफ़ी। आपकी तारीख बदल दी गई है; कॉल करने की ज़रूरत नहीं।", data: "आपका डेटा", dataSub: "इस ऑर्डर का पूरा डेटा डाउनलोड करें, या डिलीट करने को कहें। डॉक्यूमेंट फ़ोटो कभी नहीं रखी जातीं।", download: "मेरा डेटा डाउनलोड करें", erase: "मेरा डेटा डिलीट करें", erased: "डिलीट करने का अनुरोध दर्ज। टेलीकॉम नियमों के लिए ज़रूरी जानकारी के अलावा सब मिटा दिया जाएगा।" },
  hinglish: { order: "Order", live: "Aapka business live hai!", liveSub: "Saari services chalu hain.", next: "Agla:", by: "Sab chalu hoga", noCall: "Call karne ki zaroorat nahi. Yeh page khud update hota hai.", bundle: "Aapka bundle", bill: "Ek monthly bill", setup: "one-time setup", contract: " mahine ka contract", share: "Yeh page share karein", help: "Madad chahiye? 1800-000-0000 par call karein", demo: "Demo: har minute ek din ki progress hoti hai.", delayed: "Delay", newDate: "Nayi date", ops: "Accel operations dwara update", sorry: "Delay ke liye maafi. Aapki date badal di gayi hai; call karne ki zaroorat nahi.", data: "Aapka data", dataSub: "Is order ka saara data download karein, ya delete karne ko kahein. Document photos kabhi nahi rakhi jaati.", download: "Mera data download karein", erase: "Mera data delete karein", erased: "Delete request record ho gayi. Telecom rules ke liye zaroori info ke alawa sab mita diya jayega." },
  ...fromPacks("track"),
};

export function TrackView({ order, token }: { order: OrderPayload; token: string }) {
  const { lang } = useLang();
  const t = T[lang];
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(id);
  }, []);
  // Status updates from operations (dispatch, technician, delays). Polled so the page updates by itself.
  const [events, setEvents] = useState<OrderEvent[]>([]);
  useEffect(() => {
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }), cache: "no-store" });
        if (res.ok && !stop) setEvents((await res.json()).events ?? []);
      } catch {
        /* offline: keep what we have */
      }
    };
    void pull();
    const id = setInterval(pull, 8000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [token]);
  const steps = milestones(order, now, lang, events);
  const delayed = steps.find((s) => s.delay);
  const live = steps.every((s) => s.status === "done");
  const current = steps.find((s) => s.status === "current");

  const [erased, setErased] = useState(false);
  const myData = async (action: "download" | "delete") => {
    const res = await fetch("/api/my-data", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action }) });
    if (!res.ok) return;
    if (action === "delete") return setErased(true);
    const blob = new Blob([JSON.stringify(await res.json(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `accel-order-${order.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: `${t.order} ${order.id}`, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <AppShell step={4}>
      <main className="mx-auto max-w-lg px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-4">
        <section className={`rounded-3xl p-6 text-white ${live ? "bg-ok" : "bg-brand"}`}>
          <p className="text-sm text-white/85">
            {t.order} {order.id} · {order.business}
          </p>
          <h1 className="mt-1 text-3xl font-bold leading-tight">{live ? t.live : `${t.next} ${current?.title}`}</h1>
          <p className="mt-2 text-white/90">{live ? t.liveSub : `${t.by} ${promisedBy(order, events)}. ${t.noCall}`}</p>
        </section>

        {delayed?.delay && !live && (
          <div role="status" className="mt-4 flex gap-3 rounded-2xl bg-hold-soft p-4 text-hold">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>
              <span className="font-bold">
                {t.delayed}: {delayed.title}.
              </span>{" "}
              {delayed.delay.reason}. {t.newDate}: <span className="font-semibold">{delayed.delay.newDate}</span>. {t.sorry}
            </p>
          </div>
        )}

        <ol className="mt-6 rounded-2xl bg-white p-5 shadow-card">
          {steps.map((s, i) => {
            const Icon = s.status === "done" ? CheckCircle2 : s.status === "current" ? CircleDot : Circle;
            return (
              <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0">
                {i < steps.length - 1 && <span aria-hidden className={`absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-0.5 ${s.status === "done" ? "bg-ok" : "bg-rule"}`} />}
                <Icon className={`relative z-10 h-8 w-8 shrink-0 bg-white ${s.status === "done" ? "text-ok" : s.status === "current" ? "text-brand" : "text-rule"}`} aria-hidden />
                <div>
                  <p className={`text-lg font-bold leading-snug ${s.status === "upcoming" ? "text-ink-soft" : ""}`}>
                    {s.title}
                    <span className="sr-only"> ({s.status})</span>
                  </p>
                  <p className={`text-sm ${s.delay ? "font-semibold text-hold" : "text-ink-soft"}`}>{s.delay ? `${t.delayed} · ${t.newDate}: ${s.at}` : s.at}</p>
                  <p className="mt-1">{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 grid gap-3">
          <button onClick={share} className="flex h-14 items-center justify-center gap-2 rounded-full border-2 border-brand bg-white font-semibold text-brand">
            <Share2 className="h-5 w-5" aria-hidden /> {t.share}
          </button>
          <a href="tel:18000000000" className="flex h-14 items-center justify-center gap-2 rounded-full border-2 border-rule bg-white font-semibold">
            <Phone className="h-5 w-5" aria-hidden /> {t.help}
          </a>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">{t.bundle}</h2>
          <ul className="mt-2 divide-y divide-rule">
            {order.lines.map((l) => (
              <li key={l.productId} className="flex justify-between py-2">
                <span>{l.name}</span>
                <span className="text-ink-soft">×{l.quantity}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-baseline justify-between">
            <span className="text-ink-soft">{t.bill}</span>
            <span className="text-3xl font-bold text-brand">{inr(order.monthly)}</span>
          </p>
          <p className="text-sm text-ink-soft">
            {order.setup ? `${inr(order.setup)} ${t.setup} · ` : ""}
            {order.contractMonths}
            {t.contract}
          </p>
        </section>
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">{t.data}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t.dataSub}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => myData("download")} className="h-11 rounded-full border-2 border-rule px-5 font-semibold">
              {t.download}
            </button>
            <button onClick={() => myData("delete")} disabled={erased} className="h-11 rounded-full border-2 border-rule px-5 font-semibold disabled:opacity-50">
              {t.erase}
            </button>
          </div>
          {erased && <p role="status" className="mt-2 text-sm font-semibold text-ok">{t.erased}</p>}
        </section>
        {events.length ? <p className="mt-4 text-xs text-ink-soft">{t.ops}</p> : order.speed > 1 && <p className="mt-4 text-xs text-ink-soft">{t.demo}</p>}
      </main>
    </AppShell>
  );
}
