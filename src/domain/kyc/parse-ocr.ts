import type { DocKind } from "./types";

/** Fields any reader (vision model or OCR) returns for one document image. */
export interface DocFields {
  docType: DocKind | "unknown";
  gstin?: string;
  legalName?: string;
  tradeName?: string;
  constitution?: string;
  address?: string;
  dateOfLiability?: string;
  udyamNumber?: string;
  enterpriseName?: string;
  majorActivity?: string;
  city?: string;
  state?: string;
  dateOfRegistration?: string;
  name?: string;
  designation?: string;
  business?: string;
  validTill?: string;
  billedTo?: string;
  billDate?: string;
  /** OCR only: how sure Tesseract was about the GSTIN (0–100). */
  gstinConfidence?: number;
  /** OCR only: the GSTIN line exactly as read (may hold a stray character). Never shown. */
  gstinRaw?: string;
}

export function classify(text: string): DocFields["docType"] {
  const t = text.toLowerCase();
  if (t.includes("gst registration")) return "gst";
  if (t.includes("udyam registration")) return "udyam";
  if (t.includes("signatory")) return "signatory";
  if (t.includes("electricity bill") || t.includes("bill date")) return "addressProof";
  return "unknown";
}

const DATE = /(\d{4}-\d{2}-\d{2})/;

/** A GSTIN-shaped token anywhere on the page, for when the "GSTIN" label itself was misread. */
function gstinLike(lines: string[]): string | undefined {
  for (const l of lines) {
    const m = l.replace(/\s+/g, "").toUpperCase().match(/[0-9OIS]{2}[A-Z0-9]{5}[0-9OISB]{4}[A-Z0-9][A-Z0-9][Z27][A-Z0-9]/);
    if (m) return m[0];
  }
  return undefined;
}

/** Add the PIN when the wrapped address line lost it but "- 123456" is readable elsewhere on the page. */
function withPin(address: string | undefined, text: string): string | undefined {
  if (address && /\d{6}\s*$/.test(address.replace(/\s+(?=\d)/g, ""))) return address;
  const pin = text.match(/-\s*(\d{6})(?!\d)/)?.[1];
  return pin ? `${address ?? ""}${address ? " - " : ""}${pin}` : address;
}
const clean = (s?: string) => s?.replace(/\s+/g, " ").trim() || undefined;

/** Value on the same line after a label: "Legal name Neha Kaur (Prop. X)". */
function after(lines: string[], label: RegExp): string | undefined {
  for (const l of lines) {
    const m = l.match(label);
    if (m) return clean(l.slice((m.index ?? 0) + m[0].length));
  }
  return undefined;
}

/** Value on the line below a label (signatory card layout). */
function below(lines: string[], label: RegExp): string | undefined {
  const i = lines.findIndex((l) => label.test(l.trim()));
  return i >= 0 ? clean(lines[i + 1]) : undefined;
}

/** Wrapped address: first part after `startLabel`, continuation on the next line after `contLabel` (or alone). */
function wrapped(lines: string[], startLabel: RegExp, contLabel?: RegExp): string | undefined {
  const i = lines.findIndex((l) => startLabel.test(l));
  if (i < 0) return undefined;
  const first = lines[i].replace(startLabel, "").trim();
  let next = lines[i + 1] ?? "";
  if (contLabel) next = next.replace(contLabel, "").trim();
  if (/^(bill date|date of|units|type of)/i.test(next)) next = "";
  // The certificate wraps at a fixed width, often mid-word, so join without a space.
  return clean(`${first}${next}`.replace(/\s*-{1,2}\s*(\d)/, " - $1"));
}

/**
 * Turn raw OCR text into fields. Used only when no vision model is reachable.
 * GSTIN: letters that OCR confuses with digits (O,I,S,B,Z) are mapped back to digits
 * ONLY in positions that must be digits. Digits in letter positions are kept as read,
 * so a document that really prints '0' where a letter belongs is still caught.
 */
export function parseOcrText(text: string): DocFields {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const docType = classify(text);
  const f: DocFields = { docType };
  if (docType === "gst") {
    const raw = (after(lines, /^GSTIN\s*/i) ?? gstinLike(lines))?.replace(/\s+/g, "").toUpperCase();
    f.gstin = raw ? fixOcrConfusions(raw.slice(0, 15)) : undefined;
    if (raw) f.gstinRaw = raw.slice(0, 17);
    f.legalName = after(lines, /^Legal name\s*/i);
    f.tradeName = after(lines, /^Trade name\s*/i);
    f.constitution = after(lines, /^Constitution\s*/i);
    f.address = wrapped(lines, /^Address of principal\s*/i, /^place of business\s*/i);
    f.dateOfLiability = after(lines, /^Date of liability\s*/i)?.match(DATE)?.[1] ?? text.match(DATE)?.[1];
    f.address = withPin(f.address, text);
  } else if (docType === "udyam") {
    f.udyamNumber = after(lines, /^Udyam reg\.? number\s*/i)?.replace(/\s+/g, "").toUpperCase() || undefined;
    f.enterpriseName = after(lines, /^Enterprise name\s*/i);
    f.majorActivity = after(lines, /^Major activity\s*/i);
    f.city = after(lines, /^City\s*/i);
    f.state = after(lines, /^State\s*/i);
    f.dateOfRegistration = after(lines, /^Date of registration\s*/i)?.match(DATE)?.[1] ?? text.match(DATE)?.[1];
  } else if (docType === "signatory") {
    f.name = below(lines, /^Name$/i);
    f.designation = below(lines, /^Designation$/i);
    f.business = below(lines, /^For business$/i);
    f.validTill = below(lines, /^Valid till$/i)?.match(DATE)?.[1] ?? text.match(DATE)?.[1];
  } else if (docType === "addressProof") {
    f.billedTo = after(lines, /^Billed to\s*/i);
    f.address = wrapped(lines, /^Supply address\s*/i);
    // The bill's only YYYY-MM-DD date is the bill date, so fall back to it when the label line is garbled.
    f.billDate = after(lines, /^Bill date\s*/i)?.match(DATE)?.[1] ?? text.match(DATE)?.[1];
    f.address = withPin(f.address, text);
  }
  return f;
}

const DIGIT_SLOTS = [0, 1, 7, 8, 9, 10];
const LETTER_TO_DIGIT: Record<string, string> = { O: "0", D: "0", "©": "0", Q: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" };

/** Position 14 is always the letter Z; Tesseract often reads it as 7 or 2. */
const Z_SLOT = 13;

export function fixOcrConfusions(g: string): string {
  return g
    .split("")
    .map((ch, i) => {
      if (DIGIT_SLOTS.includes(i) && LETTER_TO_DIGIT[ch]) return LETTER_TO_DIGIT[ch];
      if (i === Z_SLOT && (ch === "7" || ch === "2")) return "Z";
      return ch;
    })
    .join("");
}

/** Look-alike pairs that keep the character class (letter↔letter, digit↔digit). */
const LOOKALIKES: Record<string, string[]> = {
  I: ["J", "L", "T"], J: ["I"], L: ["I"], T: ["I"], O: ["Q", "D"], Q: ["O"], D: ["O"], U: ["V"], V: ["U"],
  M: ["N"], N: ["M"], E: ["F"], F: ["E"], C: ["G"], G: ["C"],
  "1": ["7"], "7": ["1"], "3": ["8"], "8": ["3"], "5": ["6"], "6": ["5"],
};

/** One-character look-alike variants of an OCR'd GSTIN (for registry confirmation only). */
export function lookalikeVariants(g: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < g.length; i++) for (const alt of LOOKALIKES[g[i]] ?? []) out.push(g.slice(0, i) + alt + g.slice(i + 1));
  return out;
}

const DIGIT_LOOKS_LIKE: Record<string, string> = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z" };
const LETTER_SLOTS = [2, 3, 4, 5, 6, 11];

/**
 * Combine the vision model's GSTIN with Tesseract's. Vision models tend to "fix" a printed
 * digit in a letter position (reading 24X0R… as 24XOR…), which would hide exactly the
 * tampering we look for. Tesseract reports what is printed there, so in letter positions a
 * Tesseract digit beats the vision model's look-alike letter. Everywhere else vision wins.
 */
export function mergeGstinReads(vision?: string, ocr?: string): { gstin?: string; overridden: number[] } {
  if (!vision || !ocr || vision.length !== 15 || ocr.length !== 15) return { gstin: vision ?? ocr, overridden: [] };
  const out = vision.split("");
  const overridden: number[] = [];
  for (const i of LETTER_SLOTS) {
    const o = ocr[i];
    if (DIGIT_LOOKS_LIKE[o] && vision[i] === DIGIT_LOOKS_LIKE[o]) {
      out[i] = o;
      overridden.push(i + 1);
    }
  }
  return { gstin: out.join(""), overridden };
}

/** Printed digits that a reader may confuse with a letter in a letter-only GSTIN position. */
const DIGIT_TO_LETTERS: Record<string, string[]> = { "0": ["O", "D", "Q"], "1": ["I", "L", "J", "T"], "2": ["Z"], "4": ["A"], "5": ["S"], "6": ["G"], "7": ["Z", "T"], "8": ["B"] };

const LETTER_TO_DIGITS: Record<string, string[]> = { U: ["0"], G: ["6"], A: ["4"], T: ["7"], Q: ["0"], D: ["0"], O: ["0"], I: ["1"], L: ["1"], S: ["5"], B: ["8"], Z: ["2"] };

export interface GstinCandidate {
  gstin: string;
  /** 1-based positions where a digit in a letter-only position was replaced by a look-alike letter. */
  letterSlotDigits: number[];
}

/**
 * Plausible readings of a GSTIN that failed validation, for registry confirmation only.
 * Covers what readers get wrong on a clean certificate: one stray character (16 read), a bracket
 * for J, class-preserving look-alikes (I/J, M/N, 1/7…) and digits read in letter positions (O/0,
 * I/1, S/5, B/8, Z/2). At most two substitutions. The caller must confirm a candidate in the
 * registry under the certificate's own business name, and must not auto-accept letterSlotDigits.
 */
export function gstinCandidates(read: string): GstinCandidate[] {
  const raw = read.toUpperCase().replace(/\]/g, "J").replace(/\|/g, "I").replace(/[^0-9A-Z]/g, "");
  const bases = new Set<string>();
  if (raw.length === 15) bases.add(fixOcrConfusions(raw));
  if (raw.length === 16) for (let i = 0; i < 16; i++) bases.add(fixOcrConfusions(raw.slice(0, i) + raw.slice(i + 1)));
  const options = (g: string, i: number): { ch: string; letterSlot: boolean }[] => {
    const out = (LOOKALIKES[g[i]] ?? []).map((ch) => ({ ch, letterSlot: false }));
    if (LETTER_SLOTS.includes(i)) for (const ch of DIGIT_TO_LETTERS[g[i]] ?? []) out.push({ ch, letterSlot: true });
    // A letter in a digit-only position is always a misread (a digit can't be "altered" into a letter there).
    if (DIGIT_SLOTS.includes(i)) for (const ch of LETTER_TO_DIGITS[g[i]] ?? []) out.push({ ch, letterSlot: false });
    // Entity number and check character may be a letter or a digit: 8/B, 0/O, 5/S… are plain misreads there.
    if (i === 12 || i === 14) {
      if (DIGIT_LOOKS_LIKE[g[i]]) out.push({ ch: DIGIT_LOOKS_LIKE[g[i]], letterSlot: false });
      for (const [d, l] of Object.entries(DIGIT_LOOKS_LIKE)) if (l === g[i]) out.push({ ch: d, letterSlot: false });
    }
    return out;
  };
  const seen = new Map<string, GstinCandidate>();
  const put = (gstin: string, letterSlotDigits: number[]) => {
    const prev = seen.get(gstin);
    if (!prev || letterSlotDigits.length < prev.letterSlotDigits.length) seen.set(gstin, { gstin, letterSlotDigits });
  };
  for (const b of bases) {
    put(b, []);
    for (let i = 0; i < 15; i++)
      for (const a of options(b, i)) {
        const one = b.slice(0, i) + a.ch + b.slice(i + 1);
        put(one, a.letterSlot ? [i + 1] : []);
        for (let j = i + 1; j < 15; j++)
          for (const c of options(one, j)) put(one.slice(0, j) + c.ch + one.slice(j + 1), [...(a.letterSlot ? [i + 1] : []), ...(c.letterSlot ? [j + 1] : [])]);
      }
  }
  return [...seen.values()];
}
