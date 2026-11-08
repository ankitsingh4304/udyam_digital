import type { Copy } from "@/domain/advisor/copy";
import type { NoticeText } from "@/domain/kyc/consent";

type Strings = Record<string, string>;
export type TrackerCopy = Record<"kyc" | "dispatch" | "technician" | "install" | "live", [string, (x: Record<string, string>) => string]>;
export interface ExplainCopy {
  chosen: (staff: number, sites: number, where: string) => string;
  base: (name: string) => string;
  needs: (list: string) => string;
  blocked: (k: number) => string;
  allOk: string;
}

/** Everything an owner sees, for one regional language. Missing keys fall back to English. */
export interface LangPack {
  chooser: { title: string; sub: string; owner: string; ownerSub: string; ownerCta: string; staff: string; chooseLang: string; wa: string; waSub: string };
  home: { title: string; sub: string; start: string; voice: string; how: string; steps: [string, string][]; why: string; perks: [string, string][] };
  steps: string[];
  advisorUi: Strings;
  copy: Copy;
  quote: Strings;
  profile: Strings;
  needLabel: Strings;
  explain: ExplainCopy;
  consent: NoticeText;
  kyc: Strings;
  track: Strings;
  tracker: TrackerCopy;
}
