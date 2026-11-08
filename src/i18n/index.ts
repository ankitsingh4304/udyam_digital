import type { Lang } from "@/domain/advisor/state";

/** A translated value: English is required, every other language falls back to English. */
export type Tr<T> = { en: T } & Partial<Record<Lang, T>>;

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Pick a language; for objects, missing keys fall back to English one by one. */
export function pick<T>(t: Tr<T>, lang: Lang): T {
  const v = t[lang];
  if (v === undefined) return t.en;
  if (isPlainObject(v) && isPlainObject(t.en)) return { ...(t.en as object), ...(v as object) } as T;
  return v;
}

/** Native names, in the order shown to owners. */
export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  hi: "हिंदी",
  hinglish: "Hinglish",
  mr: "मराठी",
  gu: "ગુજરાતી",
  kn: "ಕನ್ನಡ",
  te: "తెలుగు",
  ta: "தமிழ்",
  bn: "বাংলা",
};

/** BCP-47 tag for speech, html lang and voices. */
export const LANG_TAG: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", hinglish: "hi-IN", mr: "mr-IN", gu: "gu-IN", kn: "kn-IN", te: "te-IN", ta: "ta-IN", bn: "bn-IN" };

/** Language name for LLM prompts. */
export const LANG_NAME: Record<Lang, string> = {
  en: "simple English",
  hi: "simple Hindi (Devanagari script)",
  hinglish: "Hinglish (Hindi in Latin script)",
  mr: "simple Marathi (Devanagari script)",
  gu: "simple Gujarati (Gujarati script)",
  kn: "simple Kannada (Kannada script)",
  te: "simple Telugu (Telugu script)",
  ta: "simple Tamil (Tamil script)",
  bn: "simple Bengali (Bengali script)",
};
