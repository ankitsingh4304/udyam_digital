"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLang } from "@/components/LangContext";
import { LANGS, type Lang } from "@/domain/advisor/state";

/** Saves the chat's quote on this phone, switches to the chat's language and opens the document check. */
export function ContinueFromChat({ quote, lang, waToken }: { quote: unknown; lang?: string; waToken?: string }) {
  const router = useRouter();
  const { setLang } = useLang();
  useEffect(() => {
    try {
      sessionStorage.setItem("udyam.quote", JSON.stringify(quote));
      if (waToken) sessionStorage.setItem("udyam.wa", waToken);
    } catch {
      /* storage blocked: the document check still works with a starter bundle */
    }
    if (lang && (LANGS as readonly string[]).includes(lang)) setLang(lang as Lang);
    router.replace("/kyc");
  }, [quote, lang, waToken, router, setLang]);
  return <main className="grid min-h-dvh place-items-center text-ink-soft">…</main>;
}
