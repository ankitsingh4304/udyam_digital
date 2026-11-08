"use client";

import { fromPacks } from "@/i18n/packs";
import { Camera, CheckCircle2, PenLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/components/LangContext";
import { preparePhoto } from "./photo";
import { useRouter } from "next/navigation";
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
/** The GSTIN each sample business is registered under (what the owner would type). */
const SAMPLE_GSTIN: Record<string, string> = {
  K01: "37IHKXV5167L1ZS", K02: "19EOGXH4115Y1ZL", K03: "27XUIXG0767D1ZP", K04: "27PZSXS1936O1ZH", K05: "32TZAXB5481U1Z1", K06: "08YKZXS5189L1ZO",
  K07: "07CPCXN0398P1ZT", K08: "24XORXG9365M1Z3", K09: "37LDYXK0296F1ZB", K10: "27QHJXK0658U1ZL", K11: "03KGZXT1320R1ZZ", K12: "37NBLXS1145E1ZU",
};

const T: Record<Lang, Record<string, string>> = {
  en: {
    vPASS: "Documents verified", vPASS_WITH_WARNINGS: "Verified — one step left", vNEEDS_REUPLOAD: "Please re-upload", vMANUAL_REVIEW: "Sent to a verification agent", vREJECT: "We can't verify these documents", mPass: "Passed", mInfo: "Note", mWarn: "Needs attention", mFail: "Failed",
    esignAuth: "Your signature also signs the authorisation letter the registry needs for this signatory.",
    reviewWait: "A verification agent is looking at your case now. Keep this page open; it updates by itself.", reviewRef: "Case reference", reviewApproved: "Approved by a verification agent. You can sign and order now.", reviewRejected: "The agent could not verify these documents.",
    esignTitle: "E-sign the application form", esignBody: "Sign with a one-time code sent to the mobile linked to the signatory's Aadhaar. No paper, no visit.", esignSend: "Send code", esignSentTo: "Code sent to", esignDemo: "Demo code", esignCode: "6-digit code", esignVerify: "Sign", esignDone: "Application signed", esignResend: "Send a new code",
    photoUnreadable: "This photo format can't be opened. Please take the photo again with the camera.", gstinLabel: "Your GSTIN", gstinHint: "We look it up first; the photo then only has to confirm it.", lookup: "Look up", backupNote: "Some documents were read by our backup reader; a verification agent double-checks before activation.", back: "Back to your bundle", step1: "Your consent", step2: "Upload documents", step3: "Result",
    gst: "GST certificate", udyam: "Udyam certificate", signatory: "Authorised signatory's ID", addressProof: "Electricity bill (last 90 days)",
    optional: "optional", choose: "Tap to add photo", replace: "Replace", sample: "Try a sample applicant", sampleHint: "Loads the hackathon specimen documents",
    check: "Check documents", checking: "Checking… usually under 20 seconds", collect: "What we ask for", keep: "How long we keep it",
    consentRef: "Consent recorded", withdraw: "Withdraw consent", withdrawn: "Consent withdrawn. Nothing more will be processed for this case.",
    sharpness: "Sharpness", straightened: "Straightened by", readBy: "Read by", again: "Check different documents", next: "Place order and book installation",
    vision: "AI reader", ocr: "offline OCR", cache: "AI reader (saved)", preflight: "stopped before reading",
  },
  hi: {
    vPASS: "डॉक्यूमेंट सत्यापित", vPASS_WITH_WARNINGS: "सत्यापित — एक कदम बाकी", vNEEDS_REUPLOAD: "कृपया दोबारा अपलोड करें", vMANUAL_REVIEW: "वेरिफ़िकेशन एजेंट को भेजा गया", vREJECT: "हम इन डॉक्यूमेंट की पुष्टि नहीं कर सकते", mPass: "पास", mInfo: "नोट", mWarn: "ध्यान दें", mFail: "फ़ेल",
    esignAuth: "आपका साइन इस हस्ताक्षरकर्ता के लिए ज़रूरी अधिकार-पत्र पर भी होगा।",
    reviewWait: "एक वेरिफ़िकेशन एजेंट अभी आपका केस देख रहा है। यह पेज खुला रखें; यह खुद अपडेट होगा।", reviewRef: "केस नंबर", reviewApproved: "वेरिफ़िकेशन एजेंट ने मंज़ूरी दी। अब साइन करके ऑर्डर करें।", reviewRejected: "एजेंट इन डॉक्यूमेंट की पुष्टि नहीं कर सका।",
    esignTitle: "आवेदन फ़ॉर्म पर ई-साइन करें", esignBody: "हस्ताक्षरकर्ता के आधार से जुड़े मोबाइल पर आए कोड से साइन करें। न कागज़, न विज़िट।", esignSend: "कोड भेजें", esignSentTo: "कोड भेजा गया", esignDemo: "डेमो कोड", esignCode: "6 अंकों का कोड", esignVerify: "साइन करें", esignDone: "आवेदन साइन हो गया", esignResend: "नया कोड भेजें",
    photoUnreadable: "यह फ़ोटो नहीं खुल पाई। कृपया कैमरे से दोबारा फ़ोटो लें।", gstinLabel: "आपका GSTIN", gstinHint: "हम पहले इसे रजिस्ट्री में देखते हैं; फ़ोटो सिर्फ़ पुष्टि करती है।", lookup: "देखें", backupNote: "कुछ डॉक्यूमेंट बैकअप रीडर से पढ़े गए; चालू करने से पहले एजेंट दोबारा जाँचेगा।", back: "बंडल पर वापस", step1: "आपकी सहमति", step2: "डॉक्यूमेंट अपलोड करें", step3: "नतीजा",
    gst: "GST सर्टिफ़िकेट", udyam: "Udyam सर्टिफ़िकेट", signatory: "अधिकृत हस्ताक्षरकर्ता की ID", addressProof: "बिजली बिल (पिछले 90 दिन)",
    optional: "वैकल्पिक", choose: "फ़ोटो जोड़ने के लिए दबाएँ", replace: "बदलें", sample: "सैंपल आवेदक आज़माएँ", sampleHint: "हैकाथॉन के नमूना डॉक्यूमेंट लोड करता है",
    check: "डॉक्यूमेंट जाँचें", checking: "जाँच हो रही है… आमतौर पर 20 सेकंड से कम", collect: "हम क्या माँगते हैं", keep: "कब तक रखते हैं",
    consentRef: "सहमति दर्ज", withdraw: "सहमति वापस लें", withdrawn: "सहमति वापस ली गई। इस केस में आगे कुछ प्रोसेस नहीं होगा।",
    sharpness: "शार्पनेस", straightened: "सीधा किया गया", readBy: "पढ़ा गया", again: "दूसरे डॉक्यूमेंट जाँचें", next: "इंस्टॉलेशन पर जाएँ",
    vision: "AI रीडर", ocr: "ऑफ़लाइन OCR", cache: "AI रीडर (सेव)", preflight: "पढ़ने से पहले रोका गया",
  },
  hinglish: {
    vPASS: "Documents verified", vPASS_WITH_WARNINGS: "Verified — ek step baaki", vNEEDS_REUPLOAD: "Please dobara upload karein", vMANUAL_REVIEW: "Verification agent ko bheja gaya", vREJECT: "Hum in documents ko verify nahi kar sakte", mPass: "Pass", mInfo: "Note", mWarn: "Dhyan dein", mFail: "Fail",
    esignAuth: "Aapka sign is signatory ke liye zaroori authorisation letter par bhi hoga.",
    reviewWait: "Ek verification agent abhi aapka case dekh raha hai. Yeh page khula rakhein; yeh khud update hoga.", reviewRef: "Case reference", reviewApproved: "Verification agent ne approve kiya. Ab sign karke order karein.", reviewRejected: "Agent in documents ko verify nahi kar saka.",
    esignTitle: "Application form par e-sign karein", esignBody: "Signatory ke Aadhaar se jude mobile par aaye code se sign karein. Na kaagaz, na visit.", esignSend: "Code bhejein", esignSentTo: "Code bheja gaya", esignDemo: "Demo code", esignCode: "6 digit code", esignVerify: "Sign karein", esignDone: "Application sign ho gaya", esignResend: "Naya code bhejein",
    photoUnreadable: "Yeh photo nahi khul payi. Please camera se dobara photo lein.", gstinLabel: "Aapka GSTIN", gstinHint: "Hum pehle registry mein dekhte hain; photo sirf confirm karti hai.", lookup: "Dekhein", backupNote: "Kuch documents backup reader se padhe gaye; activation se pehle agent dobara check karega.", back: "Bundle par wapas", step1: "Aapki sahmati", step2: "Documents upload karein", step3: "Result",
    gst: "GST certificate", udyam: "Udyam certificate", signatory: "Authorised signatory ki ID", addressProof: "Bijli bill (pichhle 90 din)",
    optional: "optional", choose: "Photo jodne ke liye dabayein", replace: "Badlein", sample: "Sample applicant try karein", sampleHint: "Hackathon ke specimen documents load karta hai",
    check: "Documents check karein", checking: "Check ho raha hai… aam taur par 20 second se kam", collect: "Hum kya maangte hain", keep: "Kab tak rakhte hain",
    consentRef: "Consent recorded", withdraw: "Consent wapas lein", withdrawn: "Consent wapas liya gaya. Is case mein aage kuch process nahi hoga.",
    sharpness: "Sharpness", straightened: "Seedha kiya", readBy: "Padha gaya", again: "Doosre documents check karein", next: "Installation par jaayein",
    vision: "AI reader", ocr: "offline OCR", cache: "AI reader (saved)", preflight: "padhne se pehle roka gaya",
  },
  ...fromPacks("kyc"),
};

const VERDICT: Record<KycVerdict, { title: string; tone: string }> = {
  PASS: { title: "Documents verified", tone: "border-ok bg-ok/5" },
  PASS_WITH_WARNINGS: { title: "Verified — one step left", tone: "border-ok bg-ok/5" },
  NEEDS_REUPLOAD: { title: "Please re-upload", tone: "border-hold bg-hold/5" },
  MANUAL_REVIEW: { title: "Sent to a verification agent", tone: "border-hold bg-hold/5" },
  REJECT: { title: "We can't verify these documents", tone: "border-khata bg-khata/5" },
};
const MARK_KEY: Record<KycCheck["status"], string> = { pass: "mPass", info: "mInfo", warn: "mWarn", fail: "mFail" };
const MARK: Record<KycCheck["status"], { sign: string; cls: string; label: string }> = {
  pass: { sign: "✓", cls: "text-ok", label: "Passed" },
  info: { sign: "i", cls: "text-ink-soft", label: "Note" },
  warn: { sign: "!", cls: "text-hold", label: "Needs attention" },
  fail: { sign: "✕", cls: "text-khata", label: "Failed" },
};

export function KycApp() {
  const { lang } = useLang();
  const [purposes, setPurposes] = useState<Record<Purpose, boolean>>({ kyc: false, installation: false, offers: false });
  const [caseInfo, setCaseInfo] = useState<{ caseId: string; consentRef: string; consentToken: string } | undefined>();
  const [files, setFiles] = useState<Partial<Record<DocKind, File>>>({});
  const [gstin, setGstin] = useState("");
  const [lookup, setLookup] = useState<{ ok: boolean; text: string } | undefined>();

  useEffect(() => {
    try {
      const q = JSON.parse(sessionStorage.getItem("udyam.quote") ?? "{}") as { gstin?: string };
      if (q.gstin) setGstin(q.gstin);
    } catch {
      /* nothing saved */
    }
  }, []);

  const lookUp = async (g = gstin) => {
    const v = g.trim().toUpperCase();
    if (!v) return setLookup(undefined);
    const res = await fetch(`/api/registry/gstin/${encodeURIComponent(v)}`);
    const d = await res.json();
    if (res.status === 422) return setLookup({ ok: false, text: d.issues?.[0]?.message ?? "This GSTIN isn't valid." });
    if (!d.found) return setLookup({ ok: false, text: "Not found in the GST registry." });
    setLookup({ ok: d.status === "Active", text: `${d.tradeName} · ${d.constitution} · ${d.state} · ${d.status}` });
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<KycCaseResult>();
  const [withdrawn, setWithdrawn] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [esign, setEsign] = useState<{ challenge: string; demoOtp: string; mobile: string } | undefined>();
  const [otp, setOtp] = useState("");
  const [esignToken, setEsignToken] = useState<string>();
  const [signing, setSigning] = useState(false);
  const router = useRouter();
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
    setGstin(SAMPLE_GSTIN[id]);
    void lookUp(SAMPLE_GSTIN[id]);
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
      form.set("consentToken", caseInfo.consentToken);
      if (gstin.trim()) form.set("declaredGstin", gstin.trim().toUpperCase());
      for (const [slot, f] of Object.entries(files)) if (f) form.set(slot, f);
      const res = await fetch("/api/kyc/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setReview(undefined);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "The check didn't finish. Send the documents again.");
    } finally {
      setBusy(false);
    }
  };

  const kycTokenOf = (r: KycCaseResult) => (r as KycCaseResult & { kycToken: string }).kycToken;

  const startEsign = async () => {
    if (!result) return;
    setSigning(true);
    setError(undefined);
    setOtp("");
    const res = await fetch("/api/esign/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kycToken: kycTokenOf(result) }) });
    const data = await res.json();
    setSigning(false);
    if (!res.ok) return setError(data.error ?? "Couldn't start signing. Try again.");
    setEsign(data);
  };

  const verifyEsign = async () => {
    if (!esign) return;
    setSigning(true);
    setError(undefined);
    const res = await fetch("/api/esign/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge: esign.challenge, otp }) });
    const data = await res.json();
    setSigning(false);
    if (!res.ok) return setError(data.error ?? "Couldn't sign. Try again.");
    setEsignToken(data.esignToken);
  };

  // MANUAL_REVIEW: wait for the verification agent's decision (operations panel), then continue.
  const [review, setReview] = useState<{ status: "approved" | "rejected"; note?: string }>();
  useEffect(() => {
    if (result?.verdict !== "MANUAL_REVIEW") return;
    let stop = false;
    const pull = async () => {
      try {
        const res = await fetch("/api/kyc/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kycToken: kycTokenOf(result) }) });
        const data = await res.json();
        if (stop || !res.ok) return;
        if (data.status === "approved") {
          setReview({ status: "approved", note: data.note });
          setResult({ ...result, verdict: "PASS", kycToken: data.kycToken } as KycCaseResult);
        } else if (data.status === "rejected") setReview({ status: "rejected", note: data.note });
      } catch {
        /* keep waiting */
      }
    };
    void pull();
    const id = setInterval(pull, 5000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [result]);

  // A new document check means a new case: any earlier signature no longer applies.
  useEffect(() => {
    setEsign(undefined);
    setEsignToken(undefined);
    setOtp("");
  }, [result]);

  const placeOrder = async () => {
    if (!result) return;
    setPlacing(true);
    setError(undefined);
    let quote: unknown;
    try {
      const raw = sessionStorage.getItem("udyam.quote");
      quote = raw ? JSON.parse(raw) : undefined;
    } catch {
      quote = undefined;
    }
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kycToken: kycTokenOf(result), esignToken, quote, demo: true }),
    });
    const data = await res.json();
    setPlacing(false);
    if (!res.ok) return setError(data.error ?? "The order couldn't be placed. Try again.");
    router.push(`/track/${encodeURIComponent(data.token)}`);
  };

  const withdraw = async () => {
    if (!caseInfo) return;
    const res = await fetch("/api/consent/withdraw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: caseInfo.caseId, consentToken: caseInfo.consentToken }) });
    if (res.ok) {
      setWithdrawn(true);
      setFiles({});
      setResult(undefined);
    }
  };


  return (
    <AppShell step={3} back={{ href: "/advisor", label: t.back }}>
    <main className="mx-auto max-w-lg px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-4">
      <ol className="flex flex-wrap gap-2" aria-label="Document check progress">
        {[t.step1, t.step2, t.step3].map((label, i) => {
          const active = i === (result ? 2 : caseInfo ? 1 : 0);
          const passed = i < (result ? 2 : caseInfo ? 1 : 0);
          return (
            <li key={label} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${active ? "bg-ink text-white" : passed ? "bg-ok-soft text-ok" : "bg-white text-ink-soft"}`}>
              {passed ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <span>{i + 1}.</span>} {label}
            </li>
          );
        })}
      </ol>

      {withdrawn && <p className="mt-6 rounded-2xl bg-white p-5 shadow-card">{t.withdrawn}</p>}

      {!caseInfo && !withdrawn && (
        <section className="mt-5 rounded-2xl bg-white p-5 shadow-card sm:p-7" aria-labelledby="notice-title">
          <h1 id="notice-title" className="text-2xl font-bold">
            {n.title}
          </h1>
          <p className="mt-2 max-w-prose text-ink-soft">{n.intro}</p>
          <fieldset className="mt-5 space-y-3">
            <legend className="sr-only">Purposes</legend>
            {PURPOSES.map((p) => (
              <label key={p} className="flex min-h-16 cursor-pointer gap-3 rounded-2xl border-2 border-rule p-4 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[#E40000]" checked={purposes[p]} onChange={(e) => setPurposes({ ...purposes, [p]: e.target.checked })} />
                <span>
                  <span className="font-medium">{n.purposes[p].label}</span>{" "}
                  <span className={`text-sm ${REQUIRED_PURPOSES.includes(p) ? "text-khata" : "text-ink-soft"}`}>({REQUIRED_PURPOSES.includes(p) ? n.required : n.optional})</span>
                  <span className="mt-0.5 block text-sm text-ink-soft">{n.purposes[p].detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-5 grid gap-5">
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
          <button onClick={giveConsent} disabled={!canAgree} className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-brand px-8 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-40 sm:w-auto">
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
            <section className="mt-4 rounded-2xl bg-white p-5 shadow-card sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h1 className="text-2xl font-bold">{t.step2}</h1>
                <label className="text-sm">
                  <span className="block text-ink-soft">{t.sample}</span>
                  <select className="mt-1 h-12 rounded-full border-2 border-rule bg-white px-4 text-base font-semibold" defaultValue="" onChange={(e) => e.target.value && loadSample(e.target.value)} title={t.sampleHint}>
                    <option value="" disabled>
                      K01–K12
                    </option>
                    {SAMPLES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 rounded-xl bg-page p-4">
                <label className="block text-sm font-medium" htmlFor="gstin">
                  {t.gstinLabel}
                </label>
                <p className="text-xs text-ink-soft">{t.gstinHint}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    id="gstin"
                    value={gstin}
                    onChange={(e) => {
                      setGstin(e.target.value.toUpperCase());
                      setLookup(undefined);
                    }}
                    onBlur={() => void lookUp()}
                    maxLength={15}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-14 w-full min-w-0 flex-1 basis-60 rounded-full border-2 border-rule bg-white px-5 text-lg font-semibold tracking-wide focus:border-brand focus:outline-none"
                    placeholder="e.g. 37LDYXK0296F1ZB"
                  />
                  <button type="button" onClick={() => void lookUp()} className="h-14 rounded-full border-2 border-brand px-5 font-semibold text-brand">
                    {t.lookup}
                  </button>
                </div>
                {lookup && <p className={`mt-2 text-sm ${lookup.ok ? "text-ok" : "text-khata"}`}>{lookup.text}</p>}
              </div>
              <ul className="mt-5 grid gap-3">
                {SLOTS.map(({ slot, optional }) => (
                  <li key={slot}>
                    <label className={`group flex h-full cursor-pointer flex-col rounded-2xl border-2 p-3 transition-colors ${files[slot] ? "border-ok bg-ok-soft" : "border-dashed border-ink-soft/40 bg-white hover:border-brand hover:bg-brand-soft"}`}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-lg font-bold leading-tight">
                          {t[slot]} {optional && <span className="text-sm font-normal text-ink-soft">({t.optional})</span>}
                        </span>
                        {files[slot] && <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" aria-label="Added" />}
                      </span>
                      {previews[slot] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previews[slot]} alt={t[slot]} className="mt-2 h-40 w-full rounded-xl bg-white object-contain" />
                      ) : (
                        <span className="mt-2 flex h-40 flex-col items-center justify-center gap-2 rounded-xl bg-page text-ink-soft">
                          <Camera className="h-10 w-10 text-brand" aria-hidden />
                          <span className="font-semibold text-ink">{t.choose}</span>
                        </span>
                      )}
                      {files[slot] && <span className="mt-2 text-center text-sm font-semibold text-brand underline underline-offset-4">{t.replace}</span>}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const ready = await preparePhoto(f);
                          if (ready) setFiles((cur) => ({ ...cur, [slot]: ready }));
                          else setError(t.photoUnreadable);
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
              {error && <p className="mt-4 text-khata">{error}</p>}
              <button onClick={submit} disabled={busy || !files.gst} className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-brand px-8 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-40 sm:w-auto">
                {busy ? t.checking : t.check}
              </button>
            </section>
          )}

          {result && (
            <section className="mt-4 space-y-4" aria-live="polite">
              <div className={`rounded-2xl border-l-4 bg-white p-5 ${VERDICT[result.verdict].tone}`}>
                <h1 className="text-2xl font-bold">{t[`v${result.verdict}`] ?? VERDICT[result.verdict].title}</h1>
                {result.documents.some((d) => d.reader === "ocr") && <p className="mt-1 text-sm text-ink-soft">{t.backupNote}</p>}
                {result.verdict === "MANUAL_REVIEW" && review?.status !== "rejected" && (
                  <p role="status" className="mt-2 flex items-start gap-2 text-[15px]">
                    <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-hold" aria-hidden />
                    <span>
                      {t.reviewWait} {t.reviewRef}: <span className="font-mono font-semibold">{caseInfo?.caseId}</span>
                    </span>
                  </p>
                )}
                {review?.status === "approved" && <p role="status" className="mt-2 font-semibold text-ok">{t.reviewApproved}</p>}
                {review?.status === "rejected" && <p role="status" className="mt-2 font-semibold text-khata">{t.reviewRejected} {review.note}</p>}
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
                  <article key={d.slot} className="rounded-2xl bg-white p-5 shadow-card">
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
                          <span className={`w-4 shrink-0 text-center font-bold ${MARK[c.status].cls}`} aria-label={t[MARK_KEY[c.status]] ?? MARK[c.status].label}>
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
                <article className="rounded-2xl bg-white p-5 shadow-card">
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

              {(result.verdict === "PASS" || result.verdict === "PASS_WITH_WARNINGS") && (
                <article id="esign" className={`rounded-2xl border-2 bg-white p-5 shadow-card ${esignToken ? "border-ok" : "border-brand/40"}`}>
                  <h2 className="flex items-center gap-2 text-lg font-bold">
                    {esignToken ? <CheckCircle2 className="h-6 w-6 text-ok" aria-hidden /> : <PenLine className="h-6 w-6 text-brand" aria-hidden />}
                    {esignToken ? t.esignDone : t.esignTitle}
                  </h2>
                  {!esignToken && <p className="mt-1 text-[15px] text-ink-soft">{t.esignBody}</p>}
                  {!esignToken && result.checks.some((c) => c.code === "SIGNATORY_AUTH") && <p className="mt-1 text-[15px] font-semibold">{t.esignAuth}</p>}
                  {!esignToken && !esign && (
                    <button onClick={startEsign} disabled={signing} className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-brand px-8 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-50 sm:w-auto">
                      {t.esignSend}
                    </button>
                  )}
                  {!esignToken && esign && (
                    <div className="mt-4 space-y-3">
                      <p className="text-[15px]">
                        {t.esignSentTo} {esign.mobile}. <span className="rounded-lg bg-page px-2 py-1 font-mono font-semibold" data-testid="demo-otp">{t.esignDemo}: {esign.demoOtp}</span>
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <input
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          aria-label={t.esignCode}
                          placeholder={t.esignCode}
                          className="h-14 w-44 rounded-2xl border-2 border-rule px-4 text-center font-mono text-xl tracking-[0.3em] focus:border-brand focus:outline-none"
                        />
                        <button onClick={verifyEsign} disabled={signing || otp.length !== 6} className="flex h-14 items-center justify-center rounded-full bg-brand px-8 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                          {t.esignVerify}
                        </button>
                      </div>
                      <button onClick={startEsign} disabled={signing} className="text-sm font-semibold text-brand underline">
                        {t.esignResend}
                      </button>
                    </div>
                  )}
                </article>
              )}

              {error && <p className="text-khata">{error}</p>}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setResult(undefined)} className="flex h-14 items-center justify-center rounded-full border-2 border-rule bg-white px-6 font-semibold">
                  {t.again}
                </button>
                {(result.verdict === "PASS" || result.verdict === "PASS_WITH_WARNINGS") && (
                  <button onClick={placeOrder} disabled={placing || !esignToken} className="flex h-14 items-center justify-center rounded-full bg-brand px-8 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                    {t.next}
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
    </AppShell>
  );
}
