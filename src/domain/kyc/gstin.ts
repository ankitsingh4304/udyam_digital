/** GSTIN structure: 2-digit state + 10-char PAN + entity number + 'Z' + checksum. */
export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};

/** GSTN check digit: weighted mod-36 over the first 14 characters. */
export function gstinCheckChar(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARSET.indexOf(first14[i]);
    if (v < 0) return "?";
    const product = v * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (total % 36)) % 36];
}

export interface GstinIssue {
  code: "LENGTH" | "BAD_CHAR" | "DIGIT_IN_LETTER_SLOT" | "LETTER_IN_DIGIT_SLOT" | "BAD_STATE" | "NO_Z" | "CHECKSUM";
  message: string;
  position?: number; // 1-based
}

// Expected character class per position (1-based index in comments).
const SLOT: ("d" | "L" | "a" | "Z")[] = ["d", "d", "L", "L", "L", "L", "L", "d", "d", "d", "d", "L", "a", "Z", "a"];

/**
 * Validate exactly what was read. Never "fixes" characters: a document that prints
 * a digit where a letter must be is a defective document, not an OCR error to correct.
 */
export function validateGstin(raw: string): { ok: boolean; issues: GstinIssue[]; stateCode: string } {
  const s = raw.trim().toUpperCase();
  const issues: GstinIssue[] = [];
  if (s.length !== 15) {
    issues.push({ code: "LENGTH", message: `GSTIN must be 15 characters; got ${s.length}.` });
    return { ok: false, issues, stateCode: s.slice(0, 2) };
  }
  for (let i = 0; i < 15; i++) {
    const ch = s[i];
    const pos = i + 1;
    const isDigit = /\d/.test(ch);
    const isLetter = /[A-Z]/.test(ch);
    if (!isDigit && !isLetter) issues.push({ code: "BAD_CHAR", message: `Character ${pos} ('${ch}') is not allowed.`, position: pos });
    else if (SLOT[i] === "L" && isDigit)
      issues.push({ code: "DIGIT_IN_LETTER_SLOT", message: `Character ${pos} is the digit '${ch}', but this PAN position must be a letter.`, position: pos });
    else if (SLOT[i] === "d" && isLetter)
      issues.push({ code: "LETTER_IN_DIGIT_SLOT", message: `Character ${pos} is the letter '${ch}', but this position must be a digit.`, position: pos });
    else if (SLOT[i] === "Z" && ch !== "Z") issues.push({ code: "NO_Z", message: `Character 14 must be 'Z'; got '${ch}'.`, position: 14 });
  }
  if (!STATE_CODES[s.slice(0, 2)] && /^\d{2}$/.test(s.slice(0, 2)))
    issues.push({ code: "BAD_STATE", message: `State code ${s.slice(0, 2)} does not exist.`, position: 1 });
  const expected = gstinCheckChar(s.slice(0, 14));
  if (expected !== s[14])
    issues.push({ code: "CHECKSUM", message: `Check digit is '${s[14]}' but the first 14 characters require '${expected}'. The number has been altered or mistyped.`, position: 15 });
  return { ok: issues.length === 0 && GSTIN_REGEX.test(s), issues, stateCode: s.slice(0, 2) };
}

export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Mask for UI/logs: keep state code + first 3 PAN chars + last 3. */
export const maskGstin = (g: string) => (g.length === 15 ? `${g.slice(0, 5)}•••••••${g.slice(12)}` : "•••");
