import type { Lang, Slot } from "./state";

type Copy = {
  greet: string;
  questions: Record<Slot, string>;
  quick: Record<Slot, string[]>;
  ack: string;
  unknownCity: (city: string) => string;
  gstinInvalid: (reason: string) => string;
  gstinInactive: (status: string) => string;
  gstinNotFound: string;
  gstinActive: (name: string) => string;
  noGstin: string;
  ready: string;
  blockedHeader: string;
  perMonth: string;
  setup: string;
  contract: (m: number) => string;
};

export const COPY: Record<Lang, Copy> = {
  en: {
    greet: "Hi! I'll suggest the right internet, phone and digital tools for your business in 5 quick questions. No salesperson, one clear monthly price.",
    questions: {
      businessType: "What kind of business do you run? (e.g. kirana store, clinic, CA office, restaurant chain, factory)",
      size: "How many people work there, and how many shops or branches do you have?",
      city: "Which city is the business in?",
      gstin: "Do you have a GSTIN? Type it here, or say \"no\". We check it instantly with the GST registry.",
      needs: "What else would help? For example UPI/card billing, CCTV, WhatsApp for customers, business email, backup internet. Or say \"that's all\".",
    },
    quick: {
      businessType: ["Kirana store", "Dental clinic", "CA office", "Restaurant chain", "Small factory"],
      size: ["2 staff, 1 shop", "8 staff, 1 office", "40 staff, 5 outlets", "60 staff, 1 factory"],
      city: ["Mumbai", "Delhi", "Bengaluru", "Nagpur", "Jaipur"],
      gstin: ["No GSTIN"],
      needs: ["UPI billing", "CCTV", "WhatsApp", "Business email", "Backup internet", "That's all"],
    },
    ack: "Got it.",
    unknownCity: (c) => `I don't have ${c} on our coverage list yet, so I'll only suggest products sold in every city.`,
    gstinInvalid: (r) => `That GSTIN doesn't look right: ${r} Please check it, or say "no".`,
    gstinInactive: (s) => `The GST registry shows this GSTIN as ${s}. I'll suggest products that don't need an active GSTIN.`,
    gstinNotFound: "I couldn't find that GSTIN in the registry, so I'll suggest products that don't need one.",
    gstinActive: (n) => `GSTIN verified: ${n}, active.`,
    noGstin: "No problem. I'll only suggest products that don't need a GSTIN.",
    ready: "Here's the bundle I recommend:",
    blockedHeader: "Not offered, and why:",
    perMonth: "/month",
    setup: "one-time setup",
    contract: (m) => `${m}-month contract`,
  },
  hi: {
    greet: "नमस्ते! 5 आसान सवालों में मैं आपके बिज़नेस के लिए सही इंटरनेट, फ़ोन और डिजिटल टूल सुझाऊँगा। कोई सेल्समैन नहीं, एक साफ़ मासिक कीमत।",
    questions: {
      businessType: "आपका बिज़नेस किस तरह का है? (जैसे किराना दुकान, क्लिनिक, CA ऑफिस, रेस्टोरेंट चेन, फैक्ट्री)",
      size: "वहाँ कितने लोग काम करते हैं, और आपकी कितनी दुकानें या ब्रांच हैं?",
      city: "बिज़नेस किस शहर में है?",
      gstin: "क्या आपके पास GSTIN है? यहाँ लिखें, या \"नहीं\" कहें। हम इसे तुरंत GST रजिस्ट्री से जाँचते हैं।",
      needs: "और क्या चाहिए? जैसे UPI/कार्ड बिलिंग, CCTV, ग्राहकों के लिए WhatsApp, बिज़नेस ईमेल, बैकअप इंटरनेट। या \"बस\" कहें।",
    },
    quick: {
      businessType: ["किराना दुकान", "डेंटल क्लिनिक", "CA ऑफिस", "रेस्टोरेंट चेन", "छोटी फैक्ट्री"],
      size: ["2 स्टाफ, 1 दुकान", "8 स्टाफ, 1 ऑफिस", "40 स्टाफ, 5 ब्रांच", "60 स्टाफ, 1 फैक्ट्री"],
      city: ["मुंबई", "दिल्ली", "बेंगलुरु", "नागपुर", "जयपुर"],
      gstin: ["नहीं"],
      needs: ["UPI बिलिंग", "CCTV", "WhatsApp", "बिज़नेस ईमेल", "बैकअप इंटरनेट", "बस"],
    },
    ack: "ठीक है।",
    unknownCity: (c) => `${c} अभी हमारी सूची में नहीं है, इसलिए मैं वही प्रोडक्ट सुझाऊँगा जो हर शहर में मिलते हैं।`,
    gstinInvalid: (r) => `यह GSTIN सही नहीं लग रहा: ${r} कृपया जाँचें, या "नहीं" कहें।`,
    gstinInactive: (s) => `GST रजिस्ट्री में यह GSTIN ${s} दिख रहा है। मैं वही प्रोडक्ट सुझाऊँगा जिनके लिए एक्टिव GSTIN ज़रूरी नहीं।`,
    gstinNotFound: "यह GSTIN रजिस्ट्री में नहीं मिला, इसलिए मैं बिना GSTIN वाले प्रोडक्ट सुझाऊँगा।",
    gstinActive: (n) => `GSTIN सत्यापित: ${n}, एक्टिव।`,
    noGstin: "कोई बात नहीं। मैं सिर्फ़ वही प्रोडक्ट सुझाऊँगा जिनके लिए GSTIN ज़रूरी नहीं।",
    ready: "मेरा सुझाया हुआ बंडल:",
    blockedHeader: "ये नहीं दिए जा सकते, और क्यों:",
    perMonth: "/महीना",
    setup: "एक बार का सेटअप",
    contract: (m) => `${m} महीने का कॉन्ट्रैक्ट`,
  },
  hinglish: {
    greet: "Namaste! 5 simple sawaalon mein main aapke business ke liye sahi internet, phone aur digital tools suggest karunga. Koi salesman nahi, ek clear monthly price.",
    questions: {
      businessType: "Aapka business kis type ka hai? (jaise kirana store, clinic, CA office, restaurant chain, factory)",
      size: "Kitne log kaam karte hain, aur kitni shops ya branches hain?",
      city: "Business kis city mein hai?",
      gstin: "Kya aapke paas GSTIN hai? Yahan type karein, ya \"nahi\" bolein. Hum turant GST registry se check karte hain.",
      needs: "Aur kya chahiye? Jaise UPI/card billing, CCTV, customers ke liye WhatsApp, business email, backup internet. Ya \"bas\" bolein.",
    },
    quick: {
      businessType: ["Kirana store", "Dental clinic", "CA office", "Restaurant chain", "Chhoti factory"],
      size: ["2 staff, 1 shop", "8 staff, 1 office", "40 staff, 5 outlets", "60 staff, 1 factory"],
      city: ["Mumbai", "Delhi", "Bengaluru", "Nagpur", "Jaipur"],
      gstin: ["GSTIN nahi hai"],
      needs: ["UPI billing", "CCTV", "WhatsApp", "Business email", "Backup internet", "Bas"],
    },
    ack: "Theek hai.",
    unknownCity: (c) => `${c} abhi hamari list mein nahi hai, isliye main wahi products suggest karunga jo har city mein milte hain.`,
    gstinInvalid: (r) => `Yeh GSTIN sahi nahi lag raha: ${r} Please check karein, ya "nahi" bolein.`,
    gstinInactive: (s) => `GST registry mein yeh GSTIN ${s} hai. Main wahi products suggest karunga jinke liye active GSTIN zaroori nahi.`,
    gstinNotFound: "Yeh GSTIN registry mein nahi mila, isliye main bina GSTIN wale products suggest karunga.",
    gstinActive: (n) => `GSTIN verified: ${n}, active.`,
    noGstin: "Koi baat nahi. Main sirf wahi products suggest karunga jinke liye GSTIN zaroori nahi.",
    ready: "Mera suggested bundle:",
    blockedHeader: "Yeh nahi mil sakte, aur kyun:",
    perMonth: "/month",
    setup: "one-time setup",
    contract: (m) => `${m} mahine ka contract`,
  },
};

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
