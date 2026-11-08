import type { Lang } from "@/domain/advisor/state";

/** Short chat lines for the WhatsApp channel (everything else reuses the advisor's own copy). */
export interface WaCopy {
  pickOne: string;
  pickMany: string;
  bundle: (total: string) => string;
  setup: (amount: string, months: number) => string;
  why: string;
  finish: string;
  help: string;
  statusNone: string;
  statusHead: string;
  stopped: string;
  voiceFailed: string;
  orderPlaced: (id: string) => string;
  update: (id: string, step: string) => string;
  delayed: (id: string, step: string, reason: string, date: string) => string;
  track: string;
  agentHint: string;
  agentQueued: (city: string) => string;
  agentTaken: (who: string) => string;
}

export const WA: Record<Lang, WaCopy> = {
  en: {
    pickOne: "Reply with a number.", pickMany: "Reply with numbers, e.g. 1,3 (or type your answer).",
    bundle: (t) => `*Your bundle: ${t}/month*`, setup: (a, m) => `Setup ${a} · ${m}-month contract`, why: "Why it fits:",
    finish: "Finish in 5 minutes on your phone (documents + e-sign):", help: "Reply STATUS for your orders, RESTART to start over, STOP to delete your chat data.",
    statusNone: "No orders yet. Finish your documents with the link above to place one.", statusHead: "Your orders:",
    stopped: "Done. We deleted your chat data and won't message you again. Send HI anytime to start fresh.",
    voiceFailed: "Sorry, I couldn't hear that voice note. Please type or try again.",
    orderPlaced: (id) => `✅ Order ${id} placed. We'll message you here at every step.`, update: (id, s) => `📦 Order ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ Order ${id}: ${s} is delayed (${r}). New date: ${d}. Sorry, no need to call.`, track: "Track:",
    agentHint: "0 = talk to a person", agentQueued: (c) => `Done. A local Accel partner${c ? ` (${c})` : ""} will contact you here soon. You can keep chatting meanwhile.`, agentTaken: (w) => `👋 ${w} has taken your request and will contact you shortly.`,
  },
  hi: {
    pickOne: "एक नंबर लिखकर जवाब दें।", pickMany: "नंबर लिखें, जैसे 1,3 (या अपना जवाब लिखें)।",
    bundle: (t) => `*आपका बंडल: ${t}/महीना*`, setup: (a, m) => `सेटअप ${a} · ${m} महीने का कॉन्ट्रैक्ट`, why: "यह क्यों सही है:",
    finish: "5 मिनट में फ़ोन पर पूरा करें (डॉक्यूमेंट + ई-साइन):", help: "ऑर्डर देखने के लिए STATUS, फिर से शुरू करने के लिए RESTART, चैट डेटा मिटाने के लिए STOP लिखें।",
    statusNone: "अभी कोई ऑर्डर नहीं। ऊपर के लिंक से डॉक्यूमेंट पूरे करके ऑर्डर करें।", statusHead: "आपके ऑर्डर:",
    stopped: "हो गया। आपका चैट डेटा मिटा दिया गया, अब हम मैसेज नहीं करेंगे। नई शुरुआत के लिए कभी भी HI भेजें।",
    voiceFailed: "माफ़ कीजिए, वॉइस नोट सुनाई नहीं दिया। कृपया लिखें या फिर से भेजें।",
    orderPlaced: (id) => `✅ ऑर्डर ${id} हो गया। हर कदम पर हम यहीं मैसेज करेंगे।`, update: (id, s) => `📦 ऑर्डर ${id}: ${s}।`,
    delayed: (id, s, r, d) => `⚠️ ऑर्डर ${id}: ${s} में देरी (${r})। नई तारीख: ${d}। माफ़ी, कॉल की ज़रूरत नहीं।`, track: "ट्रैक करें:",
    agentHint: "0 = किसी व्यक्ति से बात करें", agentQueued: (c) => `हो गया। Accel के लोकल पार्टनर${c ? ` (${c})` : ""} जल्द ही आपसे संपर्क करेंगे। तब तक आप चैट जारी रख सकते हैं।`, agentTaken: (w) => `👋 ${w} ने आपका अनुरोध लिया है और जल्द संपर्क करेंगे।`,
  },
  hinglish: {
    pickOne: "Ek number likhkar jawab dein.", pickMany: "Number likhein, jaise 1,3 (ya apna jawab likhein).",
    bundle: (t) => `*Aapka bundle: ${t}/month*`, setup: (a, m) => `Setup ${a} · ${m} mahine ka contract`, why: "Yeh kyun sahi hai:",
    finish: "5 minute mein phone par poora karein (documents + e-sign):", help: "Orders ke liye STATUS, dobara shuru ke liye RESTART, chat data mitane ke liye STOP likhein.",
    statusNone: "Abhi koi order nahi. Upar ke link se documents poore karke order karein.", statusHead: "Aapke orders:",
    stopped: "Ho gaya. Aapka chat data mita diya, ab hum message nahi karenge. Nayi shuruaat ke liye kabhi bhi HI bhejein.",
    voiceFailed: "Maaf kijiye, voice note sunai nahi diya. Please likhein ya phir bhejein.",
    orderPlaced: (id) => `✅ Order ${id} ho gaya. Har step par hum yahin message karenge.`, update: (id, s) => `📦 Order ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ Order ${id}: ${s} mein delay (${r}). Nayi date: ${d}. Maafi, call ki zaroorat nahi.`, track: "Track karein:",
    agentHint: "0 = kisi insaan se baat karein", agentQueued: (c) => `Ho gaya. Accel ke local partner${c ? ` (${c})` : ""} jaldi aapse contact karenge. Tab tak chat jaari rakh sakte hain.`, agentTaken: (w) => `👋 ${w} ne aapki request li hai aur jaldi contact karenge.`,
  },
  mr: {
    pickOne: "एक क्रमांक लिहून उत्तर द्या.", pickMany: "क्रमांक लिहा, उदा. 1,3 (किंवा तुमचे उत्तर लिहा).",
    bundle: (t) => `*तुमचे बंडल: ${t}/महिना*`, setup: (a, m) => `सेटअप ${a} · ${m} महिन्यांचा करार`, why: "हे का योग्य आहे:",
    finish: "5 मिनिटांत फोनवर पूर्ण करा (कागदपत्रे + ई-सही):", help: "ऑर्डरसाठी STATUS, पुन्हा सुरू करण्यासाठी RESTART, चॅट डेटा हटवण्यासाठी STOP लिहा.",
    statusNone: "अजून ऑर्डर नाही. वरच्या लिंकने कागदपत्रे पूर्ण करून ऑर्डर करा.", statusHead: "तुमच्या ऑर्डर:",
    stopped: "झाले. तुमचा चॅट डेटा हटवला, आता आम्ही मेसेज करणार नाही. नव्याने सुरू करण्यासाठी कधीही HI पाठवा.",
    voiceFailed: "माफ करा, व्हॉइस नोट ऐकू आली नाही. कृपया लिहा किंवा पुन्हा पाठवा.",
    orderPlaced: (id) => `✅ ऑर्डर ${id} झाली. प्रत्येक टप्प्यावर आम्ही इथेच कळवू.`, update: (id, s) => `📦 ऑर्डर ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ ऑर्डर ${id}: ${s} ला उशीर (${r}). नवी तारीख: ${d}. क्षमस्व, फोन करायची गरज नाही.`, track: "ट्रॅक करा:",
    agentHint: "0 = व्यक्तीशी बोला", agentQueued: (c) => `झाले. Accel चे स्थानिक पार्टनर${c ? ` (${c})` : ""} लवकरच तुमच्याशी संपर्क करतील. तोपर्यंत चॅट सुरू ठेवू शकता.`, agentTaken: (w) => `👋 ${w} यांनी तुमची विनंती घेतली आहे आणि लवकरच संपर्क करतील.`,
  },
  gu: {
    pickOne: "એક નંબર લખીને જવાબ આપો.", pickMany: "નંબર લખો, જેમ કે 1,3 (અથવા તમારો જવાબ લખો).",
    bundle: (t) => `*તમારું બંડલ: ${t}/મહિનો*`, setup: (a, m) => `સેટઅપ ${a} · ${m} મહિનાનો કરાર`, why: "આ કેમ યોગ્ય છે:",
    finish: "5 મિનિટમાં ફોન પર પૂરું કરો (દસ્તાવેજો + ઇ-સહી):", help: "ઓર્ડર માટે STATUS, ફરી શરૂ કરવા RESTART, ચેટ ડેટા કાઢવા STOP લખો.",
    statusNone: "હજી કોઈ ઓર્ડર નથી. ઉપરની લિંકથી દસ્તાવેજો પૂરા કરી ઓર્ડર કરો.", statusHead: "તમારા ઓર્ડર:",
    stopped: "થઈ ગયું. તમારો ચેટ ડેટા કાઢી નાખ્યો, હવે અમે મેસેજ નહીં કરીએ. નવી શરૂઆત માટે ગમે ત્યારે HI મોકલો.",
    voiceFailed: "માફ કરશો, વૉઇસ નોટ સંભળાઈ નહીં. કૃપા કરી લખો અથવા ફરી મોકલો.",
    orderPlaced: (id) => `✅ ઓર્ડર ${id} થઈ ગયો. દરેક પગલે અમે અહીં જ જણાવીશું.`, update: (id, s) => `📦 ઓર્ડર ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ ઓર્ડર ${id}: ${s} માં વિલંબ (${r}). નવી તારીખ: ${d}. માફ કરશો, ફોન કરવાની જરૂર નથી.`, track: "ટ્રેક કરો:",
    agentHint: "0 = કોઈ વ્યક્તિ સાથે વાત કરો", agentQueued: (c) => `થઈ ગયું. Accel ના સ્થાનિક પાર્ટનર${c ? ` (${c})` : ""} જલ્દી તમારો સંપર્ક કરશે. ત્યાં સુધી ચેટ ચાલુ રાખી શકો.`, agentTaken: (w) => `👋 ${w} એ તમારી વિનંતી લીધી છે અને જલ્દી સંપર્ક કરશે.`,
  },
  kn: {
    pickOne: "ಒಂದು ಸಂಖ್ಯೆ ಬರೆದು ಉತ್ತರಿಸಿ.", pickMany: "ಸಂಖ್ಯೆಗಳನ್ನು ಬರೆಯಿರಿ, ಉದಾ. 1,3 (ಅಥವಾ ನಿಮ್ಮ ಉತ್ತರ ಬರೆಯಿರಿ).",
    bundle: (t) => `*ನಿಮ್ಮ ಬಂಡಲ್: ${t}/ತಿಂಗಳು*`, setup: (a, m) => `ಸೆಟಪ್ ${a} · ${m} ತಿಂಗಳ ಒಪ್ಪಂದ`, why: "ಇದು ಏಕೆ ಸರಿ:",
    finish: "5 ನಿಮಿಷದಲ್ಲಿ ಫೋನ್‌ನಲ್ಲಿ ಮುಗಿಸಿ (ದಾಖಲೆಗಳು + ಇ-ಸಹಿ):", help: "ಆರ್ಡರ್‌ಗಳಿಗೆ STATUS, ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಲು RESTART, ಚಾಟ್ ಡೇಟಾ ಅಳಿಸಲು STOP ಬರೆಯಿರಿ.",
    statusNone: "ಇನ್ನೂ ಆರ್ಡರ್ ಇಲ್ಲ. ಮೇಲಿನ ಲಿಂಕ್‌ನಿಂದ ದಾಖಲೆಗಳನ್ನು ಮುಗಿಸಿ ಆರ್ಡರ್ ಮಾಡಿ.", statusHead: "ನಿಮ್ಮ ಆರ್ಡರ್‌ಗಳು:",
    stopped: "ಆಯಿತು. ನಿಮ್ಮ ಚಾಟ್ ಡೇಟಾ ಅಳಿಸಲಾಗಿದೆ, ಇನ್ನು ಮೆಸೇಜ್ ಮಾಡುವುದಿಲ್ಲ. ಹೊಸದಾಗಿ ಪ್ರಾರಂಭಿಸಲು ಯಾವಾಗ ಬೇಕಾದರೂ HI ಕಳುಹಿಸಿ.",
    voiceFailed: "ಕ್ಷಮಿಸಿ, ವಾಯ್ಸ್ ನೋಟ್ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಬರೆಯಿರಿ ಅಥವಾ ಮತ್ತೆ ಕಳುಹಿಸಿ.",
    orderPlaced: (id) => `✅ ಆರ್ಡರ್ ${id} ಆಗಿದೆ. ಪ್ರತಿ ಹಂತದಲ್ಲೂ ಇಲ್ಲೇ ತಿಳಿಸುತ್ತೇವೆ.`, update: (id, s) => `📦 ಆರ್ಡರ್ ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ ಆರ್ಡರ್ ${id}: ${s} ವಿಳಂಬ (${r}). ಹೊಸ ದಿನಾಂಕ: ${d}. ಕ್ಷಮಿಸಿ, ಕರೆ ಮಾಡುವ ಅಗತ್ಯವಿಲ್ಲ.`, track: "ಟ್ರ್ಯಾಕ್ ಮಾಡಿ:",
    agentHint: "0 = ವ್ಯಕ್ತಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ", agentQueued: (c) => `ಆಯಿತು. Accel ನ ಸ್ಥಳೀಯ ಪಾಲುದಾರರು${c ? ` (${c})` : ""} ಶೀಘ್ರದಲ್ಲೇ ಸಂಪರ್ಕಿಸುತ್ತಾರೆ. ಅಲ್ಲಿಯವರೆಗೆ ಚಾಟ್ ಮುಂದುವರಿಸಬಹುದು.`, agentTaken: (w) => `👋 ${w} ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ತೆಗೆದುಕೊಂಡಿದ್ದಾರೆ, ಶೀಘ್ರದಲ್ಲೇ ಸಂಪರ್ಕಿಸುತ್ತಾರೆ.`,
  },
  te: {
    pickOne: "ఒక సంఖ్య రాసి సమాధానం ఇవ్వండి.", pickMany: "సంఖ్యలు రాయండి, ఉదా. 1,3 (లేదా మీ సమాధానం రాయండి).",
    bundle: (t) => `*మీ బండిల్: ${t}/నెల*`, setup: (a, m) => `సెటప్ ${a} · ${m} నెలల ఒప్పందం`, why: "ఇది ఎందుకు సరిపోతుంది:",
    finish: "5 నిమిషాల్లో ఫోన్‌లో పూర్తి చేయండి (పత్రాలు + ఇ-సంతకం):", help: "ఆర్డర్ల కోసం STATUS, మళ్లీ ప్రారంభించడానికి RESTART, చాట్ డేటా తొలగించడానికి STOP రాయండి.",
    statusNone: "ఇంకా ఆర్డర్ లేదు. పై లింక్‌తో పత్రాలు పూర్తి చేసి ఆర్డర్ చేయండి.", statusHead: "మీ ఆర్డర్లు:",
    stopped: "అయింది. మీ చాట్ డేటా తొలగించాం, ఇక మెసేజ్ చేయం. కొత్తగా ప్రారంభించడానికి ఎప్పుడైనా HI పంపండి.",
    voiceFailed: "క్షమించండి, వాయిస్ నోట్ వినిపించలేదు. దయచేసి రాయండి లేదా మళ్లీ పంపండి.",
    orderPlaced: (id) => `✅ ఆర్డర్ ${id} అయింది. ప్రతి దశలో ఇక్కడే తెలియజేస్తాం.`, update: (id, s) => `📦 ఆర్డర్ ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ ఆర్డర్ ${id}: ${s} ఆలస్యం (${r}). కొత్త తేదీ: ${d}. క్షమించండి, కాల్ చేయాల్సిన అవసరం లేదు.`, track: "ట్రాక్ చేయండి:",
    agentHint: "0 = వ్యక్తితో మాట్లాడండి", agentQueued: (c) => `అయింది. Accel స్థానిక భాగస్వామి${c ? ` (${c})` : ""} త్వరలో మిమ్మల్ని సంప్రదిస్తారు. అప్పటివరకు చాట్ కొనసాగించవచ్చు.`, agentTaken: (w) => `👋 ${w} మీ అభ్యర్థన తీసుకున్నారు, త్వరలో సంప్రదిస్తారు.`,
  },
  ta: {
    pickOne: "ஒரு எண்ணை எழுதிப் பதில் அளிக்கவும்.", pickMany: "எண்களை எழுதுங்கள், எ.கா. 1,3 (அல்லது உங்கள் பதிலை எழுதுங்கள்).",
    bundle: (t) => `*உங்கள் தொகுப்பு: ${t}/மாதம்*`, setup: (a, m) => `அமைப்பு ${a} · ${m} மாத ஒப்பந்தம்`, why: "இது ஏன் பொருந்துகிறது:",
    finish: "5 நிமிடத்தில் போனிலேயே முடியுங்கள் (ஆவணங்கள் + மின்-கையொப்பம்):", help: "ஆர்டர்களுக்கு STATUS, மீண்டும் தொடங்க RESTART, அரட்டைத் தரவை நீக்க STOP என எழுதுங்கள்.",
    statusNone: "இன்னும் ஆர்டர் இல்லை. மேலே உள்ள இணைப்பில் ஆவணங்களை முடித்து ஆர்டர் செய்யுங்கள்.", statusHead: "உங்கள் ஆர்டர்கள்:",
    stopped: "முடிந்தது. உங்கள் அரட்டைத் தரவு நீக்கப்பட்டது, இனி செய்தி அனுப்ப மாட்டோம். புதிதாகத் தொடங்க எப்போது வேண்டுமானாலும் HI அனுப்புங்கள்.",
    voiceFailed: "மன்னிக்கவும், குரல் செய்தி கேட்கவில்லை. தயவுசெய்து எழுதுங்கள் அல்லது மீண்டும் அனுப்புங்கள்.",
    orderPlaced: (id) => `✅ ஆர்டர் ${id} பதிவானது. ஒவ்வொரு படியிலும் இங்கேயே தெரிவிப்போம்.`, update: (id, s) => `📦 ஆர்டர் ${id}: ${s}.`,
    delayed: (id, s, r, d) => `⚠️ ஆர்டர் ${id}: ${s} தாமதம் (${r}). புதிய தேதி: ${d}. மன்னிக்கவும், அழைக்கத் தேவையில்லை.`, track: "கண்காணிக்க:",
    agentHint: "0 = ஒருவருடன் பேசுங்கள்", agentQueued: (c) => `முடிந்தது. Accel உள்ளூர் கூட்டாளர்${c ? ` (${c})` : ""} விரைவில் உங்களைத் தொடர்புகொள்வார். அதுவரை அரட்டையைத் தொடரலாம்.`, agentTaken: (w) => `👋 ${w} உங்கள் கோரிக்கையை ஏற்றுக்கொண்டார், விரைவில் தொடர்புகொள்வார்.`,
  },
  bn: {
    pickOne: "একটা নম্বর লিখে উত্তর দিন।", pickMany: "নম্বর লিখুন, যেমন 1,3 (বা আপনার উত্তর লিখুন)।",
    bundle: (t) => `*আপনার বান্ডেল: ${t}/মাস*`, setup: (a, m) => `সেটআপ ${a} · ${m} মাসের চুক্তি`, why: "এটা কেন মানানসই:",
    finish: "5 মিনিটে ফোনেই শেষ করুন (কাগজপত্র + ই-সই):", help: "অর্ডার দেখতে STATUS, আবার শুরু করতে RESTART, চ্যাট ডেটা মুছতে STOP লিখুন।",
    statusNone: "এখনও কোনো অর্ডার নেই। ওপরের লিংকে কাগজপত্র শেষ করে অর্ডার করুন।", statusHead: "আপনার অর্ডার:",
    stopped: "হয়ে গেছে। আপনার চ্যাট ডেটা মুছে ফেলা হয়েছে, আর মেসেজ করব না। নতুন করে শুরু করতে যেকোনো সময় HI পাঠান।",
    voiceFailed: "দুঃখিত, ভয়েস নোট শোনা যায়নি। দয়া করে লিখুন বা আবার পাঠান।",
    orderPlaced: (id) => `✅ অর্ডার ${id} হয়েছে। প্রতিটি ধাপে এখানেই জানাব।`, update: (id, s) => `📦 অর্ডার ${id}: ${s}।`,
    delayed: (id, s, r, d) => `⚠️ অর্ডার ${id}: ${s}-এ দেরি (${r})। নতুন তারিখ: ${d}। দুঃখিত, ফোন করার দরকার নেই।`, track: "ট্র্যাক করুন:",
    agentHint: "0 = একজন মানুষের সঙ্গে কথা বলুন", agentQueued: (c) => `হয়ে গেছে। Accel-এর স্থানীয় পার্টনার${c ? ` (${c})` : ""} শিগগিরই যোগাযোগ করবেন। ততক্ষণ চ্যাট চালিয়ে যেতে পারেন।`, agentTaken: (w) => `👋 ${w} আপনার অনুরোধ নিয়েছেন, শিগগিরই যোগাযোগ করবেন।`,
  },
};

/** First message: every language listed in its own script, so anyone can pick. */
export const LANG_MENU =
  "Namaste! 🙏 Accel Business — internet, phones and digital tools for your business.\n\nChoose your language / अपनी भाषा चुनें:\n1. English\n2. हिंदी\n3. Hinglish\n4. मराठी\n5. ગુજરાતી\n6. ಕನ್ನಡ\n7. తెలుగు\n8. தமிழ்\n9. বাংলা\n\nReply with a number. You can also send a voice note.";
export const MENU_LANGS: Lang[] = ["en", "hi", "hinglish", "mr", "gu", "kn", "te", "ta", "bn"];
