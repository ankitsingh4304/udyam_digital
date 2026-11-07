import type { Need, Segment } from "../catalogue/types";

/** Cities in the dataset (smb_leads.csv) with their tier, plus common aliases. */
export const CITIES: { name: string; tier: 1 | 2; aliases: string[] }[] = [
  { name: "Ahmedabad", tier: 1, aliases: ["अहमदाबाद", "amdavad"] },
  { name: "Bengaluru", tier: 1, aliases: ["bangalore", "बेंगलुरु", "बैंगलोर"] },
  { name: "Chennai", tier: 1, aliases: ["madras", "चेन्नई"] },
  { name: "Delhi", tier: 1, aliases: ["new delhi", "दिल्ली"] },
  { name: "Hyderabad", tier: 1, aliases: ["हैदराबाद"] },
  { name: "Kolkata", tier: 1, aliases: ["calcutta", "कोलकाता"] },
  { name: "Mumbai", tier: 1, aliases: ["bombay", "मुंबई"] },
  { name: "Pune", tier: 1, aliases: ["पुणे"] },
  { name: "Bhopal", tier: 2, aliases: ["भोपाल"] },
  { name: "Coimbatore", tier: 2, aliases: ["कोयंबटूर"] },
  { name: "Indore", tier: 2, aliases: ["इंदौर"] },
  { name: "Jaipur", tier: 2, aliases: ["जयपुर"] },
  { name: "Kochi", tier: 2, aliases: ["cochin", "कोच्चि"] },
  { name: "Lucknow", tier: 2, aliases: ["लखनऊ"] },
  { name: "Ludhiana", tier: 2, aliases: ["लुधियाना"] },
  { name: "Mysuru", tier: 2, aliases: ["mysore", "मैसूर"] },
  { name: "Nagpur", tier: 2, aliases: ["नागपुर"] },
  { name: "Nashik", tier: 2, aliases: ["nasik", "नासिक"] },
  { name: "Patna", tier: 2, aliases: ["पटना"] },
  { name: "Surat", tier: 2, aliases: ["सूरत"] },
  { name: "Vadodara", tier: 2, aliases: ["baroda", "वडोदरा"] },
  { name: "Visakhapatnam", tier: 2, aliases: ["vizag", "विशाखापत्तनम"] },
];

export function findCity(text: string): { name: string; tier: 1 | 2 } | undefined {
  const t = text.toLowerCase();
  for (const c of CITIES) {
    if (new RegExp(`\\b${c.name.toLowerCase()}\\b`).test(t)) return c;
    for (const a of c.aliases) if (t.includes(a.toLowerCase())) return c;
  }
  return undefined;
}

/** Business-type keywords → segment. First match wins; checked in this order. */
export const SEGMENT_KEYWORDS: { segment: Segment; words: string[] }[] = [
  { segment: "mfg", words: ["factory", "manufactur", "workshop", "textile", "auto-parts", "auto parts", "moulding", "molding", "packaging", "printing press", "food processing", "फैक्ट्री", "कारखाना", "unit"] },
  { segment: "multi", words: ["chain", "branches", "outlets", "franchise", "चेन"] },
  { segment: "prof", words: ["clinic", "dental", "doctor", "hospital", "diagnostic", "lab", "physio", "ca firm", "chartered", "accountant", "law", "lawyer", "advocate", "coaching", "tuition", "office", "agency", "consult", "architect", "studio", "insurance", "real estate", "travel", "hotel", "क्लिनिक", "डॉक्टर", "ऑफिस", "कोचिंग", "दफ्तर"] },
  { segment: "micro", words: ["kirana", "grocery", "shop", "store", "dukaan", "dukan", "salon", "parlour", "parlor", "pharmacy", "chemist", "medical store", "bakery", "sweet", "boutique", "optician", "stationery", "hardware", "mobile repair", "restaurant", "cafe", "dhaba", "किराना", "दुकान", "सैलून", "बेकरी", "मेडिकल"] },
];

export const NEED_KEYWORDS: { need: Need; words: string[] }[] = [
  { need: "pos", words: ["pos", "billing", "upi", "card payment", "card machine", "swipe", "बिलिंग", "बिल"] },
  { need: "cctv", words: ["cctv", "camera", "surveillance", "कैमरा", "सीसीटीवी"] },
  { need: "whatsapp", words: ["whatsapp", "व्हाट्सएप", "वॉट्सऐप"] },
  { need: "sms", words: ["sms", "bulk message", "एसएमएस"] },
  { need: "email", words: ["email", "e-mail", "mail id", "office suite", "ईमेल"] },
  { need: "backup", words: ["cloud backup", "data backup", "backup of data", "बैकअप"] },
  { need: "security", words: ["antivirus", "virus", "ransomware", "endpoint", "cyber", "वायरस"] },
  { need: "failover", words: ["failover", "backup internet", "backup line", "internet goes down", "always online", "net chala jata", "नेट चला जाता"] },
  { need: "static_ip", words: ["static ip", "fixed ip", "public ip"] },
  { need: "website", words: ["website", "domain", "वेबसाइट"] },
  { need: "telephony", words: ["ivr", "call recording", "cloud telephony", "phone lines", "landline"] },
  { need: "tollfree", words: ["toll free", "toll-free", "1800"] },
  { need: "wifi", words: ["wifi", "wi-fi", "guest wifi", "वाईफाई"] },
  { need: "iot", words: ["machine monitoring", "iot", "sensor", "machines"] },
  { need: "fleet", words: ["fleet", "vehicle", "vehicles", "vans", "trucks", "delivery bikes", "gps", "गाड़ी"] },
  { need: "sdwan", words: ["sd-wan", "sdwan", "central management", "manage all sites"] },
  { need: "firewall", words: ["firewall", "फ़ायरवॉल"] },
  { need: "leased_line", words: ["leased line", "dedicated line", "dedicated internet", "लीज्ड लाइन"] },
];

/** Hindi/Hinglish number words that come up in sizes. */
export const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "बीस": 20,
};
