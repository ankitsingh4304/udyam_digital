"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "@/domain/advisor/state";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

/** One language choice for the whole journey, remembered on this phone. */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("udyam.lang");
      if (saved === "en" || saved === "hi" || saved === "hinglish") setLangState(saved);
    } catch {
      /* storage blocked: keep English */
    }
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("udyam.lang", l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l === "hi" ? "hi" : "en";
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
