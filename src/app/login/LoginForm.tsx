"use client";

import { ArrowRight, LockKeyhole, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/AppShell";

const PARTNERS = [
  { id: "P-NAG-01", label: "Sharma Telecom · Nagpur" },
  { id: "P-MUM-01", label: "Mumbai Connect · Mumbai" },
  { id: "P-DEL-01", label: "Capital Comms · Delhi" },
  { id: "P-BLR-01", label: "Namma Networks · Bengaluru" },
];

export function LoginForm({ next, initialRole }: { next?: string; initialRole: "partner" | "admin" }) {
  const router = useRouter();
  const [role, setRole] = useState<"partner" | "admin">(initialRole);
  const [id, setId] = useState(initialRole === "admin" ? "ADMIN" : PARTNERS[0].id);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, pin }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Sign-in failed.");
    router.replace(next && next.startsWith(data.home) ? next : data.home);
    router.refresh();
  };

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-4 py-10">
      <BrandMark />
      <h1 className="mt-6 text-3xl font-bold">Back-office sign in</h1>
      <p className="mt-1 text-ink-soft">For channel partners and Accel Business operations.</p>
      <Link href="/business" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-brand/30 bg-white p-4 font-semibold hover:border-brand">
        <span>
          Running a business? <span className="block text-sm font-normal text-ink-soft">Customers don&apos;t need an account.</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-brand">Start as a customer <ArrowRight className="h-4 w-4" aria-hidden /></span>
      </Link>

      <div role="tablist" className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-white p-1 shadow-card">
        {(["partner", "admin"] as const).map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={role === r}
            onClick={() => {
              setRole(r);
              setId(r === "admin" ? "ADMIN" : PARTNERS[0].id);
              setPin("");
            }}
            className={`flex h-12 items-center justify-center gap-2 rounded-full font-semibold ${role === r ? "bg-brand text-white" : "text-ink-soft"}`}
          >
            {r === "partner" ? <Store className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            {r === "partner" ? "Partner" : "Operations"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl bg-white p-5 shadow-card">
        {role === "partner" ? (
          <label className="block font-semibold">
            Partner
            <select value={id} onChange={(e) => setId(e.target.value)} className="mt-1 h-14 w-full rounded-full border-2 border-rule bg-white px-4 font-normal">
              {PARTNERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block font-semibold">
            Staff ID
            <input value={id} onChange={(e) => setId(e.target.value.toUpperCase())} className="mt-1 h-14 w-full rounded-full border-2 border-rule px-5 font-normal" autoCapitalize="characters" />
          </label>
        )}
        <label className="block font-semibold">
          PIN
          <input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} className="mt-1 h-14 w-full rounded-full border-2 border-rule px-5 font-normal tracking-widest" />
        </label>
        {error && <p className="font-semibold text-brand">{error}</p>}
        <button disabled={busy || !pin} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-lg font-semibold text-white disabled:opacity-40">
          <LockKeyhole className="h-5 w-5" /> Sign in
        </button>
      </form>

      <aside className="mt-4 rounded-2xl border-2 border-dashed border-rule p-4 text-sm">
        <p className="font-bold">Demo access for judges</p>
        <p className="mt-1 text-ink-soft">
          Partner: any partner above, PIN <span className="font-semibold text-ink">1234</span> (sees only that city&apos;s leads).
          <br />
          Operations: ID <span className="font-semibold text-ink">ADMIN</span>, PIN <span className="font-semibold text-ink">9999</span>.
        </p>
      </aside>
    </main>
  );
}
