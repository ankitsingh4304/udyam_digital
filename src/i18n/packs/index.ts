import type { LangPack } from "../types";
import { bn } from "./bn";
import { gu } from "./gu";
import { kn } from "./kn";
import { mr } from "./mr";
import { ta } from "./ta";
import { te } from "./te";

export const PACKS = { mr, gu, kn, te, ta, bn } satisfies Record<string, LangPack>;
export type RegionalLang = keyof typeof PACKS;

/** One section of every regional pack, keyed by language, ready to spread into a translation table. */
export function fromPacks<K extends keyof LangPack>(key: K): Record<RegionalLang, LangPack[K]> {
  return Object.fromEntries(Object.entries(PACKS).map(([lang, pack]) => [lang, pack[key]])) as Record<RegionalLang, LangPack[K]>;
}
