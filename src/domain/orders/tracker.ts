import { fromPacks } from "@/i18n/packs";
import type { Lang } from "../advisor/state";

export interface OrderPayload {
  v: 1;
  id: string;
  createdAt: string;
  business: string;
  city?: string;
  lines: { productId: string; name: string; quantity: number }[];
  monthly: number;
  setup: number;
  contractMonths: number;
  installDays: number;
  caseId: string;
  /** Documents were read by the backup reader: operations spot-check before activation. */
  spotCheck?: boolean;
  /** Chat the order came from (hashed id), for WhatsApp updates. */
  waRef?: string;
  /** Demo speed: 1 = real time; 1440 = one day passes per minute. */
  speed: number;
}

export type MilestoneStatus = "done" | "current" | "upcoming";
export type MilestoneKey = "kyc" | "dispatch" | "technician" | "install" | "live";
export const MILESTONE_KEYS: MilestoneKey[] = ["kyc", "dispatch", "technician", "install", "live"];
export interface Milestone {
  key: MilestoneKey;
  title: string;
  detail: string;
  at: string;
  status: MilestoneStatus;
  /** Set when operations reported a delay on this step. */
  delay?: { reason: string; newDate: string };
}

/** A status update from operations (warehouse, field team, network). Once any exists, the tracker follows them, not the clock. */
export interface OrderEvent {
  ts: string;
  kind: "done" | "delay";
  step: MilestoneKey;
  reason?: string;
  /** For delays: how many days this pushes the remaining steps back. */
  days?: number;
  /** For delays: the new expected date of the delayed step (ISO), for display and exports. */
  newDate?: string;
  by: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TECHS = ["Ravi Kumar", "Imran Shaikh", "Suresh Naidu", "Pradeep Yadav", "Anil Joseph", "Manoj Patil"];

const seed = (id: string) => [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const COPY: Record<Lang, Record<Milestone["key"], [string, (x: Record<string, string>) => string]>> = {
  en: {
    kyc: ["Documents verified", () => "Your documents passed every check. No visit needed."],
    dispatch: ["Equipment dispatched", (x) => `Router and SIMs packed. Courier tracking ${x.awb}.`],
    technician: ["Technician assigned", (x) => `${x.tech} (${x.phone}) will visit on ${x.slotDay}, ${x.slot}.`],
    install: ["Installation and line test", (x) => `Fibre/line installed and tested at your site. Expected by ${x.installDay}.`],
    live: ["You're live", (x) => `All services active. First bill on ${x.billDay}; one bill for everything.`],
  },
  hi: {
    kyc: ["डॉक्यूमेंट सत्यापित", () => "आपके डॉक्यूमेंट सभी जाँच में पास हुए। किसी विज़िट की ज़रूरत नहीं।"],
    dispatch: ["सामान भेजा गया", (x) => `राउटर और सिम पैक हो गए। कूरियर ट्रैकिंग ${x.awb}।`],
    technician: ["टेक्नीशियन तय", (x) => `${x.tech} (${x.phone}) ${x.slotDay}, ${x.slot} को आएँगे।`],
    install: ["इंस्टॉलेशन और लाइन टेस्ट", (x) => `आपकी साइट पर लाइन लगाकर टेस्ट की जाएगी। ${x.installDay} तक।`],
    live: ["सेवाएँ चालू", (x) => `सभी सेवाएँ चालू। पहला बिल ${x.billDay} को; सबके लिए एक ही बिल।`],
  },
  hinglish: {
    kyc: ["Documents verified", () => "Aapke documents saare checks mein pass. Koi visit nahi chahiye."],
    dispatch: ["Saamaan dispatch", (x) => `Router aur SIM pack ho gaye. Courier tracking ${x.awb}.`],
    technician: ["Technician assigned", (x) => `${x.tech} (${x.phone}) ${x.slotDay}, ${x.slot} ko aayenge.`],
    install: ["Installation aur line test", (x) => `Aapki site par line lagakar test hogi. ${x.installDay} tak.`],
    live: ["Aap live hain", (x) => `Saari services chalu. Pehla bill ${x.billDay} ko; sab ke liye ek hi bill.`],
  },
  ...fromPacks("tracker"),
};

/**
 * Milestones derived from the order time and the catalogue's install days. Pure: same order +
 * same "now" → same answer, so the owner sees exactly what support would see.
 */
export function milestones(o: OrderPayload, now: Date, lang: Lang = "en", events: OrderEvent[] = []): Milestone[] {
  const t0 = Date.parse(o.createdAt);
  const s = seed(o.id);
  // Real offsets, compressed by the demo speed factor.
  const at = (ms: number) => new Date(t0 + ms / Math.max(1, o.speed));
  // A reported delay pushes every remaining date back by its days (cumulative).
  const shift = events.filter((e) => e.kind === "delay").reduce((n, e) => n + (e.days ?? 0), 0) * DAY;
  const simAt = (ms: number) => new Date(t0 + ms + shift); // dates shown to the customer are real-world dates
  const install = Math.max(1, o.installDays);
  const slotStart = 10 + (s % 3) * 2;
  const x = {
    awb: `ACL${String(s).padStart(10, "0").slice(-10)}`,
    tech: TECHS[s % TECHS.length],
    phone: `98•••••${String(10 + (s % 89))}`,
    slotDay: fmtDay(simAt(Math.max(1, install - 1) * DAY)),
    slot: `${slotStart}:00–${slotStart + 2}:00`,
    installDay: fmtDay(simAt(install * DAY)),
    billDay: fmtDay(simAt(install * DAY + 30 * DAY)),
  };
  const plan: [Milestone["key"], number][] = [
    ["kyc", 0],
    ["dispatch", 4 * HOUR],
    ["technician", 1 * DAY],
    ["install", install * DAY],
    ["live", install * DAY + 2 * HOUR],
  ];
  const c = COPY[lang];
  let currentAssigned = false;

  // Operations mode: real status events drive the tracker (a step is done when its event arrives;
  // everything before a done step is done too). Delays carry a reason and a new date.
  if (events.length) {
    const doneAt = new Map<MilestoneKey, string>([["kyc", o.createdAt]]);
    for (const e of events) if (e.kind === "done") doneAt.set(e.step, e.ts);
    const lastDone = Math.max(...MILESTONE_KEYS.map((k, i) => (doneAt.has(k) ? i : -1)));
    const delays = new Map<MilestoneKey, OrderEvent>();
    for (const e of events) if (e.kind === "delay") delays.set(e.step, e);
    return plan.map(([key, offset], i) => {
      const done = i <= lastDone;
      let status: MilestoneStatus = done ? "done" : "upcoming";
      if (!done && !currentAssigned) {
        status = "current";
        currentAssigned = true;
      }
      const d = !done ? delays.get(key) : undefined;
      const stamp = doneAt.get(key);
      return {
        key,
        title: c[key][0],
        detail: c[key][1](x),
        at: done && stamp ? fmt(new Date(stamp)) : fmt(simAt(offset)),
        status,
        ...(d ? { delay: { reason: d.reason ?? "", newDate: fmtDay(simAt(offset)) } } : {}),
      };
    });
  }

  return plan.map(([key, offset]) => {
    const when = at(offset);
    const done = now.getTime() >= when.getTime();
    let status: MilestoneStatus = done ? "done" : "upcoming";
    if (!done && !currentAssigned) {
      status = "current";
      currentAssigned = true;
    }
    return { key, title: c[key][0], detail: c[key][1](x), at: fmt(simAt(offset)), status };
  });
}

/** Planned real-world date of a step after delays (used to stamp a delay event's newDate). */
export function plannedDate(o: OrderPayload, step: MilestoneKey, events: OrderEvent[]): Date {
  const offsets: Record<MilestoneKey, number> = { kyc: 0, dispatch: 4 * HOUR, technician: DAY, install: Math.max(1, o.installDays) * DAY, live: Math.max(1, o.installDays) * DAY + 2 * HOUR };
  const shift = events.filter((e) => e.kind === "delay").reduce((n, e) => n + (e.days ?? 0), 0) * DAY;
  return new Date(Date.parse(o.createdAt) + offsets[step] + shift);
}

/** The next step operations can mark done, or undefined when the order is live. */
export function nextStep(events: OrderEvent[]): MilestoneKey | undefined {
  const done = new Set<MilestoneKey>(["kyc", ...events.filter((e) => e.kind === "done").map((e) => e.step)]);
  const last = Math.max(...MILESTONE_KEYS.map((k, i) => (done.has(k) ? i : -1)));
  return MILESTONE_KEYS[last + 1];
}

/** Promised activation, shown on the order page and used as the SLA. */
export function promisedBy(o: OrderPayload, events: OrderEvent[] = []): string {
  const shift = events.filter((e) => e.kind === "delay").reduce((n, e) => n + (e.days ?? 0), 0) * DAY;
  return fmtDay(new Date(Date.parse(o.createdAt) + shift + (Math.max(1, o.installDays) * DAY + 2 * HOUR)));
}
