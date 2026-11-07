import type { Need } from "../catalogue/types";
import { NEED_KEYWORDS, NUMBER_WORDS, SEGMENT_KEYWORDS, findCity } from "./lexicon";
import type { ProfileDelta, Slot } from "./state";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Latin words match at a word start (short words must match whole); Devanagari as substrings. */
export function hasWord(text: string, word: string): boolean {
  if (!/^[\x00-\x7f]+$/.test(word)) return text.includes(word);
  const tail = word.length <= 3 ? "(?![a-z0-9])" : "";
  return new RegExp(`(^|[^a-z0-9])${esc(word)}${tail}`).test(text);
}

const NUM = `(\\d+|${Object.keys(NUMBER_WORDS).map(esc).join("|")})`;
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s]);

const STAFF_UNITS = "staff|employees?|people|persons?|workers?|members?|log|logon|karmachari|kaamgaar|स्टाफ|लोग|कर्मचारी|आदमी";
const SITE_UNITS = "sites?|outlets?|branch(?:es)?|stores?|shops?|locations?|offices?|centres?|centers?|clinics?|dukaan(?:e|en)?|शाखा(?:एं|एँ)?|दुकान(?:ें)?|ब्रांच";

const NO = /^(no|nope|nahi|nahin|na|नहीं|नही|none|don'?t have|not registered)(?![a-z])/;

/**
 * Deterministic parser for English, Hindi and Hinglish. Used when no LLM is
 * reachable, and always for exact values (GSTIN, product codes).
 */
export function extractOffline(raw: string, lastAsked?: Slot): ProfileDelta {
  const text = raw.toLowerCase().trim();
  const d: ProfileDelta = {};

  // Business type → segment.
  for (const { segment, words } of SEGMENT_KEYWORDS) {
    const hit = words.find((w) => hasWord(text, w));
    if (hit) {
      d.segment = segment;
      d.businessType = hit;
      break;
    }
  }

  // Sizes.
  const staff = text.match(new RegExp(`${NUM}\\s*(?:${STAFF_UNITS})(?![a-z])`));
  if (staff) d.employees = toNum(staff[1]);
  const sites = text.match(new RegExp(`${NUM}\\s*(?:${SITE_UNITS})(?![a-z])`));
  if (sites) d.sites = toNum(sites[1]);
  if (lastAsked === "size" && d.employees == null) {
    const nums = [...text.matchAll(new RegExp(NUM, "g"))].map((m) => toNum(m[1])).filter((n) => n != null);
    if (nums.length >= 1) d.employees = nums[0];
    if (nums.length >= 2 && d.sites == null) d.sites = nums[1];
  }
  if (lastAsked === "size" && d.employees != null && d.sites == null && /\b(one|single|ek|1)\s*(place|jagah|location|site|shop|dukaan)|सिर्फ एक|only one/.test(text)) d.sites = 1;

  // City.
  const city = findCity(text);
  if (city) d.city = city.name;
  else if (lastAsked === "city" && text.length <= 40 && /^[\p{L} .-]+$/u.test(raw.trim())) d.city = raw.trim();

  // GSTIN (exact string, uppercased; never corrected).
  const g = raw.toUpperCase().match(/\b\d{2}[A-Z0-9]{13}\b/);
  if (g) {
    d.gstin = g[0];
    d.hasGstin = true;
  } else if (lastAsked === "gstin" && NO.test(text)) d.hasGstin = false;
  else if (/\b(no|without|nahi|nahin)\s*(gst|gstin)\b|gst nahi|जीएसटी नहीं/.test(text)) d.hasGstin = false;

  // Needs.
  const needs: Need[] = [];
  for (const { need, words } of NEED_KEYWORDS) if (words.some((w) => hasWord(text, w))) needs.push(need);
  if (needs.length) d.needs = needs;
  if (lastAsked === "needs" && !needs.length && (NO.test(text) || /^(nothing|that'?s all|bas|बस|kuch nahi|just internet)/.test(text))) d.noMoreNeeds = true;

  const fleet = text.match(new RegExp(`${NUM}\\s*(?:vehicles?|vans?|trucks?|bikes?|गाड़ियाँ|gaadi)`));
  if (fleet) d.fleetSize = toNum(fleet[1]);

  // Connectivity.
  if (/\b1\s*(gbps|gb\/s|g\b)|gigabit|1000\s*mbps/.test(text)) d.wantsSpeed = "1g";
  else if (/\b300\s*mbps/.test(text)) d.wantsSpeed = "300";
  else if (/\b100\s*mbps/.test(text)) d.wantsSpeed = "100";
  if (/(no|not available|nahi|नहीं)\s*(fib(re|er)|फाइबर)|fib(re|er)\s*(not available|nahi|isn'?t available)|फाइबर नहीं/.test(text)) d.fibreAvailable = false;
  if (/\b(only|just|sirf)\s*(a\s*)?(sim|sims|mobile|postpaid)|सिर्फ सिम/.test(text)) d.mobileOnly = true;
  const sims = text.match(new RegExp(`${NUM}\\s*(?:sims?|lines?|connections?|सिम)`));
  if (sims) d.simCount = toNum(sims[1]);

  // Current tools (asked as "what do you use today?").
  if (/hotspot|mobile data|phone (ka )?(data|net)|हॉटस्पॉट|मोबाइल डेटा/.test(text)) d.currentInternet = "hotspot";
  else if (/home broadband|ghar ka|घर का|home wifi|home wi-fi/.test(text)) d.currentInternet = "home_broadband";
  else if (/leased line|लीज़्ड लाइन|लीज्ड लाइन|dedicated line/.test(text) && lastAsked === "tools") d.currentInternet = "leased_line";
  else if (/broadband|ब्रॉडबैंड|fibre|fiber/.test(text) && lastAsked === "tools") d.currentInternet = "business_broadband";
  else if (lastAsked === "tools" && (/no internet|internet nahi|इंटरनेट नहीं|nothing|kuch nahi|abhi nahi/.test(text) || NO.test(text))) d.currentInternet = "none";
  const provider = text.match(/\b(jio|airtel|vi|vodafone|bsnl|act|hathway|tata play|excitel)\b/);
  if (provider) d.currentProvider = provider[1];
  if (/billing machine|pos machine|swipe machine|बिलिंग मशीन/.test(text)) d.hasPos = !/no |nahi|नहीं/.test(text);

  const codes = raw.toUpperCase().match(/\bP\d{2}\b/g);
  if (codes) d.requestedProducts = [...new Set(codes)];

  return d;
}
