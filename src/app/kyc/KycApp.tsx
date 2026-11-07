"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NOTICE, NOTICE_VERSION, PURPOSES, REQUIRED_PURPOSES, type Purpose } from "@/domain/kyc/consent";
import type { Lang } from "@/domain/advisor/state";
import type { DocKind, KycCheck, KycVerdict } from "@/domain/kyc/types";
import type { KycCaseResult } from "@/server/kyc-service";

const SLOTS: { slot: DocKind; file: string; optional?: boolean }[] = [
  { slot: "gst", file: "gst_certificate" },
  { slot: "udyam", file: "udyam_certificate", optional: true },
  { slot: "signatory", file: "signatory_id" },
  { slot: "addressProof", file: "address_proof" },
];
const SAMPLES = Array.from({ length: 12 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`);
const LANG_LABEL: Record<Lang, string> = { en: "English", hi: "हिंदी", hinglish: "Hinglish" };

const T: Record<Lang, Record<string, string>> = {
  en: {
    back: "Back to your bundle", step1: "Your consent", step2: "Upload documents", step3: "Result",
    gst: "GST certificate", udyam: "Udyam certificate", signatory: "Authorised signatory's ID", addressProof: "Electricity bill (last 90 days)",
    optional: "optional", choose: "Take photo or choose file", replace: "Replace", sample: "Try a sample applicant", sampleHint: "Loads the hackathon specimen documents",
    check: "Check documents", checking: "Checking… usually under 20 seconds", collect: "What we ask for", keep: "How long we keep it",
    consentRef: "Consent recorded", withdraw: "Withdraw consent", withdrawn: "Consent withdrawn. Nothing more will be processed for this case.",
    sharpness: "Sharpness", straightened: "Straightened by", readBy: "Read by", again: "Check different documents", next: "Continue to installation",
    vision: "AI reader", ocr: "offline OCR", cache: "AI reader (saved)", preflight: "stopped before reading",
  },
  hi: {
    back: "बंडल पर वापस", step1: "आपकी सहमति", step2: "डॉक्यूमेंट अपलोड करें", step3: "नतीजा",
    gst: "GST सर्टिफ़िकेट", udyam: "Udyam सर्टिफ़िकेट", signatory: "अधिकृत हस्ताक्षरकर्ता की ID", addressProof: "बिजली बिल (पिछले 90 दिन)",
    optional: "वैकल्पिक", choose: "फ़ोटो लें या फ़ाइल चुनें", replace: "बदलें", sample: "सैंपल आवेदक आज़माएँ", sampleHint: "हैकाथॉन के नमूना डॉक्यूमेंट लोड करता है",
    check: "डॉक्यूमेंट जाँचें", checking: "जाँच हो रही है… आमतौर पर 20 सेकंड से कम", collect: "हम क्या माँगते हैं", keep: "कब तक रखते हैं",
    consentRef: "सहमति दर्ज", withdraw: "सहमति वापस लें", withdrawn: "सहमति वापस ली गई। इस केस में आगे कुछ प्रोसेस नहीं होगा।",
    sharpness: "शार्पनेस", straightened: "सीधा किया गया", readBy: "पढ़ा गया", again: "दूसरे डॉक्यूमेंट जाँचें", next: "इंस्टॉलेशन पर जाएँ",
    vision: "AI रीडर", ocr: "ऑफ़लाइन OCR", cache: "AI रीडर (सेव)", preflight: "पढ़ने से पहले रोका गया",
  },
  hinglish: {
    back: "Bundle par wapas", step1: "Aapki sahmati", step2: "Documents upload karein", step3: "Result",
    gst: "GST certificate", udyam: "Udyam certificate", signatory: "Authorised signatory ki ID", addressProof: "Bijli bill (pichhle 90 din)",
    optional: "optional", choose: "Photo lein ya file chunein", replace: "Badlein", sample: "Sample applicant try karein", sampleHint: "Hackathon ke specimen documents load karta hai",
    check: "Documents check karein", checking: "Check ho raha hai… aam taur par 20 second se kam", collect: "Hum kya maangte hain", keep: "Kab tak rakhte hain",
    consentRef: "Consent recorded", withdraw: "Consent wapas lein", withdrawn: "Consent wapas liya gaya. Is case mein aage kuch process nahi hoga.",
    sharpness: "Sharpness", straightened: "Seedha kiya", readBy: "Padha gaya", again: "Doosre documents check karein", next: "Installation par jaayein",
    vision: "AI reader", ocr: "offline OCR", cache: "AI reader (saved)", preflight: "padhne se pehle roka gaya",
  },
};

const VERDICT: Record<KycVerdict, { title: string; tone: string }> = {
  PASS: { title: "Documents verified", tone: "border-ok bg-ok/5" },
  PASS_WITH_WARNINGS: { title: "Verified — one step left", tone: "border-ok bg-ok/5" },
  NEEDS_REUPLOAD: { title: "Please re-upload", tone: "border-hold bg-hold/5" },
  MANUAL_REVIEW: { title: "Sent to a verification agent", tone: "border-hold bg-hold/5" },
  REJECT: { title: "We can't verify these documents", tone: "border-khata bg-khata/5" },
};
const MARK: Record<KycCheck["status"], { sign: string; cls: string; label: string }> = {
  pass: { sign: "✓", cls: "text-ok", label: "Passed" },
  info: { sign: "i", cls: "text-ink-soft", label: "Note" },
  warn: { sign: "!", cls: "text-hold", label: "Needs attention" },
  fail: { sign: "✕", cls: "text-khata", label: "Failed" },
};

export function KycApp() {
  const [lang, setLang] = useState<Lang>("en");
  const [purposes, setPurposes] = useState<Record<Purpose, boolean>>({ kyc: false, installation: false, offers: false });
  const [caseInfo, setCaseInfo] = useState<{ caseId: string; consentRef: string } | undefined>();
  const [files, setFiles] = useState<Partial<Record<DocKind, File>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<KycCaseResult>();
  const [withdrawn, setWithdrawn] = useState(false);
  const t = T[lang];
  const n = NOTICE[lang];

  const previews = useMemo(() => Object.fromEntries(Object.entries(files).map(([k, f]) => [k, f ? URL.createObjectURL(f) : ""])), [files]);
  useEffect(() => () => Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const canAgree = REQUIRED_PURPOSES.every((p) => purposes[p]);

  const giveConsent = async () => {
    setError(undefined);
    const res = await fetch("/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purposes, lang, noticeVersion: NOTICE_VERSION }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Consent could not be recorded. Try again.");
    setCaseInfo(data);
  };

  const loadSample = async (id: string) => {
    setResult(undefined);
    const entries = await Promise.all(
      SLOTS.map(async ({ slot, file }) => {
        const res = await fetch(`/api/kyc/samples/${id}_${file}.png`);
        if (!res.ok) return [slot, undefined] as const;
        return [slot, new File([await res.blob()], `${id}_${file}.png`, { type: "image/png" })] as const;
      }),
    );
    setFiles(Object.fromEntries(entries.filter(([, f]) => f)));
  };

  const submit = async () => {
    if (!caseInfo) return;
    setBusy(true);
    setError(undefined);
    try {
      const form = new FormData();
      form.set("caseId", caseInfo.caseId);
      for (const [slot, f] of Object.entries(files)) if (f) form.set(slot, f);
      const res = await fetch("/api/kyc/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The check didn't finish. Send the documents again.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (!caseInfo) return;
    const res = await fetch("/api/consent/withdraw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: caseInfo.caseId }) });
    if (res.ok) {
      setWithdrawn(true);
      setFiles({});
      setResult(undefined);
    }
  };

  const stepClass = (active: boolean) => `text-sm ${active ? "font-bold text-ink" : "text-ink-soft"}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/advisor" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          ← {t.back}
        </Link>
        <div role="radiogroup" aria-label="Language" className="flex rounded-full border border-rule bg-white p-0.5 text-sm">
          {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 ${lang === l ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
      </header>

      <ol className="mt-6 flex gap-5" aria-label="Progress">
        <li className={stepClass(!caseInfo)}>1. {t.step1}</li>
        <li className={stepClass(!!caseInfo && !result)}>2. {t.step2}</li>
        <li className={stepClass(!!result)}>3. {t.step3}</li>
      </ol>

      {withdrawn && <p className="mt-6 rounded-xl border border-rule bg-white p-4">{t.withdrawn}</p>}

      {!caseInfo && !withdrawn && (
        <section className="mt-6 rounded-2xl border border-rule bg-white p-5 sm:p-7" aria-labelledby="notice-title">
          <h1 id="notice-title" className="text-2xl font-bold">
            {n.title}
          </h1>
          <p className="mt-2 max-w-prose text-ink-soft">{n.intro}</p>
          <fieldset className="mt-5 space-y-3">
            <legend className="sr-only">Purposes</legend>
            {PURPOSES.map((p) => (
              <label key={p} className="flex cursor-pointer gap-3 rounded-xl border border-rule p-4 has-[:checked]:border-ink">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[#1B2A4A]" checked={purposes[p]} onChange={(e) => setPurposes({ ...purposes, [p]: e.target.checked })} />
                <span>
                  <span className="font-medium">{n.purposes[p].label}</span>{" "}
                  <span className={`text-sm ${REQUIRED_PURPOSES.includes(p) ? "text-khata" : "text-ink-soft"}`}>({REQUIRED_PURPOSES.includes(p) ? n.required : n.optional})</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{n.purposes[p].detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h2 className="font-bold">{t.collect}</h2>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {n.collect.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-soft">{n.notCollect}</p>
            </div>
            <div>
              <h2 className="font-bold">{t.keep}</h2>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {n.retention.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 text-sm">{n.rights}</p>
          <button onClick={giveConsent} disabled={!canAgree} className="mt-5 w-full rounded-xl bg-ink py-3 font-medium text-white disabled:opacity-40 sm:w-auto sm:px-8">
            {n.agree}
          </button>
        </section>
      )}

      {caseInfo && !withdrawn && (
        <>
          <p className="mt-6 text-sm text-ink-soft">
            {t.consentRef}: <span className="font-medium text-ink">{caseInfo.consentRef}</span> ·{" "}
            <button onClick={withdraw} className="underline underline-offset-4">
              {t.withdraw}
            </button>
          </p>

          {!result && (
            <section className="mt-4 rounded-2xl border border-rule bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h1 className="text-2xl font-bold">{t.step2}</h1>
                <label className="text-sm">
                  <span className="block text-ink-soft">{t.sample}</span>
                  <select className="mt-1 rounded-lg border border-rule px-3 py-2" defaultValue="" onChange={(e) => e.target.value && loadSample(e.target.value)} title={t.sampleHint}>
                    <option value="" disabled>
                      K01–K12
                    </option>
                    {SAMPLES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {SLOTS.map(({ slot, optional }) => (
                  <li key={slot} className="rounded-xl border border-dashed border-rule p-3">
                    <p className="font-medium">
                      {t[slot]} {optional && <span className="text-sm font-normal text-ink-soft">({t.optional})</span>}
                    </p>
                    {previews[slot] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[slot]} alt={t[slot]} className="mt-2 h-40 w-full rounded-lg border border-rule object-contain" />
                    ) : (
                      <div className="mt-2 grid h-40 place-items-center rounded-lg bg-page text-sm text-ink-soft">—</div>
                    )}
                    <label className="mt-2 inline-block cursor-pointer text-sm underline underline-offset-4">
                      {files[slot] ? t.replace : t.choose}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setFiles({ ...files, [slot]: f });
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
              {error && <p className="mt-4 text-khata">{error}</p>}
              <button onClick={submit} disabled={busy || !files.gst} className="mt-5 w-full rounded-xl bg-ink py-3 font-medium text-white disabled:opacity-40 sm:w-auto sm:px-8">
                {busy ? t.checking : t.check}
              </button>
            </section>
          )}

          {result && (
            <section className="mt-4 space-y-4" aria-live="polite">
              <div className={`rounded-2xl border-l-4 bg-white p-5 ${VERDICT[result.verdict].tone}`}>
                <h1 className="text-2xl font-bold">{VERDICT[result.verdict].title}</h1>
                {result.actions.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {result.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
                {result.verified.udyamAutoFetched && <p className="mt-2 text-sm text-ok">Udyam {result.verified.udyamNumber} fetched from the registry — no upload needed.</p>}
              </div>

              {result.documents.map((d) => {
                const checks = result.checks.filter((c) => c.doc === d.slot);
                return (
                  <article key={d.slot} className="rounded-2xl border border-rule bg-white p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-lg font-bold">{t[d.slot]}</h2>
                      <p className="text-sm text-ink-soft">
                        {t.sharpness} {d.quality.blurScore}
                        {Math.abs(d.quality.skewDeg) > 2 ? ` · ${t.straightened} ${Math.abs(d.quality.skewDeg)}°` : ""} · {t.readBy} {t[d.reader ?? "preflight"]}
                      </p>
                    </div>
                    {d.fields && (
                      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        {Object.entries(d.fields).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-ink-soft">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <ul className="mt-3 space-y-1.5">
                      {checks.map((c, i) => (
                        <li key={i} className="flex gap-2 text-[15px]">
                          <span className={`w-4 shrink-0 text-center font-bold ${MARK[c.status].cls}`} aria-label={MARK[c.status].label}>
                            {MARK[c.status].sign}
                          </span>
                          <span>
                            {c.message}
                            {c.suggestion && <span className="block text-sm text-ink-soft">{c.suggestion}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
              {result.checks.some((c) => c.doc === "udyam") && !result.documents.some((d) => d.slot === "udyam") && (
                <article className="rounded-2xl border border-rule bg-white p-5">
                  <h2 className="text-lg font-bold">{t.udyam}</h2>
                  <ul className="mt-2 space-y-1.5">
                    {result.checks.filter((c) => c.doc === "udyam").map((c, i) => (
                      <li key={i} className="flex gap-2 text-[15px]">
                        <span className={`w-4 shrink-0 text-center font-bold ${MARK[c.status].cls}`}>{MARK[c.status].sign}</span>
                        <span>{c.message}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              <div className="flex flex-wrap gap-3">
                <button onClick={() => setResult(undefined)} className="rounded-xl border border-ink px-5 py-3 font-medium">
                  {t.again}
                </button>
                {(result.verdict === "PASS" || result.verdict === "PASS_WITH_WARNINGS") && (
                  <button disabled className="rounded-xl bg-ink px-5 py-3 font-medium text-white opacity-90" title="Coming in the next step">
                    {t.next}
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
