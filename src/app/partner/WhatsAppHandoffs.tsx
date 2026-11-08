"use client";

import { MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface H {
  id: string;
  city: string | null;
  summary: string;
  lang: string;
  at: string;
  takenBy: { name: string; mine: boolean } | null;
  contact: string | null;
}

/** WhatsApp chats where the owner asked for a person: the freshest leads a partner can get. */
export function WhatsAppHandoffs({ canTake }: { canTake: boolean }) {
  const [list, setList] = useState<H[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    const res = await fetch("/api/partner/handoffs", { cache: "no-store" });
    if (res.ok) setList((await res.json()).handoffs);
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  if (!list.length) return null;
  return (
    <section className="mt-6 rounded-2xl border-2 border-[#008069]/40 bg-white p-5 shadow-card" aria-label="WhatsApp requests">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <MessageCircle className="h-5 w-5 text-[#008069]" aria-hidden /> Asked for a person on WhatsApp
        <span className="ml-auto rounded-full bg-[#d9fdd3] px-3 py-0.5 text-sm font-semibold text-[#005c4b]">{list.filter((h) => !h.takenBy).length} waiting</span>
      </h2>
      <p className="mt-1 text-sm text-ink-soft">The owner is in the chat right now. Take it and they are told your name; their WhatsApp number is shown only to you.</p>
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
      <ul className="mt-3 space-y-3">
        {list.map((h) => (
          <li key={h.id} className="rounded-2xl border-2 border-rule p-4">
            <p className="font-semibold">{h.summary}</p>
            <p className="text-sm text-ink-soft">
              {h.city ?? "City not given"} · language {h.lang} · {new Date(h.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </p>
            {h.contact && <p className="mt-1 text-sm font-semibold">Contact: {h.contact}</p>}
            {canTake ? (
              <button
                disabled={!!h.takenBy || busy === h.id}
                onClick={async () => {
                  setBusy(h.id);
                  setError(undefined);
                  const res = await fetch(`/api/partner/handoffs/${h.id}/take`, { method: "POST" });
                  if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Couldn't take this chat.");
                  setBusy(undefined);
                  await load();
                }}
                className="mt-3 h-11 rounded-full bg-[#008069] px-5 font-semibold text-white disabled:opacity-50"
              >
                {h.takenBy ? (h.takenBy.mine ? "Taken by you" : `Taken by ${h.takenBy.name}`) : "Take this chat"}
              </button>
            ) : (
              h.takenBy && <p className="mt-2 text-sm font-semibold">Taken by {h.takenBy.name}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
