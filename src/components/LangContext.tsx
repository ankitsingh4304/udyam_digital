"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { LANGS, type Lang } from "@/domain/advisor/state";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; ready: boolean }>({ lang: "en", setLang: () => {}, ready: false });

/** One language choice for the whole journey, remembered on this phone. */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  // True once the saved choice has been read, so pages don't start in English and then switch.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("udyam.lang");
      if (saved && (LANGS as readonly string[]).includes(saved)) {
        setLangState(saved as Lang);
        document.documentElement.lang = htmlLang(saved as Lang);
      }
    } catch {
      /* storage blocked: keep English */
    }
    setReady(true);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("udyam.lang", l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = htmlLang(l);
  };
  return <Ctx.Provider value={{ lang, setLang, ready }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);

const htmlLang = (l: Lang) => (l === "hinglish" ? "hi-Latn" : l);
