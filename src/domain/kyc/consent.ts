import { z } from "zod";
import { fromPacks } from "@/i18n/packs";
import type { Lang } from "../advisor/state";

export const NOTICE_VERSION = "2026-11-v1";

export const PURPOSES = ["kyc", "installation", "offers"] as const;
export type Purpose = (typeof PURPOSES)[number];
export const REQUIRED_PURPOSES: Purpose[] = ["kyc", "installation"];

export const ConsentRequestSchema = z.object({
  purposes: z.object({ kyc: z.boolean(), installation: z.boolean(), offers: z.boolean() }),
  lang: z.enum(["en", "hi", "hinglish"]).default("en"),
  noticeVersion: z.literal(NOTICE_VERSION),
});

export type NoticeText = {
  title: string;
  intro: string;
  purposes: Record<Purpose, { label: string; detail: string }>;
  collect: string[];
  notCollect: string;
  retention: string[];
  rights: string;
  required: string;
  optional: string;
  agree: string;
};

/** DPDP notice: itemised purposes, what we collect, how long we keep it, and your rights. */
export const NOTICE: Record<Lang, NoticeText> = {
  en: {
    title: "Before you upload documents",
    intro: "Accel Business needs a few documents to open your business connection, as telecom rules require. Choose what we may use them for.",
    purposes: {
      kyc: { label: "Verify your business and open the connection", detail: "We check your GSTIN and Udyam with government registries and fill the customer application form." },
      installation: { label: "Schedule installation", detail: "We share your name, phone and site address with the technician assigned to you." },
      offers: { label: "Send me offers", detail: "Occasional WhatsApp or SMS offers for your business. Turn off anytime." },
    },
    collect: ["GST certificate", "Udyam certificate (optional; we can fetch it)", "Authorised signatory's ID", "Electricity bill for the site"],
    notCollect: "We don't keep bill amounts, units used or full ID numbers.",
    retention: [
      "Document images: deleted within 24 hours of the check (immediately if rejected).",
      "Verified details (GSTIN, business name, check results): kept as long as telecom licence rules require for customer records.",
      "If you don't go ahead: everything deleted within 90 days.",
    ],
    rights: "You can withdraw consent on this page anytime. After ordering, download your data or ask us to delete it from your order page.",
    required: "Required",
    optional: "Optional",
    agree: "Agree and continue",
  },
  hi: {
    title: "डॉक्यूमेंट अपलोड करने से पहले",
    intro: "टेलीकॉम नियमों के अनुसार, आपका बिज़नेस कनेक्शन खोलने के लिए Accel Business को कुछ डॉक्यूमेंट चाहिए। चुनें कि हम इनका उपयोग किस लिए कर सकते हैं।",
    purposes: {
      kyc: { label: "बिज़नेस की जाँच और कनेक्शन खोलना", detail: "हम आपका GSTIN और Udyam सरकारी रजिस्ट्री से जाँचते हैं और ग्राहक आवेदन फ़ॉर्म भरते हैं।" },
      installation: { label: "इंस्टॉलेशन शेड्यूल करना", detail: "आपका नाम, फ़ोन और पता सिर्फ़ आपके टेक्नीशियन के साथ साझा होगा।" },
      offers: { label: "मुझे ऑफ़र भेजें", detail: "कभी-कभी WhatsApp या SMS पर ऑफ़र। कभी भी बंद करें।" },
    },
    collect: ["GST सर्टिफ़िकेट", "Udyam सर्टिफ़िकेट (वैकल्पिक; हम खुद निकाल सकते हैं)", "अधिकृत हस्ताक्षरकर्ता की ID", "साइट का बिजली बिल"],
    notCollect: "हम बिल की राशि, यूनिट या पूरा ID नंबर नहीं रखते।",
    retention: [
      "डॉक्यूमेंट की तस्वीरें: जाँच के 24 घंटे में हटा दी जाती हैं (रिजेक्ट होने पर तुरंत)।",
      "सत्यापित जानकारी (GSTIN, बिज़नेस नाम, जाँच के नतीजे): टेलीकॉम लाइसेंस नियमों के अनुसार जितना ज़रूरी हो।",
      "अगर आप आगे नहीं बढ़ते: 90 दिनों में सब हटा दिया जाता है।",
    ],
    rights: "आप इसी पेज पर कभी भी सहमति वापस ले सकते हैं। ऑर्डर के बाद, ऑर्डर पेज से अपना डेटा डाउनलोड करें या डिलीट करने को कहें।",
    required: "ज़रूरी",
    optional: "वैकल्पिक",
    agree: "सहमत हूँ, आगे बढ़ें",
  },
  hinglish: {
    title: "Documents upload karne se pehle",
    intro: "Telecom rules ke hisaab se, aapka business connection kholne ke liye Accel Business ko kuch documents chahiye. Chunein ki hum inka use kis liye kar sakte hain.",
    purposes: {
      kyc: { label: "Business verify karna aur connection kholna", detail: "Hum aapka GSTIN aur Udyam government registry se check karte hain aur customer application form bharte hain." },
      installation: { label: "Installation schedule karna", detail: "Aapka naam, phone aur address sirf aapke technician ke saath share hoga." },
      offers: { label: "Mujhe offers bhejein", detail: "Kabhi-kabhi WhatsApp ya SMS offers. Kabhi bhi band karein." },
    },
    collect: ["GST certificate", "Udyam certificate (optional; hum khud nikaal sakte hain)", "Authorised signatory ki ID", "Site ka bijli bill"],
    notCollect: "Hum bill amount, units ya poora ID number nahi rakhte.",
    retention: [
      "Document photos: check ke 24 ghante mein delete (reject hone par turant).",
      "Verified details (GSTIN, business naam, check results): telecom licence rules ke hisaab se jitna zaroori ho.",
      "Agar aap aage nahi badhte: 90 din mein sab delete.",
    ],
    rights: "Aap isi page par kabhi bhi consent wapas le sakte hain. Order ke baad, order page se apna data download karein ya delete karne ko kahein.",
    required: "Zaroori",
    optional: "Optional",
    agree: "Sahmat hoon, aage badhein",
  },
  ...fromPacks("consent"),
};
