// Deterministic, server-driven WhatsApp ordering state machine.
// The only code path allowed to mutate `order_sessions.draft`.
//
// States: picking_product | qty | reviewing_cart | upsell_offer | name | address | confirm | editing_items | editing_qty | done | cancelled

// AI hint extraction intentionally removed — ordering is programmatic only.

import { sendMetaEvent } from "./meta-conversions.ts";

export interface OrderFlowDeps {
  supabase: any;
  tenantId: string;
  contactId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  loadCatalog: () => Promise<CatalogItem[]>;
  finalizeOrder: (draft: Draft) => Promise<{ success: boolean; displayId?: number; error?: string }>;
  lovableApiKey?: string | null;
  conversationHistory?: Array<{ role: string; content: string }>;
  aiHintsEnabled?: boolean;
  knowledgeEntries?: Array<{ title: string; content: string; isCatalog?: boolean }>;
  /** Text of the most recent campaign/broadcast message sent to this contact, if any. */
  latestCampaignText?: string | null;
  /** Settings → AI Auto-Replies → "AI upselling & recommendations". */
  upsellEnabled?: boolean;
}


export interface CatalogItem {
  id: string;
  title: string;
  price: number; // unit price
  description?: string;
}

interface HintItem {
  raw_text?: string;
  product_hint?: string;
  variant_hint?: string;
  qty_hint?: number;
  needs?: "product" | "variant" | "qty";
}

interface DraftItem {
  product_id: string;
  title: string;
  qty: number;
  unit_price: number;
  source: "hint" | "picker";
  variant_hint?: string;
}

interface Draft {
  items: DraftItem[];
  customer_name?: string;
  address?: string;
  contact_phone?: string;
  payment_method?: string;
  edit_mode?: "change_qty" | "remove";
  edit_item_index?: number;
  delivery_fee: number;
  total: number;
  lang?: "ar" | "en";
  match_attempts?: number;
  product_asks?: number;
  context_tried?: boolean;
  /** Upsell offer already made in this session (offered at most once). */
  upsell_offered?: boolean;
  /** Product id offered as an upsell, so we never re-offer it. */
  upsell_product_id?: string;

}



interface OrderSession {
  id: string;
  tenant_id: string;
  contact_id: string;
  state: string;
  draft: Draft;
  pending_hints: HintItem[];
}

const DELIVERY_FEE = 3;
const MAX_QTY = 20;
const PAYMENT_OPTIONS = [
  { id: "pay_cash", title: "Cash on delivery" },
  { id: "pay_card", title: "Card on delivery" },
];

// --- helpers ---

// Normalize Arabic-Indic & Persian digits to ASCII.
function normalizeDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

// --- language detection & i18n ---

const ARABIZI_MARKERS = /\b(badde|bade|baddi|shu|wen|emta|eimta|kam|adde|addeh|adeish|adeysh|ktir|khalas|iza|ana|enta|inta|inte|nihna|hinne|lazem|hayda|haydi|hala2|halla2|mnih|mabaref|ma3lesh|3am|3amel|3anjad|mafi|fi|fih|bala|min|inno|esmi|ismi|marhaba|ahlan|shukran|na3am|la2|mesh|mish|mou)\b/i;
const ENGLISH_STRONG = /\b(the|and|please|thanks|thank|hello|hi|want|need|order|delivery|address|name|yes|no|okay|ok|for|with|from|this|that|is|are|am|my|your)\b/i;

export function detectLang(text: string, prev?: "ar" | "en"): "ar" | "en" {
  const t = (text || "").trim();
  if (!t) return prev || "en";
  if (/[\u0600-\u06FF]/.test(t)) return "ar";
  const hasArabizi = ARABIZI_MARKERS.test(t);
  const hasEnglish = ENGLISH_STRONG.test(t);
  if (hasArabizi && !hasEnglish) return "ar";
  if (hasEnglish && !hasArabizi) return "en";
  return prev || "en";
}

function detectLangFromHistory(history: Array<{ role: string; content: string }> = []): "ar" | "en" {
  let ar = 0, en = 0;
  for (const m of history.slice(-8)) {
    if (m.role !== "user" || typeof m.content !== "string") continue;
    const l = detectLang(m.content);
    if (l === "ar") ar++; else en++;
  }
  return ar > en ? "ar" : "en";
}

type Lang = "ar" | "en";
const L = (lang: Lang | undefined, en: string, ar: string) => (lang === "ar" ? ar : en);

const T = {
  askProduct: (l?: Lang) => L(l, "Which product would you like? Please reply with the product name.", "أي منتج تحب تطلب؟ رجاءً أرسل اسم المنتج."),
  askProductAgain: (l?: Lang) => L(l, "Which product would you like? Reply with the product name.", "أي منتج تحب؟ رجاءً أرسل اسم المنتج."),
  askQty: (title: string, l?: Lang) => L(l, `How many ${title}? Please reply with a number.`, `كم واحد من ${title}؟ رجاءً أرسل رقم.`),
  askQtyFor: (title: string, l?: Lang) => L(l, `What quantity for ${title}? Please reply with a number.`, `كم الكمية لـ ${title}؟ رجاءً أرسل رقم.`),
  maxQty: (max: number, l?: Lang) => L(l, `For orders above ${max} units, please contact us directly.`, `للطلبات فوق ${max} قطعة، رجاءً تواصل معنا مباشرة.`),
  askAddItem: (l?: Lang) => L(l, "What else would you like to add? Please reply with the product name.", "شو كمان تحب تضيف؟ رجاءً أرسل اسم المنتج."),
  askAddProduct: (l?: Lang) => L(l, "What product would you like to add?", "أي منتج تحب تضيف؟"),
  askReplaceProduct: (removed: string, l?: Lang) => L(l, `${removed} removed. Which product would you like instead?`, `تم حذف ${removed}. أي منتج تحب بدله؟`),
  removed: (title: string, l?: Lang) => L(l, `${title} removed.`, `تم حذف ${title}.`),
  askName: (l?: Lang) => L(l, "What name should we put on the order? (first and last name only)", "شو الاسم اللي نحطه ع الطلب؟ (الاسم الأول والعائلي فقط)"),
  askNameShort: (l?: Lang) => L(l, "What name should we put on the order?", "شو الاسم اللي نحطه ع الطلب؟"),
  askAddress: (l?: Lang) => L(l, "What's your delivery address? (street, city, building/floor)", "شو عنوان التوصيل؟ (الشارع، المدينة، البناية/الطابق)"),
  askAddressShort: (l?: Lang) => L(l, "What's your delivery address?", "شو عنوان التوصيل؟"),
  askAddressNew: (l?: Lang) => L(l, "What's the new delivery address?", "شو العنوان الجديد للتوصيل؟"),
  askAddressFull: (l?: Lang) => L(l, "Please send your full delivery address (street, city, building).", "رجاءً أرسل عنوان التوصيل بالكامل (الشارع، المدينة، البناية)."),
  askPhone: (l?: Lang) => L(l, "What number should we call for delivery? Reply with the number, or tap the button to use this WhatsApp number.", "على أي رقم نتصل للتوصيل؟ أرسل الرقم، أو اضغط الزر لاستخدام رقم الواتساب هذا."),
  askPhoneNew: (l?: Lang) => L(l, "What's the new contact number for delivery?", "شو رقم التواصل الجديد للتوصيل؟"),
  phoneInvalid: (l?: Lang) => L(l, "That doesn't look like a valid phone number. Please send digits only (e.g. 76123456 or +96176123456).", "الرقم ما بيبين صحيح. رجاءً أرسل الأرقام فقط (مثال: 76123456 أو +96176123456)."),
  nameInvalid: (l?: Lang) => L(l, "That doesn't look like a name. Please send just your first and last name (e.g. 'Sara Khoury').", "هيدا ما بيبين اسم. رجاءً أرسل الاسم الأول والعائلي فقط (مثال: سارة خوري)."),
  nameShort: (l?: Lang) => L(l, "Please send your full name.", "رجاءً أرسل اسمك الكامل."),
  addressInvalid: (l?: Lang) => L(l, "That doesn't look like an address. Please send street, city, and building.", "هيدا ما بيبين عنوان. رجاءً أرسل الشارع والمدينة والبناية."),
  cartHeader: (l?: Lang) => L(l, "Cart so far:", "الطلب حتى الآن:"),
  cartSubtotal: (l?: Lang) => L(l, "Subtotal", "المجموع الفرعي"),
  cartAnythingElse: (l?: Lang) => L(l, "Anything else?", "شي تاني؟"),
  readyContinue: (l?: Lang) => L(l, "Ready to continue your order?", "جاهز تكمل طلبك؟"),
  readyConfirm: (l?: Lang) => L(l, "Ready to confirm your order?", "جاهز تأكد طلبك؟"),
  pleaseConfirm: (l?: Lang) => L(l, "Please confirm your order:", "رجاءً أكد طلبك:"),
  deliveryLabel: (l?: Lang) => L(l, "Delivery", "التوصيل"),
  totalLabel: (l?: Lang) => L(l, "Total", "المجموع"),
  nameLabel: (l?: Lang) => L(l, "Name", "الاسم"),
  addressLabel: (l?: Lang) => L(l, "Address", "العنوان"),
  phoneLabel: (l?: Lang) => L(l, "Phone", "الهاتف"),
  editWhat: (l?: Lang) => L(l, "What would you like to edit?", "شو بتحب تعدل؟"),
  editItems: (l?: Lang) => L(l, "Edit items:", "تعديل المنتجات:"),
  askItemNumber: (body: string, list: string, l?: Lang) => L(l, `${body}\n${list}\n\nReply with the item number or product name.`, `${body}\n${list}\n\nرجاءً أرسل رقم المنتج أو اسمه.`),
  whichRemove: (l?: Lang) => L(l, "Which item should we remove?", "أي منتج تحب نحذف؟"),
  whichChangeQty: (l?: Lang) => L(l, "Which item quantity should we change?", "لأي منتج تحب نعدل الكمية؟"),
  alreadyInProgress: (l?: Lang) => L(l, "You already have an order in progress. Type 'cancel' to start over.", "عندك طلب قيد التنفيذ. اكتب 'إلغاء' للبدء من جديد."),
  noProducts: (l?: Lang) => L(l, "Sorry, no products are available right now.", "آسفين، ما في منتجات متوفرة حالياً."),
  couldNotStart: (l?: Lang) => L(l, "Sorry, couldn't start the order. Try again in a moment.", "آسفين، ما قدرنا نبدأ الطلب. جرب بعد شوي."),
  cancelled: (l?: Lang) => L(l, "Order cancelled. Let us know if you'd like to start again.", "تم إلغاء الطلب. خبرنا إذا حبيت تعيد."),
  cancelledShort: (l?: Lang) => L(l, "Order cancelled.", "تم إلغاء الطلب."),
  orderPlaced: (id: string, total: number, fee: number, l?: Lang) => L(l, `Order #${id} confirmed! Total $${total.toFixed(2)} (incl. $${fee} delivery). We'll be in touch.`, `تم تأكيد الطلب #${id}! المجموع $${total.toFixed(2)} (شامل $${fee} توصيل). رح نتواصل معك.`),
  orderFailed: (err: string, l?: Lang) => L(l, `Sorry, couldn't place the order: ${err}.`, `آسفين، ما قدرنا نأكد الطلب: ${err}.`),
  btnDone: (l?: Lang) => L(l, "Done", "تم"),
  btnAdd: (l?: Lang) => L(l, "Add item", "إضافة"),
  btnCancel: (l?: Lang) => L(l, "Cancel", "إلغاء"),
  upsellOffer: (title: string, price: number, l?: Lang) =>
    L(l, `Want to add ${title} for $${price.toFixed(2)} too?`, `تحب تضيف ${title} بـ $${price.toFixed(2)} كمان؟`),
  btnYesAdd: (l?: Lang) => L(l, "Yes, add it", "نعم، ضيفه"),
  btnNoThanks: (l?: Lang) => L(l, "No thanks", "لا شكراً"),

  btnConfirm: (l?: Lang) => L(l, "Confirm", "تأكيد"),
  btnEdit: (l?: Lang) => L(l, "Edit", "تعديل"),
  btnItems: (l?: Lang) => L(l, "Items", "المنتجات"),
  btnAddress: (l?: Lang) => L(l, "Address", "العنوان"),
  btnName: (l?: Lang) => L(l, "Name", "الاسم"),
  btnPhone: (l?: Lang) => L(l, "Phone", "الهاتف"),
  btnUseWaNumber: (l?: Lang) => L(l, "Use this number", "استخدم هذا الرقم"),
  btnChangeQty: (l?: Lang) => L(l, "Change qty", "تعديل الكمية"),
  btnRemove: (l?: Lang) => L(l, "Remove item", "حذف منتج"),
};

// --- input validation ---

const NAME_STOPWORDS_EN = /\b(i|you|he|she|we|they|am|is|are|was|were|told|said|say|want|wanted|need|please|hello|hi|hey|thanks|thank|ok|okay|yes|no|the|a|an|my|your|his|her|for|to|order|deliver|delivery|address|name|call|send|give|get|buy|already|actually|listen|look|dude|bro|man|sir|ma\'am)\b/i;
const NAME_STOPWORDS_AR = /\b(ana|enta|inta|inte|nihna|hinne|badde|bade|baddi|lazem|shu|wen|emta|marhaba|ahlan|shukran|na3am|la2|esmi|ismi|el|la|min|inno|2eltellak|2eltelek|2ellak|hala2|halla2|khalas|mesh|mish|mou|3am|hayda|haydi|kif|kifak)\b/i;
const NAME_STOPWORDS_ARABIC = /(انا|أنا|انت|أنت|بدي|بدّي|شو|وين|امتى|إمتى|مرحبا|أهلا|شكرا|شكراً|نعم|لا|اسمي|إسمي|قلتلك|قلتلك|هلق|هلأ|خلص|هيدا|هيدي|كيف|كيفك)/;

export function isPlausibleName(input: string): boolean {
  const t = (input || "").trim();
  if (t.length < 2 || t.length > 60) return false;
  if (/https?:\/\/|@|\d/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 4) return false;
  if (NAME_STOPWORDS_EN.test(t)) return false;
  if (NAME_STOPWORDS_AR.test(t)) return false;
  if (NAME_STOPWORDS_ARABIC.test(t)) return false;
  return true;
}

export function isPlausibleAddress(input: string): boolean {
  const t = (input || "").trim();
  if (t.length < 5 || t.length > 240) return false;
  if (/^(i told you|ana 2eltellak|قلتلك)/i.test(t)) return false;
  // must have at least one letter
  if (!/[a-zA-Z\u0600-\u06FF]/.test(t)) return false;
  return true;
}

export function normalizePhone(input: string): string | null {
  if (!input) return null;
  const digits = normalizeDigits(input).replace(/[^\d+]/g, "");
  const bare = digits.replace(/^\+/, "");
  if (bare.length < 6 || bare.length > 15) return null;
  return digits.startsWith("+") ? digits : bare;
}

export function isPlausiblePhone(input: string): boolean {
  return normalizePhone(input) !== null;
}


function looksLikeQuestion(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/[?؟]/.test(t)) return true;
  if (/^(what|when|where|why|who|how|is|are|do|does|can|could|would|will|kam|ade|adde|addeh|adeish|adeysh|qaddeh|qaddesh|fi|fih|shu|wen|emta|eimta|كيف|متى|أين|اين|لماذا|ما|هل|كم|شو|ليش|وين|امتى|في)\b/i.test(t)) return true;
  return /\b(price|cost|se3r|warranty|waranty|guarantee|delivery|stock|available|brightness|سعر|ضمان|توصيل|متوفر)\b/i.test(t);
}

function looksLikeOrderSelection(s: string): boolean {
  return /\b(i want|want|order|buy|take|add|give me|can i get|can i order|badde|bade|bدي|baddi|بدي|بدّي|اطلب|اشتري)\b/i.test(s);
}

/**
 * Return / exchange / wrong-item complaints. A product named in such a message is
 * the item the customer wants to SEND BACK, never something to add to the cart, so
 * the flow must not treat it as a product selection or a quantity answer.
 */
function looksLikeReturnIntent(s: string): boolean {
  return /(return|refund|exchange|replace|swap|send.{0,10}back|wrong (item|light|product|one)|sent me the wrong|damag|broken|defect|badel|bdel|bteble|ارجاع|إرجاع|استرجاع|استبدال|ابدل|أبدل|بدل|تبديل|غلط|خطأ|مكسور|عاطل)/i.test(s);
}

/**
 * Image transcripts injected into the flow ("[Image received — contents: …]") are
 * context, never a typed selection: delivery notes and receipts often contain a
 * product name the customer is complaining about, not ordering.
 */
function isImageTranscript(s: string): boolean {
  return /^\s*\[image received/i.test(s);
}

/**
 * A quantity answer must be a number, not a phone number or a sentence that merely
 * contains a digit ("8 lights arrived by mistake", "03809002").
 */
function parseQtyAnswer(text: string): number | null {
  const normalized = normalizeDigits(text || "").trim();
  if (!normalized) return null;
  if (isImageTranscript(normalized) || looksLikeReturnIntent(normalized)) return null;
  // Reject phone-like digit runs.
  if (/\d{5,}/.test(normalized)) return null;
  // The message must be essentially just the number (allow "2 pcs", "x2", "قطعتين").
  const stripped = normalized
    .replace(/\d+/g, " ")
    .replace(/\b(pcs?|pieces?|units?|x|qty|please|pls|only|واحد|واحدة|قطعة|قطعه|قطع|حبة|حبه|بدي)\b/gi, " ")
    .replace(/[^\p{L}]+/gu, "")
    .trim();
  if (stripped.length > 0) return null;
  const m = normalized.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}


function redactNonCatalogPrices(content: string): string {
  return content
    .replace(/\$\s*\d+(?:\.\d{1,2})?/g, "[old price removed]")
    .replace(/\b(?:USD|US\$)\s*\d+(?:\.\d{1,2})?/gi, "[old price removed]");
}

const PRICE_PLACEHOLDER = "\\[(?:old|previous) price removed\\]";

/**
 * The model sometimes copies our internal redaction placeholder into its reply.
 * Replace it with the live catalog price when the product is identifiable,
 * otherwise drop that clause so the customer never sees a placeholder.
 */
function sanitizeOutgoingPrices(reply: string, catalog: CatalogItem[] = []): string {
  if (!reply || !new RegExp(PRICE_PLACEHOLDER, "i").test(reply)) return reply;
  const lower = reply.toLowerCase();
  const hit = catalog.find((c) => c.title && lower.includes(c.title.toLowerCase()));
  if (hit) {
    return reply.replace(new RegExp(PRICE_PLACEHOLDER, "gi"), `$${hit.price.toFixed(2)}`).trim();
  }
  const kept = reply
    .split(/(?<=[.!?\u061F])\s+|\n+/)
    .filter((part) => part.trim() && !new RegExp(PRICE_PLACEHOLDER, "i").test(part))
    .join(" ")
    .trim();
  return kept || "Let me check the current price with the team and get back to you.";
}

function buildOrderContext(session?: OrderSession, catalog: CatalogItem[] = [], knowledgeEntries?: Array<{ title: string; content: string; isCatalog?: boolean }>, question = ""): string {
  const cart = (session?.draft.items || [])
    .map((i, idx) => `${idx + 1}. ${i.title}: qty ${i.qty}, unit $${i.unit_price.toFixed(2)}, line $${(i.qty * i.unit_price).toFixed(2)}`)
    .join("\n") || "No cart items yet.";
  const relevanceText = `${question} ${(session?.draft.items || []).map((item) => item.title).join(" ")}`.toLowerCase();
  const relevanceTerms = relevanceText.split(/[^a-z0-9\u0600-\u06ff]+/).filter((term) => term.length >= 3);
  const rankedCatalog = [...catalog].sort((a, b) => {
    const score = (title: string) => relevanceTerms.filter((term) => title.toLowerCase().includes(term)).length;
    return score(b.title) - score(a.title);
  });
  const catalogLines = rankedCatalog
    .slice(0, 20)
    .map((c) => {
      const description = c.description ? ` — ${c.description.slice(0, 500).replace(/\s+/g, " ")}` : "";
      return `- ${c.title}: $${c.price.toFixed(2)}${description}`;
    })
    .join("\n") || "No catalog loaded.";

  const operationalFacts = [
    "Payment: Cash on Delivery (no online payment required).",
    `Delivery: Yes, we deliver. Fee: $${DELIVERY_FEE.toFixed(2)}.`,
    "Currency: USD.",
  ].join("\n");


  const kbSection = (knowledgeEntries || [])
    .slice(0, 8)
    .map((e) => `### ${e.title} ${e.isCatalog ? "[LIVE CATALOG]" : "[GENERAL NOTES — NOT A PRICE SOURCE]"}\n${(e.isCatalog ? e.content : redactNonCatalogPrices(e.content)).slice(0, 600)}`)
    .join("\n\n");

  return [
    `Current order step: ${session?.state || "unknown"}`,
    `Cart:\n${cart}`,
    `Delivery fee: $${(session?.draft.delivery_fee ?? DELIVERY_FEE).toFixed(2)}`,
    `Total so far: $${(session?.draft.total ?? 0).toFixed(2)}`,
    `Catalog facts:\n${catalogLines}`,
    `Operational facts:\n${operationalFacts}`,
    ...(kbSection ? [`Knowledge base:\n${kbSection}`] : []),
  ].join("\n\n");
}


export function extractNameFromPhrase(input: string): string | null {
  const t = (input || "").trim();
  if (!t) return null;
  const patterns = [
    /^(?:my\s+name\s+is|i\s*am|i['`’]?m|this\s+is|call\s+me|name[:\s-]+)\s*(.+)$/i,
    /^(?:ana|ismi|esmi|isme|esme)\s+(.+)$/i,
    /^(?:اسمي|إسمي|أنا|انا)\s+(.+)$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m && m[1]) {
      const candidate = m[1].replace(/[.!؟?،,]+$/g, "").trim();
      if (isPlausibleName(candidate)) return candidate;
    }
  }
  return null;
}

// Knowledge entries can be huge (a whole scraped site), and buildOrderContext only
// keeps the first 600 chars of each — so facts like shipping times were being cut
// out and the bot answered "let me check with the team". Pull the passages that
// actually match the customer's question out of the FULL content.
const TOPIC_SYNONYMS: Array<[RegExp, string[]]> = [
  [/(deliver|shipping|ship|arrive|emta|eimta|متى|امتى|يوصل|توصيل|when)/i,
    ["deliver", "delivery", "shipping", "ship", "arrive", "arrival", "business day", "processing", "توصيل", "يوصل"]],
  [/(warrant|guarantee|damag|broken|return|refund|exchange|ضمان|ارجاع|استرجاع)/i,
    ["warranty", "guarantee", "return", "refund", "exchange", "damaged", "ضمان"]],
  [/(pay|cash|card|whish|omt|دفع|كاش)/i, ["payment", "pay", "cash on delivery", "cod", "card", "whish", "omt"]],
  [/(charge|battery|usb|batter|شحن|بطارية)/i, ["battery", "charge", "charging", "usb", "hours"]],
  [/(size|color|colour|variant|قياس|لون)/i, ["size", "color", "colour", "variant", "dimension"]],
];

function relevantKnowledge(question: string, entries?: Array<{ title: string; content: string; isCatalog?: boolean }>): string {
  if (!entries?.length || !question) return "";
  const q = question.toLowerCase();
  const terms = new Set<string>();
  for (const [re, syns] of TOPIC_SYNONYMS) {
    if (re.test(q)) syns.forEach((s) => terms.add(s.toLowerCase()));
  }
  for (const w of q.split(/[^a-z\u0600-\u06FF]+/)) if (w.length >= 4) terms.add(w);
  if (terms.size === 0) return "";

  const snippets: string[] = [];
  for (const entry of entries) {
    const content = entry.isCatalog ? (entry.content || "") : redactNonCatalogPrices(entry.content || "");
    const lower = content.toLowerCase();
    for (const term of terms) {
      const idx = lower.indexOf(term);
      if (idx === -1) continue;
      const snippet = content.slice(Math.max(0, idx - 200), idx + 400).replace(/\s+/g, " ").trim();
      if (snippet && !snippets.some((s) => s.includes(snippet.slice(0, 60)))) {
        snippets.push(`### ${entry.title} ${entry.isCatalog ? "[LIVE CATALOG]" : "[GENERAL NOTES — NOT A PRICE SOURCE]"}\n…${snippet}…`);
      }
      if (snippets.length >= 6) break;
    }
    if (snippets.length >= 6) break;
  }
  return snippets.join("\n\n");
}

async function maybeAnswerQuestion(deps: OrderFlowDeps, text: string, session?: OrderSession, catalog: CatalogItem[] = []): Promise<boolean> {
  if (!deps.lovableApiKey || !text || !looksLikeQuestion(text)) return false;

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are answering a side-question during a WhatsApp order flow. " +
          `Answer in ONE short sentence (≤20 words). Reply in ${session?.draft?.lang === "ar" ? "Arabic (or Arabizi if the customer used Arabizi)" : "English"} to match the customer's language. ` +
          "Use the operational facts and knowledge base as your source of truth — paraphrasing is fine. " +
          "Only if the knowledge base truly says nothing about the topic, reply with exactly: " +
          "'Let me check with the team and get back to you' (mirrored to their language). " +
          "NEVER say 'I cannot answer' or 'I'm sorry, I cannot answer that question'. " +
          "Do NOT modify, confirm, add, remove, or summarize the order. " +
          "PRICING IS FIXED: NEVER offer, agree to, negotiate, or grant any discount, price reduction, free delivery, waived fee, promo, or 'special price'. " +
          "NEVER change the item price, delivery fee, or total. Prices come ONLY from the catalog. " +
           "PRICE AUTHORITY: quote prices only from [LIVE CATALOG] or Catalog facts. Ignore all prices in GENERAL NOTES and prior assistant replies. If no live catalog price is present, say you will confirm with the team. NEVER output the text '[old price removed]' or '[previous price removed]'. " +
          "If the customer asks for a discount, haggles, complains the price is too high, or asks to waive delivery, politely decline in ONE sentence in their language (e.g. 'Sorry, prices are fixed and I can't apply discounts.'). Do NOT promise to check or ask a manager — just decline.",
      },
      { role: "system", content: buildOrderContext(session, catalog, deps.knowledgeEntries, text) },
      ...(() => {
        const rel = relevantKnowledge(text, deps.knowledgeEntries);
        return rel ? [{ role: "system", content: `Passages from our own docs that match this question (use these first):\n${rel}` }] : [];
      })(),

      ...(deps.conversationHistory || []).slice(-8).map((message) => message.role === "assistant"
        ? { ...message, content: redactNonCatalogPrices(String(message.content || "")) }
        : message),
      { role: "user", content: text },
    ];
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages }),
    });
    if (!res.ok) return false;
    const j = await res.json();
    const answer = j?.choices?.[0]?.message?.content?.trim();
    if (!answer) return false;
    const safeAnswer = sanitizeOutgoingPrices(answer, catalog);
    if (!safeAnswer) return false;
    await sendText(deps, safeAnswer);
    return true;
  } catch (e) {
    console.error("maybeAnswerQuestion failed:", e);
    return false;
  }
}

function recomputeTotals(draft: Draft): Draft {
  const subtotal = draft.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  draft.total = subtotal + (draft.items.length > 0 ? draft.delivery_fee : 0);
  return draft;
}

function clearEditState(draft: Draft): void {
  delete draft.edit_mode;
  delete draft.edit_item_index;
}

function nextMissingState(draft: Draft): "name" | "address" | "phone" | "confirm" {
  if (!draft.customer_name) return "name";
  if (!draft.address) return "address";
  if (!draft.contact_phone) return "phone";
  return "confirm";
}

// Products the customer mentioned inside a return/exchange/complaint message: never
// upsell an item they are trying to send back.
function complainedProductIds(deps: OrderFlowDeps, catalog: CatalogItem[]): Set<string> {
  const ids = new Set<string>();
  const texts = (deps.conversationHistory || [])
    .slice(-25)
    .filter((m) => m?.role === "user" && typeof m?.content === "string")
    .map((m) => String(m.content))
    .filter((t) => looksLikeReturnIntent(t) || isImageTranscript(t));
  for (const t of texts) {
    const hit = matchProduct(t, catalog);
    if (hit) ids.add(hit.id);
  }
  return ids;
}

// Pick one upsell candidate: a catalog item not already in the cart. Items that look
// discounted win, otherwise the cheapest remaining item (easiest add-on to say yes to).
function pickUpsellCandidate(draft: Draft, catalog: CatalogItem[], excludeIds: Set<string> = new Set()): CatalogItem | null {
  const inCart = new Set(draft.items.map((i) => i.product_id));
  const pool = catalog.filter((c) => c.price > 0 && !inCart.has(c.id) && !excludeIds.has(c.id) && c.id !== draft.upsell_product_id);
  if (!pool.length) return null;
  const onSale = pool.filter((c) => /(was|used to be|sale|كان|تنزيلات)/i.test(String(c.description || "")));
  const from = onSale.length ? onSale : pool;
  return [...from].sort((a, b) => a.price - b.price)[0] || null;
}


// Between "Done" on the cart and checkout details, offer exactly one add-on when the
// business enabled upselling. Returns true when the offer was sent.
async function maybeOfferUpsell(deps: OrderFlowDeps, session: OrderSession, catalog: CatalogItem[]): Promise<boolean> {
  if (!deps.upsellEnabled) return false;
  if (session.draft.upsell_offered) return false;
  if (!session.draft.items.length) return false;
  const candidate = pickUpsellCandidate(session.draft, catalog, complainedProductIds(deps, catalog));
  if (!candidate) return false;
  session.draft.upsell_offered = true;
  session.draft.upsell_product_id = candidate.id;
  session.state = "upsell_offer";
  await saveSession(deps.supabase, session);
  await sendButtons(deps, T.upsellOffer(candidate.title, candidate.price, session.draft.lang), [
    { id: "upsell_yes", title: T.btnYesAdd(session.draft.lang) },
    { id: "upsell_no", title: T.btnNoThanks(session.draft.lang) },
  ]);
  return true;
}

// Move past the cart into checkout, offering the single upsell first when enabled.
async function proceedFromCart(deps: OrderFlowDeps, session: OrderSession, catalog: CatalogItem[]): Promise<void> {
  if (await maybeOfferUpsell(deps, session, catalog)) return;
  session.state = nextMissingState(session.draft);
  await saveSession(deps.supabase, session);
  await promptForState(deps, session);
}


async function promptForState(deps: OrderFlowDeps, session: OrderSession): Promise<void> {
  const lang = session.draft.lang;
  switch (session.state) {
    case "name": await sendText(deps, T.askName(lang)); return;
    case "address": await sendText(deps, T.askAddress(lang)); return;
    case "phone": await sendPhonePrompt(deps, lang); return;
    case "confirm": await sendSummary(deps, session); return;
  }
}

async function sendPhonePrompt(deps: OrderFlowDeps, lang?: Lang): Promise<void> {
  await sendButtons(deps, T.askPhone(lang), [
    { id: "phone_use_wa", title: T.btnUseWaNumber(lang) },
    { id: "cart_cancel", title: T.btnCancel(lang) },
  ]);
}



// Strip qty/price/currency and common Arabic/English order-noise words so
// "Bunny projector 2 pcs 39$" → "bunny projector", "offer تاع قطعتين" → "offer".
function stripOrderNoise(input: string): string {
  let s = normalizeDigits(input).toLowerCase();
  // remove prices like 39$, $39, 39.99, 39 usd, 39 lbp
  s = s.replace(/\$\s*\d+(?:[.,]\d+)?/g, " ");
  s = s.replace(/\d+(?:[.,]\d+)?\s*(?:\$|usd|lbp|lira|ل\.ل|دولار)/gi, " ");
  // remove qty patterns: "2 pcs", "x2", "قطعتين", "قطعة"
  s = s.replace(/\b\d+\s*(?:pcs?|pieces?|units?|x|qty)\b/gi, " ");
  s = s.replace(/\bx\s*\d+\b/gi, " ");
  s = s.replace(/\d+/g, " ");
  s = s.replace(/(?:قطعتين|قطعه|قطعة|قطع|حبه|حبة|حبتين|واحده|واحدة|واحد|اتنين|اثنين|ثلاث|ثلاثة)/g, " ");
  // remove ordering verbs/prepositions
  s = s.replace(/\b(i|want|need|order|to|the|a|an|please|pls|thanks|thank|you|me|for|of|and|with|get|buy|take)\b/gi, " ");
  s = s.replace(/(?:بدي|بدنا|اطلب|رجاء|رجاءً|لو سمحت|من فضلك|شكرا|شكراً|تاع|من|هيدا|هيدي|ال)/g, " ");
  return s.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Normalized key used to collapse duplicate catalog rows. Large imported
 * catalogs (e.g. a website import re-run) contain the same product many times
 * with cosmetic title differences ("FG 39-45", "FG 39---45", "FG （39-45）").
 */
function catalogKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * All distinct catalog products whose title covers every meaningful word the
 * customer typed. Duplicated rows collapse to one entry, so "nike phantom luna"
 * in a 13k-row store yields the handful of real variants (FG / AG / TF / SG)
 * instead of being discarded as "ambiguous".
 */
export function matchProductCandidates(
  hint: string | undefined,
  catalog: CatalogItem[],
  limit = 10,
): CatalogItem[] {
  if (!hint) return [];
  const raw = hint.toLowerCase().trim();
  const searchStr = stripOrderNoise(raw) || raw;
  const tokens = new Set(searchStr.split(/\s+/).filter((t) => t.length >= 3));
  if (tokens.size === 0) return [];
  const seen = new Map<string, CatalogItem>();
  for (const c of catalog) {
    if (!titleExplainsHint(c.title, tokens)) continue;
    const key = catalogKey(c.title);
    const prev = seen.get(key);
    if (!prev || c.price < prev.price) seen.set(key, c);
    if (seen.size > limit + 5) break;
  }
  return [...seen.values()].slice(0, limit);
}

function matchProduct(hint: string | undefined, catalog: CatalogItem[]): CatalogItem | null {
  if (!hint) return null;
  const raw = hint.toLowerCase().trim();
  if (!raw) return null;
  // exact title match
  let best = catalog.find((c) => c.title.toLowerCase() === raw);
  if (best) return best;
  // Duplicated rows of one product must not read as ambiguity: if every title
  // that covers the customer's words is the same product, pick it.
  const candidates = matchProductCandidates(raw, catalog, 4);
  if (candidates.length === 1) return candidates[0];

  // Unique shortened title match. This intentionally resolves
  // "minecraft lantern" → "Minecraft Lantern Light", while a shared prefix
  // such as "minecraft" remains ambiguous between the lantern and torch.
  const rawTitleMatches = catalog.filter((c) => c.title.toLowerCase().includes(raw));
  if (rawTitleMatches.length === 1) return rawTitleMatches[0];
  const titlesInsideRaw = catalog.filter((c) => raw.includes(c.title.toLowerCase()));
  if (titlesInsideRaw.length === 1) return titlesInsideRaw[0];
  // strip noise then retry substring both ways
  const h = stripOrderNoise(raw);
  if (h && h !== raw) {
    const cleanTitleMatches = catalog.filter((c) => c.title.toLowerCase().includes(h));
    if (cleanTitleMatches.length === 1) return cleanTitleMatches[0];
    const titlesInsideClean = catalog.filter((c) => h.includes(c.title.toLowerCase()));
    if (titlesInsideClean.length === 1) return titlesInsideClean[0];
  }
  // token overlap on stripped hint
  const searchStr = h || raw;
  const hTokens = new Set(searchStr.split(/\s+/).filter((t) => t.length > 2));
  if (hTokens.size === 0) return null;
  let bestScore = 0;
  let bestItem: CatalogItem | null = null;
  let tiedAtBest = 0;
  for (const c of catalog) {
    const cTokens = c.title.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const overlap = cTokens.filter((t) => hTokens.has(t)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestItem = c;
      tiedAtBest = 1;
    } else if (overlap > 0 && overlap === bestScore) {
      tiedAtBest++;
    }
  }
  // 1-token match is enough when the hint itself is short (1–2 meaningful tokens).
  const minOverlap = hTokens.size <= 2 ? 1 : 2;
  if (bestScore < minOverlap || !bestItem) return null;
  // Two different products score the same → ambiguous, ask instead of guessing.
  if (tiedAtBest > 1) return null;
  // Every meaningful word the customer typed must be explained by the title.
  // "minecraft lantern" resolves to "Minecraft Lantern Light" above, but must
  // never fall through and resolve to "Minecraft Torch Light" — "lantern" is
  // unexplained by that separate product title.
  if (!titleExplainsHint(bestItem.title, hTokens)) return null;
  return bestItem;
}

// Every meaningful token from the customer's wording must appear in the title
// (prefix match tolerates plurals / light vs lights).
function titleExplainsHint(title: string, hintTokens: Set<string>): boolean {
  const tTokens = title.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  for (const ht of hintTokens) {
    if (ht.length < 4) continue; // ignore very short/filler tokens
    const ok = tTokens.some((tt) => tt.startsWith(ht) || ht.startsWith(tt));
    if (!ok) return false;
  }
  return true;
}


// A "demonstrative" message alone cannot identify a product: "this", "this one",
// "hada", "bade hayda", etc. We only allow the AI fallback when there is a real
// product signal somewhere in the conversation.
const DEMONSTRATIVE_ONLY_RE = /^\s*(this\s*(one|product|item)?|that\s*(one|product|item)?|this\s+is|hada|hadi|hady|hayda|hayde|hadik|hadaik|bade\s+(hada|hadi|hayda|hayde)|i\s+want\s+(this|that|one)|i\s+need\s+(this|that|one)|bade\s+hadik|i\s+need\s+it|i\s+want\s+it|bade| بدي |حابب|give\s+me\s+(this|that|one))\s*[.!؟?]*\s*$/i;

function isDemonstrativeOnly(text: string | null | undefined): boolean {
  return !!text && DEMONSTRATIVE_ONLY_RE.test(text.replace(/\[Shared post[^\]]*\]/gi, " ").replace(/\[Sent from an ad[^\]]*\]/gi, " ").trim());
}

/**
 * Guard against the AI inventing a product that was never mentioned.
 * A hint/product title is only trusted when at least one meaningful word of it
 * actually appears in customer-provided context. Assistant replies are excluded:
 * trusting them lets one bad bot guess validate the same guess on the next turn.
 */
function isGroundedInHistory(
  deps: OrderFlowDeps,
  candidate: string | null | undefined,
  productTitle?: string | null,
): boolean {
  const words = [candidate, productTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return false;
  const transcript = [
    ...(deps.conversationHistory || [])
      .slice(-25)
      .filter((m) => m?.role === "user")
      .map((m) => (typeof m?.content === "string" ? m.content : "")),
    // A campaign we sent is legitimate context: the customer is replying to it.
    deps.latestCampaignText || "",
  ]
    .join("\n")
    .toLowerCase();
  if (!transcript) return false;
  return words.some((w) => transcript.includes(w));
}

function hasProductSignal(turns: { role: string; text: string }[]): boolean {
  if (turns.length === 0) return false;
  const allText = turns.map((t) => t.text).join(" ");
  // Has a product-page link
  if (slugsFromText(allText).length > 0) return true;
  // Has an ad note injected by the webhook
  if (allText.match(/\[Sent from an ad[^\]]*\]/i)) return true;
  // Has a shared post caption we extracted
  if (allText.match(/\[Shared post[^\]]*\]/i)) return true;
  // Has a catalog-ish word from the customer's own text (not just "this")
  for (const { role, text } of turns) {
    if (role === "user" && !isDemonstrativeOnly(text) && text.length > 3) return true;
    if (role !== "user" && text.length > 3) return true;
  }
  return false;
}

// Hosts that carry social posts but no predictable product slug. We still
// fetch the caption elsewhere, but we must not treat the post shortcode as a
// product name (e.g. /p/DZ013kiAHQ_ → "DZ013kiAHQ_").
const SOCIAL_HOSTS = new Set([
  "instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am",
  "facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch",
  "tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com",
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "wa.me", "api.whatsapp.com", "status.whatsapp.com",
]);
const SOCIAL_SHORTCODE_PATHS = /^(p|reel|reels|share|post|posts|story|stories|watch|shorts|t|video|videos)$/i;

function isSocialPostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (SOCIAL_HOSTS.has(u.host)) return true;
    const segs = u.pathname.split("/").filter(Boolean);
    return segs.some((s) => SOCIAL_SHORTCODE_PATHS.test(s));
  } catch {
    return false;
  }
}

/** Turn a product URL into searchable words: /products/mini-dome-night-light → "mini dome night light" */
function slugsFromText(text: string): string[] {
  const out: string[] = [];
  const urlRe = /https?:\/\/[^\s>)\]]+/gi;
  for (const url of text.match(urlRe) || []) {
    try {
      const clean = url.replace(/[.,;!؟?)"']+$/, "");
      if (isSocialPostUrl(clean)) continue;
      const path = decodeURIComponent(new URL(clean).pathname);
      const segs = path.split("/").filter(Boolean);
      // Prefer the segment after /products/ or /product/, else the last segment.
      const idx = segs.findIndex((s) => /^products?$/i.test(s));
      const seg = idx >= 0 && segs[idx + 1] ? segs[idx + 1] : segs[segs.length - 1];
      if (!seg) continue;
      const words = seg.replace(/\.(html?|php)$/i, "").replace(/[-_+]+/g, " ").trim();
      if (words && !/^\d+$/.test(words) && words.length > 2) out.push(words);
    } catch {
      // ignore malformed URLs
    }
  }
  return out;
}

/**
 * Infer the product the customer has been talking about, in priority order:
 *  1. explicit `product: X` inside a click-to-WhatsApp ad note
 *  2. product-page links the customer clicked/shared (slug matching)
 *  3. a catalog title the bot itself already named (it was answering about that product)
 *  4. a catalog title the customer typed
 *  5. ad headline / ad body text
 *  6. AI fallback over the recent transcript
 * Newest messages win at every tier.
 */
async function inferProductFromContext(
  deps: OrderFlowDeps,
  catalog: CatalogItem[] = [],
): Promise<CatalogItem | null> {
  const history = (deps.conversationHistory || []).slice(-25);
  const turns = history
    .filter((m) => typeof m?.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, text: m.content as string }));
  if (turns.length === 0 || catalog.length === 0) return null;

  // A newly shared social post starts fresh product context. Ignore older product
  // names (especially prior bot replies) so they cannot override this reel.
  const latestSocialIndex = turns.map((turn) => turn.role === "user" && isSocialPostUrl((turn.text.match(/https?:\/\/[^\s>)\]]+/i) || [""])[0])).lastIndexOf(true);

  // A campaign/broadcast we just sent also resets product context: the customer is
  // replying about THAT product, not whatever they asked about weeks ago.
  const campaignText = (deps.latestCampaignText || "").trim().toLowerCase();
  const latestCampaignIndex = campaignText
    ? turns.map((turn) => turn.role !== "user" && turn.text.toLowerCase().includes(campaignText.slice(0, 60))).lastIndexOf(true)
    : -1;

  const resetIndex = Math.max(latestSocialIndex, latestCampaignIndex);
  const relevantTurns = resetIndex >= 0 ? turns.slice(resetIndex) : turns;
  const newestFirst = [...relevantTurns].reverse();
  // The bot-named tier is allowed when the reset came from a campaign (that campaign
  // message names the product), but never right after a shared social post.
  const allowBotNamed = latestSocialIndex < 0 || latestCampaignIndex > latestSocialIndex;

  const adNote = (t: string) => t.match(/\[Sent from an ad[^\]]*\]/i)?.[0] || null;

  // Every product whose full title is explicitly named in a piece of text.
  const explicitTitles = (text: string): CatalogItem[] => {
    const lower = text.toLowerCase();
    const seen = new Set<string>();
    const hits: CatalogItem[] = [];
    for (const c of catalog) {
      const t = (c.title || "").toLowerCase().trim();
      if (t.length >= 4 && lower.includes(t) && !seen.has(c.id)) {
        seen.add(c.id);
        hits.push(c);
      }
    }
    return hits;
  };

  // Signals inside ONE turn, strongest first. Newest turn always wins over older
  // turns, so a fresh message can never be overridden by stale context.
  const signalsInTurn = ({ role, text }: { role: string; text: string }): CatalogItem[] | null => {
    if (role === "user") {
      // 1. Caption extracted from a shared reel/post.
      const caption = text.match(/\[Shared post caption:\s*([^\]]+)\]/i)?.[1]?.trim();
      if (caption) {
        const named = explicitTitles(caption);
        if (named.length) return named;
        const hit = matchProduct(caption, catalog);
        if (hit) return [hit];
      }
    }
    // 2. Explicit product field from a click-to-WhatsApp ad note.
    const note = adNote(text);
    const explicit = note?.match(/product:\s*([^|\]]+)/i)?.[1]?.trim();
    if (explicit) {
      const hit = matchProduct(explicit, catalog);
      if (hit) return [hit];
    }
    // 3. Product-page links.
    for (const words of slugsFromText(text)) {
      const hit = matchProduct(words, catalog);
      if (hit) return [hit];
    }
    // 4. Product named in the text (customer typed it, or the bot / campaign said it).
    if (role === "user" || allowBotNamed) {
      const cleaned = text.replace(/\[Sent from an ad[^\]]*\]/gi, " ");
      const named = explicitTitles(cleaned);
      if (named.length) return named;
      if (role === "user") {
        const hit = matchProduct(cleaned, catalog);
        if (hit) return [hit];
      }
    }
    // 5. Ad headline / body copy.
    if (note) {
      const hit = matchProduct(note, catalog);
      if (hit) return [hit];
    }
    return null;
  };

  for (const turn of newestFirst) {
    const hits = signalsInTurn(turn);
    if (!hits || hits.length === 0) continue;
    const unique = Array.from(new Map(hits.map((h) => [h.id, h])).values());
    if (unique.length > 1) {
      // Two or more products named in the same, most recent message: we cannot
      // know which one they mean — ask instead of guessing.
      console.log("inferProduct: ambiguous, multiple products in newest signal →", unique.map((u) => u.title).join(" | "));
      return null;
    }
    console.log("inferProduct: matched newest signal →", unique[0].title, `(role=${turn.role})`);
    return unique[0];
  }

  // 6. AI fallback over the recent transcript — only if we have a real signal
  // beyond a bare "this / this one / hada". Otherwise we will ask the user.
  if (!hasProductSignal(relevantTurns)) {
    console.log("inferProduct: no product signal, skipping AI fallback");
    return null;
  }
  const transcript = relevantTurns
    .slice(-10)
    .map((t) => `${t.role === "user" ? "Customer" : "Bot"}: ${t.text}`)
    .join("\n");
  const ai = await resolveProductWithAI(deps, transcript, catalog);
  if (ai) console.log("inferProduct: matched via AI fallback →", ai.title);
  return ai;
}


// Natural-language "stop / never mind" phrases (English, Arabic, Arabizi).
const SOFT_CANCEL_PATTERNS: RegExp[] = [
  /\b(never\s?mind|nevermind|forget it|not anymore|no longer|no thanks|not interested|maybe later|cancel)\b/i,
  /(ما بقى بدي|مابقى بدي|ما بدي|مش بدي|خلص شكرا|خلص شكراً|بلا شكرا|ولا يهمك|مش مهتم|بعدين)/,
  /\b(ma b?a?a bade|ma bade|khalas|khlas|balla?sh)\b/i,
];

function looksLikeSoftCancel(text: string | null | undefined): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  return SOFT_CANCEL_PATTERNS.some((r) => r.test(t));
}

// AI-assisted fallback: let the model pick a product_id from the catalog when
// deterministic matching fails (handles paraphrases, mixed languages, offer/bundle names).
async function resolveProductWithAI(
  deps: OrderFlowDeps,
  text: string,
  catalog: CatalogItem[],
): Promise<CatalogItem | null> {
  if (!deps.lovableApiKey || !text || catalog.length === 0) return null;
  try {
    const list = catalog.slice(0, 60).map((c) => `- id=${c.id} | ${c.title} | $${c.price}`).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You map a customer's WhatsApp message to a single product from the catalog. " +
              "The message may be in English, Arabic, or Arabizi and may include qty/price. " +
              "IMPORTANT: If the customer only says 'this', 'this one', 'that', 'hada', or similar without naming the product, reply NONE. " +
              "Base your answer on the MOST RECENT lines of the transcript; ignore products discussed earlier if a newer product was mentioned. " +
              "If two or more different products could be meant, reply NONE. " +
              "You must be able to point to words in the customer's message that name the product. " +
              "Reply with ONLY the product id from the catalog, or the single word NONE if no product clearly matches. No other text.",
          },
          { role: "user", content: `Catalog:\n${list}\n\nCustomer message: ${text}` },
        ],
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const answer = (j?.choices?.[0]?.message?.content || "").trim();
    if (!answer || /^none$/i.test(answer)) return null;
    const id = answer.replace(/^id=/i, "").split(/\s+/)[0];
    const selected = catalog.find((c) => c.id === id);
    if (!selected) return null;
    // Post-validation: the selected product must be grounded in the transcript.
    const lowerTranscript = text.toLowerCase();
    const title = selected.title.toLowerCase();
    // Allow exact title substring, or any "meaningful" title word (3+ chars) appearing.
    const meaningfulWords = title.split(/\s+/).filter((w) => w.length >= 3);
    const grounded = lowerTranscript.includes(title) || meaningfulWords.some((w) => lowerTranscript.includes(w));
    if (!grounded) {
      console.log("resolveProductWithAI: rejected ungrounded match", selected.title, "in transcript", text.slice(0, 200));
      return null;
    }
    // Partial-mismatch guard: if the newest customer wording names a product with
    // words the chosen title does not explain ("minecraft lantern" vs "Minecraft
    // Torch Light"), treat it as ambiguous so the flow asks which product.
    const lastLine = lowerTranscript
      .split("\n")
      .map((l) => l.trim().replace(/^(customer|bot):\s*/i, ""))
      .filter(Boolean)
      .pop() || "";
    const lastTokens = new Set(stripOrderNoise(lastLine).split(/\s+/).filter((t) => t.length > 2));
    const touchesTitle = [...lastTokens].some((t) => meaningfulWords.some((w) => w.startsWith(t) || t.startsWith(w)));
    if (touchesTitle && !titleExplainsHint(selected.title, lastTokens)) {
      console.log("resolveProductWithAI: rejected partial mismatch", selected.title, "for", lastLine.slice(0, 120));
      return null;
    }

    return selected;
  } catch (e) {
    console.error("resolveProductWithAI failed:", e);
    return null;
  }
}

function findDraftItemIndex(input: string | undefined, session: OrderSession): number | null {
  if (!input) return null;
  const normalized = normalizeDigits(input).trim().toLowerCase();
  const numberMatch = normalized.match(/\d+/);
  if (numberMatch) {
    const idx = parseInt(numberMatch[0], 10) - 1;
    if (idx >= 0 && idx < session.draft.items.length) return idx;
  }
  const fakeCatalog = session.draft.items.map((item, index) => ({ id: String(index), title: item.title, price: item.unit_price }));
  const matched = matchProduct(normalized, fakeCatalog);
  if (!matched) return null;
  const idx = Number(matched.id);
  return Number.isInteger(idx) ? idx : null;
}

async function sendText(deps: OrderFlowDeps, body: string): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: deps.phoneNumber, type: "text", text: { body } }),
  });
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId,
    content: body,
    direction: "outgoing",
    status: "sent",
  });
}

async function sendButtons(deps: OrderFlowDeps, body: string, buttons: Array<{ id: string; title: string }>): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: deps.phoneNumber,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // fallback to numbered text
    const fallback = `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n")}`;
    await sendText(deps, fallback);
    return;
  }
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId,
    content: `${body}\n[${buttons.map((b) => b.title).join(" • ")}]`,
    direction: "outgoing",
    status: "sent",
  });
}

async function sendList(deps: OrderFlowDeps, body: string, button: string, rows: Array<{ id: string; title: string; description?: string }>): Promise<void> {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: deps.phoneNumber,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body },
      action: {
        button: button.slice(0, 20),
        sections: [
          {
            title: "Options",
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              description: (r.description || "").slice(0, 72),
            })),
          },
        ],
      },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const fallback = `${body}\n\n${rows.map((r, i) => `${i + 1}. ${r.title}`).join("\n")}\n\nReply with the number.`;
    await sendText(deps, fallback);
    return;
  }
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId,
    content: `${body}\n[List: ${rows.map((r) => r.title).join(" • ")}]`,
    direction: "outgoing",
    status: "sent",
  });
}

// --- session helpers ---

export async function getActiveSession(supabase: any, tenantId: string, contactId: string): Promise<OrderSession | null> {
  const { data } = await supabase
    .from("order_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .not("state", "in", "(done,cancelled)")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

async function saveSession(supabase: any, session: OrderSession): Promise<void> {
  await supabase.from("order_sessions").update({
    state: session.state,
    draft: session.draft,
    pending_hints: session.pending_hints,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).eq("id", session.id);
}

async function cancelSession(supabase: any, sessionId: string): Promise<void> {
  await supabase.from("order_sessions").update({ state: "cancelled" }).eq("id", sessionId);
}

// --- public entry points ---

/**
 * Best known name for this contact: the name saved on the contact record, or the
 * name used on their most recent order. Returns null when nothing usable exists.
 */
async function getKnownCustomerName(deps: OrderFlowDeps): Promise<string | null> {
  const clean = (v: unknown): string | null => {
    const t = String(v ?? "").replace(/\s+/g, " ").trim();
    if (!t) return null;
    if (!isPlausibleName(t)) return null;
    return t.slice(0, 60);
  };

  try {
    const { data: contact } = await deps.supabase
      .from("contacts")
      .select("name")
      .eq("id", deps.contactId)
      .maybeSingle();
    const fromContact = clean(contact?.name);
    if (fromContact) return fromContact;

    const { data: lastOrder } = await deps.supabase
      .from("orders")
      .select("customer_name")
      .eq("tenant_id", deps.tenantId)
      .eq("contact_id", deps.contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return clean(lastOrder?.customer_name);
  } catch (e) {
    console.error("getKnownCustomerName failed", e);
    return null;
  }
}

/**

 * Start a new order flow session for this contact.
 * Resolves any hints from the AI's hint_items[] payload against the catalog.
 * Returns true if a session was started.
 */
export async function startOrderFlow(deps: OrderFlowDeps, hintItems: HintItem[] = []): Promise<boolean> {
  const lang = detectLangFromHistory(deps.conversationHistory || []);

  // Block if there is already an active session
  const existing = await getActiveSession(deps.supabase, deps.tenantId, deps.contactId);
  if (existing) {
    await sendText(deps, T.alreadyInProgress(existing.draft?.lang || lang));
    return false;
  }

  const catalog = await deps.loadCatalog();
  if (catalog.length === 0) {
    await sendText(deps, T.noProducts(lang));
    return false;
  }

  const draft: Draft = { items: [], delivery_fee: DELIVERY_FEE, total: 0, lang };
  const pending: HintItem[] = [];

  // If we already know this customer's name (saved on the contact, or used on a
  // previous order), skip asking for it — same behaviour as product inference.
  const knownName = await getKnownCustomerName(deps);
  if (knownName) {
    draft.customer_name = knownName;
    console.log("startOrderFlow: reusing known customer name:", knownName);
  }


  // Newest product signal in the conversation. It is the source of truth: when the
  // model's hint disagrees with the freshest context (link, reel caption, campaign,
  // typed product name), the context wins.
  const contextProduct = await inferProductFromContext(deps, catalog);

  // Resolve hints
  if (deps.aiHintsEnabled !== false) {
    for (const h of hintItems) {
      let product = matchProduct(h.product_hint, catalog);
      // The hint comes from the model — reject it when nothing in the actual
      // conversation names that product (prevents hallucinated products).
      if (product && !isGroundedInHistory(deps, h.product_hint, product.title)) {
        console.log("startOrderFlow: rejected ungrounded AI hint →", h.product_hint, "→", product.title);
        product = null;
      }
      if (product && contextProduct && product.id !== contextProduct.id) {
        console.log("startOrderFlow: hint", product.title, "overridden by newest context →", contextProduct.title);
        product = contextProduct;
      }
      const qty = Number(h.qty_hint) > 0 ? Math.min(Math.floor(Number(h.qty_hint)), MAX_QTY) : null;
      // Only preserve a model-extracted size/color when that value is present in
      // the imported product facts. This keeps variants grounded and makes the
      // final Shopify matcher choose the requested variant instead of the first.
      const requestedVariant = h.variant_hint?.trim();
      const groundedVariant = product && requestedVariant &&
          String(product.description || '').toLowerCase().includes(requestedVariant.toLowerCase())
        ? requestedVariant
        : undefined;
      if (product && qty) {
        draft.items.push({
          product_id: product.id,
          title: groundedVariant ? `${product.title} (${groundedVariant})` : product.title,
          qty,
          unit_price: product.price,
          source: "hint",
          variant_hint: groundedVariant,
        });
        await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [product.id], content_name: product.title, currency: "USD", value: product.price * qty, num_items: qty });
      } else if (product && !qty) {
        pending.push({ ...h, product_hint: product.title, variant_hint: groundedVariant, needs: "qty" });
      } else {
        pending.push({ ...h, needs: "product" });
      }
    }
  }


  // Nothing resolved from hints → fall back to the product already being discussed
  // (ad referral note or an earlier turn) so we never open with "which product?".
  if (draft.items.length === 0) {
    draft.context_tried = true;
    const inferred = contextProduct;
    if (inferred) {
      draft.items.push({
        product_id: inferred.id,
        title: inferred.title,
        qty: 1,
        unit_price: inferred.price,
        source: "hint",
      });
      pending.length = 0;
      console.log("startOrderFlow: seeded product from conversation context:", inferred.title);
      await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [inferred.id], content_name: inferred.title, currency: "USD", value: inferred.price, num_items: 1 });
    }
  }

  recomputeTotals(draft);

  // Proactively remove any lingering non-final session for this contact (may be expired but
  // still present, which would trip the unique index `order_sessions_one_active_per_contact`).
  // Use DELETE so a silently-failed UPDATE cannot leave a stuck row that blocks all future orders.
  {
    const { error: cleanupError } = await deps.supabase
      .from("order_sessions")
      .delete()
      .eq("tenant_id", deps.tenantId)
      .eq("contact_id", deps.contactId)
      .not("state", "in", "(done,cancelled)");
    if (cleanupError) {
      console.error("startOrderFlow: cleanup delete failed", JSON.stringify(cleanupError));
    }
  }

  // Create the session
  const insertPayload = {
    tenant_id: deps.tenantId,
    contact_id: deps.contactId,
    state: "picking_product",
    draft,
    pending_hints: pending,
    flow_kind: "order",
  };
  let { data: session, error } = await deps.supabase.from("order_sessions").insert(insertPayload).select().single();

  // Extra safety: if a race still caused a 23505, hard-delete any blocker row and retry.
  if (error && (error as any).code === "23505") {
    console.warn("startOrderFlow: 23505 conflict, force-deleting blocker and retrying");
    await deps.supabase
      .from("order_sessions")
      .delete()
      .eq("tenant_id", deps.tenantId)
      .eq("contact_id", deps.contactId)
      .not("state", "in", "(done,cancelled)");
    const retry = await deps.supabase.from("order_sessions").insert(insertPayload).select().single();
    session = retry.data;
    error = retry.error;
  }

  if (error || !session) {
    console.error("startOrderFlow: failed to create session", {
      code: (error as any)?.code,
      message: (error as any)?.message,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    });
    await sendText(deps, T.couldNotStart(lang));
    return true;
  }

  await sendMetaEvent("InitiateCheckout", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { currency: "USD", value: 0 });
  await advanceFlow(deps, session as OrderSession, null);
  return true;
}


/**
 * Process an incoming message inside an active session.
 * `interactive` is the parsed WhatsApp interactive reply (button_reply.id or list_reply.id), if any.
 */
export async function handleSessionMessage(
  deps: OrderFlowDeps,
  session: OrderSession,
  text: string | null,
  interactiveId: string | null,
): Promise<void> {
  // Adapt to the customer's current language on every incoming turn.
  if (text) {
    const nextLang = detectLang(text, session.draft.lang);
    if (nextLang !== session.draft.lang) {
      session.draft.lang = nextLang;
    }
  }

  const lower = (text || "").trim().toLowerCase();
  if (lower === "cancel" || lower === "إلغاء" || lower === "الغاء" || lower === "الغي" || lower === "توقف") {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, T.cancelled(session.draft.lang));
    return;
  }

  // Natural-language backing out ("not anymore thanks", "ما بقى بدي") — stop asking.
  if (!interactiveId && looksLikeSoftCancel(text)) {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, T.cancelled(session.draft.lang));
    return;
  }


  await advanceFlow(deps, session, interactiveId ? { type: "interactive", id: interactiveId } : { type: "text", text: text || "" });
}

interface Incoming {
  type: "text" | "interactive";
  text?: string;
  id?: string;
}

// Buttons/lists stay tappable in WhatsApp forever, so a customer can tap an older
// prompt (e.g. "Use this number") after the flow already moved on. Handling that
// stale tap re-ran the step and sent a duplicate confirmation. Ignore taps that
// don't belong to the current step (cancel is always honoured).
function isInteractiveIdForState(state: string, id: string): boolean {
  if (id === "cart_cancel" || id === "confirm_cancel") return true;
  switch (state) {
    case "picking_product": return id.startsWith("prod_");
    case "reviewing_cart": return id === "cart_done" || id === "cart_add";
    case "upsell_offer": return id === "upsell_yes" || id === "upsell_no";

    case "phone": return id === "phone_use_wa";
    case "editing_items": return id === "edit_add_item" || id === "edit_change_qty" || id === "edit_remove_item" || id === "cart_done";
    case "confirm":
      return id === "confirm_yes" || id === "confirm_edit" || id === "edit_items" ||
        id === "edit_address" || id === "edit_name" || id === "edit_phone";
    default: return false;
  }
}

async function advanceFlow(deps: OrderFlowDeps, session: OrderSession, incoming: Incoming | null): Promise<void> {
  const catalog = await deps.loadCatalog();
  const lang = session.draft.lang;

  if (incoming?.type === "interactive" && incoming.id && !isInteractiveIdForState(session.state, incoming.id)) {
    console.log(`order-flow: ignoring stale button "${incoming.id}" in state "${session.state}"`);
    return;
  }


  switch (session.state) {
    case "picking_product": {
      if (incoming) {
        // Handle list selection
        if (incoming.type === "interactive" && incoming.id?.startsWith("prod_")) {
          const productId = incoming.id.slice("prod_".length);
          const product = catalog.find((c) => c.id === productId);
          if (product) {
            session.draft.items.push({
              product_id: product.id,
              title: product.title,
              qty: 1,
              unit_price: product.price,
              source: "picker",
            });
            await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [product.id], content_name: product.title, currency: "USD", value: product.price, num_items: 1 });
            session.state = "qty";
            await saveSession(deps.supabase, session);
            await sendText(deps, T.askQty(product.title, lang));
            return;
          }
        }
          // A return/exchange complaint or an image transcript (delivery note, receipt)
          // names the item they already have — never a selection. Answer and reprompt.
          if (incoming.type === "text" && incoming.text &&
              (isImageTranscript(incoming.text) || (looksLikeReturnIntent(incoming.text) && !looksLikeOrderSelection(incoming.text)))) {
            await maybeAnswerQuestion(deps, incoming.text, session, catalog);
            await sendText(deps, T.askProductAgain(lang));
            return;
          }
          // Side question? Let AI answer before product matching, unless this clearly selects an item.
          if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text) && !looksLikeOrderSelection(incoming.text)) {
            if (await maybeAnswerQuestion(deps, incoming.text, session, catalog)) {
              await sendText(deps, T.askProductAgain(lang));
              return;
            }
          }
          // Text → first try direct catalog name match, then AI fallback.
        if (incoming.type === "text" && incoming.text) {

          let direct = matchProduct(incoming.text, catalog);
          if (!direct) {
            // Several real variants of the product they named (FG / AG / TF …):
            // let them pick from those instead of re-asking the same question.
            const candidates = matchProductCandidates(incoming.text, catalog, 10);
            if (candidates.length > 1) {
              session.draft.match_attempts = 0;
              await saveSession(deps.supabase, session);
              const rows = candidates.map((c) => ({
                id: `prod_${c.id}`,
                title: c.title.slice(0, 24),
                description: `$${c.price}`,
              }));
              await sendList(deps, T.askProduct(lang), T.askProduct(lang).slice(0, 20), rows);
              return;
            }
          }
          if (!direct) {
            direct = await resolveProductWithAI(deps, incoming.text, catalog);
          }
          if (direct) {
            session.draft.items.push({
              product_id: direct.id,
              title: direct.title,
              qty: 1,
              unit_price: direct.price,
              source: "picker",
            });
            session.draft.match_attempts = 0;
            await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [direct.id], content_name: direct.title, currency: "USD", value: direct.price, num_items: 1 });
            session.state = "qty";
            await saveSession(deps.supabase, session);
            await sendText(deps, T.askQty(direct.title, lang));
            return;
          }
          // Track failed match attempts so we can escalate to a picker list.
          session.draft.match_attempts = (session.draft.match_attempts || 0) + 1;

        }
      }

      if (session.draft.items.length > 0 && session.pending_hints.length === 0) {
        session.state = "reviewing_cart";
        recomputeTotals(session.draft);
        await saveSession(deps.supabase, session);
        await sendCartReview(deps, session);
        return;
      }

      // Last chance before asking: infer the product from ad notes, links, or earlier turns.
      if (session.draft.items.length === 0 && !session.draft.context_tried) {
        session.draft.context_tried = true;
        const inferred = await inferProductFromContext(deps, catalog);
        if (inferred) {
          session.draft.items.push({
            product_id: inferred.id,
            title: inferred.title,
            qty: 1,
            unit_price: inferred.price,
            source: "hint",
          });
          session.draft.match_attempts = 0;
          session.state = "qty";
          recomputeTotals(session.draft);
          await saveSession(deps.supabase, session);
          await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [inferred.id], content_name: inferred.title, currency: "USD", value: inferred.price, num_items: 1 });
          await sendText(deps, T.askQty(inferred.title, lang));
          return;
        }
        await saveSession(deps.supabase, session);
      }


      session.draft.product_asks = (session.draft.product_asks || 0) + 1;

      // Never loop the same question forever — after 4 asks, close the session
      // and let a human / normal AI chat take over.
      if (session.draft.product_asks > 4) {
        await cancelSession(deps.supabase, session.id);
        await sendText(deps, T.cancelled(lang));
        return;
      }

      // After 2 failed text attempts, show a product list picker — but only when we
      // actually have a real multi-product catalog. With 1-2 rows the "picker" is
      // just noise (and used to surface knowledge docs), so keep asking them to type.
      if ((session.draft.match_attempts || 0) >= 2 && catalog.length >= 3) {
        session.draft.match_attempts = 0;
        await saveSession(deps.supabase, session);
        const rows = catalog.slice(0, 10).map((c) => ({
          id: `prod_${c.id}`,
          title: c.title.slice(0, 24),
          description: `$${c.price}`,
        }));
        await sendList(deps, T.askProduct(lang), T.askProduct(lang).slice(0, 20), rows);
        return;
      }

      await saveSession(deps.supabase, session);
      await sendText(deps, T.askProduct(lang));
      return;
    }


    case "qty": {
      const last = session.draft.items[session.draft.items.length - 1];
      if (!last) {
        session.state = "picking_product";
        await saveSession(deps.supabase, session);
        await advanceFlow(deps, session, null);
        return;
      }
      let qty: number | null = null;
      if (incoming?.type === "text") {
        qty = parseQtyAnswer(incoming.text || "");
      }

      if (qty && qty > 0 && qty <= MAX_QTY) {
        last.qty = qty;
        recomputeTotals(session.draft);
        session.state = "reviewing_cart";
        await saveSession(deps.supabase, session);
        await sendCartReview(deps, session);
        return;
      }
      if (qty && qty > MAX_QTY) {
        await sendText(deps, T.maxQty(MAX_QTY, lang));
        return;
      }
      if (incoming?.type === "text" && await maybeAnswerQuestion(deps, incoming.text || "", session, catalog)) {
        await sendText(deps, T.askQty(last.title, lang));
        return;
      }
      await sendText(deps, T.askQty(last.title, lang));
      return;
    }



    case "upsell_offer": {
      if (incoming?.type === "interactive" && incoming.id === "upsell_yes") {
        const extra = catalog.find((c) => c.id === session.draft.upsell_product_id);
        if (extra) {
          session.draft.items.push({
            product_id: extra.id,
            title: extra.title,
            qty: 1,
            unit_price: extra.price,
            source: "picker",
          });
          recomputeTotals(session.draft);
          await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [extra.id], content_name: extra.title, currency: "USD", value: extra.price, num_items: 1 });
        }
        session.state = nextMissingState(session.draft);
        await saveSession(deps.supabase, session);
        await promptForState(deps, session);
        return;
      }
      // "No thanks", any text, or anything else → continue checkout, never re-offer.
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)
        && await maybeAnswerQuestion(deps, incoming.text, session, catalog)) {
        session.state = nextMissingState(session.draft);
        await saveSession(deps.supabase, session);
        await promptForState(deps, session);
        return;
      }
      // Free text here is a decline plus, often, the next answer already typed
      // (name/address). Move on and re-feed the same message so it isn't lost.
      session.state = nextMissingState(session.draft);
      await saveSession(deps.supabase, session);
      if (incoming?.type === "text" && incoming.text?.trim()) {
        await advanceFlow(deps, session, incoming);
        return;
      }
      await promptForState(deps, session);
      return;

    }

    case "reviewing_cart": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "cart_done") {
          clearEditState(session.draft);
          await proceedFromCart(deps, session, catalog);
          return;
        }

        if (incoming.id === "cart_add") {
          session.state = "picking_product";
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askAddItem(lang));
          return;
        }
        if (incoming.id === "cart_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, T.cancelled(lang));
          return;
        }
      }
      // Free text mid-review → try product match, else answer question, else re-show cart.
      if (incoming?.type === "text" && incoming.text) {
        // Return/exchange talk and image transcripts must never add an item to the cart.
        if (isImageTranscript(incoming.text) || (looksLikeReturnIntent(incoming.text) && !looksLikeOrderSelection(incoming.text))) {
          await maybeAnswerQuestion(deps, incoming.text, session, catalog);
          await sendButtons(deps, T.readyContinue(lang), [
            { id: "cart_done", title: T.btnDone(lang) },
            { id: "cart_add", title: T.btnAdd(lang) },
            { id: "cart_cancel", title: T.btnCancel(lang) },
          ]);
          return;
        }
        if (looksLikeQuestion(incoming.text) && !looksLikeOrderSelection(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session, catalog)) {
            // Don't repeat the cart — just nudge with a single short line.
            await sendButtons(deps, T.readyContinue(lang), [
              { id: "cart_done", title: T.btnDone(lang) },
              { id: "cart_add", title: T.btnAdd(lang) },
              { id: "cart_cancel", title: T.btnCancel(lang) },
            ]);
            return;
          }
        }
        const direct = matchProduct(incoming.text, catalog);

        if (direct) {
          session.draft.items.push({
            product_id: direct.id,
            title: direct.title,
            qty: 1,
            unit_price: direct.price,
            source: "picker",
          });
          await sendMetaEvent("AddToCart", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { content_ids: [direct.id], content_name: direct.title, currency: "USD", value: direct.price, num_items: 1 });
          session.state = "qty";
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askQty(direct.title, lang));
          return;
        }
      }
      await sendCartReview(deps, session);
      return;
    }

    case "name": {
      if (incoming?.type === "text") {
        const raw = (incoming.text || "").trim();
        const extracted = extractNameFromPhrase(raw);
        const nameCandidate = extracted || (raw && !looksLikeQuestion(raw) && isPlausibleName(raw) ? raw : null);
        if (nameCandidate) {
          session.draft.customer_name = nameCandidate.replace(/\s+/g, " ").slice(0, 60);
          session.state = nextMissingState(session.draft);
          await saveSession(deps.supabase, session);
          await promptForState(deps, session);
          return;
        }
        // side question → answer, then reprompt
        if (await maybeAnswerQuestion(deps, incoming.text || "", session, catalog)) {
          await sendText(deps, T.askName(lang));
          return;
        }
        // rejected: tell them why
        if (raw.length > 0) {
          await sendText(deps, T.nameInvalid(lang));
          return;
        }
      }
      await sendText(deps, T.askName(lang));
      return;
    }

    case "address": {
      if (incoming?.type === "text") {
        const raw = (incoming.text || "").trim();
        if (raw && !looksLikeQuestion(raw) && isPlausibleAddress(raw)) {
          session.draft.address = raw.slice(0, 240);
          session.state = nextMissingState(session.draft);
          await saveSession(deps.supabase, session);
          await promptForState(deps, session);
          return;
        }
        if (await maybeAnswerQuestion(deps, incoming.text || "", session, catalog)) {
          await sendText(deps, T.askAddress(lang));
          return;
        }
        if (raw.length > 0) {
          await sendText(deps, T.addressInvalid(lang));
          return;
        }
      }
      await sendText(deps, T.askAddressFull(lang));
      return;
    }

    case "phone": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "phone_use_wa") {
          session.draft.contact_phone = deps.phoneNumber;
          session.state = nextMissingState(session.draft);
          await saveSession(deps.supabase, session);
          await promptForState(deps, session);
          return;
        }
        if (incoming.id === "cart_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, T.cancelled(lang));
          return;
        }
      }
      if (incoming?.type === "text") {
        const raw = (incoming.text || "").trim();
        if (raw && !looksLikeQuestion(raw)) {
          const normalized = normalizePhone(raw);
          if (normalized) {
            session.draft.contact_phone = normalized;
            session.state = nextMissingState(session.draft);
            await saveSession(deps.supabase, session);
            await promptForState(deps, session);
            return;
          }
        }
        if (await maybeAnswerQuestion(deps, incoming.text || "", session, catalog)) {
          await sendPhonePrompt(deps, lang);
          return;
        }
        if (raw.length > 0) {
          await sendText(deps, T.phoneInvalid(lang));
          return;
        }
      }
      await sendPhonePrompt(deps, lang);
      return;
    }

    case "editing_items": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "edit_add_item") {
          clearEditState(session.draft);
          session.state = "picking_product";
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askAddProduct(lang));
          return;
        }
        if (incoming.id === "edit_change_qty") {
          session.draft.edit_mode = "change_qty";
          await saveSession(deps.supabase, session);
          await promptForItemSelection(deps, session, T.whichChangeQty(lang));
          return;
        }
        if (incoming.id === "edit_remove_item") {
          session.draft.edit_mode = "remove";
          await saveSession(deps.supabase, session);
          await promptForItemSelection(deps, session, T.whichRemove(lang));
          return;
        }
        if (incoming.id === "cart_done") {
          clearEditState(session.draft);
          await proceedFromCart(deps, session, catalog);
          return;
        }

      }

      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session, catalog)) {
          await sendEditItemsMenu(deps, lang);
          return;
        }

        const lowered = incoming.text.trim().toLowerCase();
        if (/\b(add|زيد|ضيف)\b/i.test(lowered)) {
          clearEditState(session.draft);
          session.state = "picking_product";
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askAddProduct(lang));
          return;
        }
        if (/\b(remove|delete|cancel item|شيل|حذف)\b/i.test(lowered)) {
          session.draft.edit_mode = "remove";
          await saveSession(deps.supabase, session);
          await promptForItemSelection(deps, session, T.whichRemove(lang));
          return;
        }
        if (/\b(qty|quantity|number|كمية|عدد)\b/i.test(lowered)) {
          session.draft.edit_mode = "change_qty";
          await saveSession(deps.supabase, session);
          await promptForItemSelection(deps, session, T.whichChangeQty(lang));
          return;
        }

        const idx = findDraftItemIndex(incoming.text, session);
        if (idx !== null && session.draft.edit_mode === "remove") {
          const removed = session.draft.items.splice(idx, 1)[0];
          clearEditState(session.draft);
          recomputeTotals(session.draft);
          if (session.draft.items.length === 0) {
            session.state = "picking_product";
            await saveSession(deps.supabase, session);
            await sendText(deps, T.askReplaceProduct(removed.title, lang));
            return;
          }
          session.state = nextMissingState(session.draft);
          await saveSession(deps.supabase, session);
          await sendText(deps, T.removed(removed.title, lang));
          await promptForState(deps, session);
          return;
        }
        if (idx !== null && session.draft.edit_mode === "change_qty") {
          session.draft.edit_item_index = idx;
          session.state = "editing_qty";
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askQtyFor(session.draft.items[idx].title, lang));
          return;
        }
      }

      await sendEditItemsMenu(deps, lang);
      return;
    }

    case "editing_qty": {
      const idx = typeof session.draft.edit_item_index === "number" ? session.draft.edit_item_index : -1;
      const item = session.draft.items[idx];
      if (!item) {
        clearEditState(session.draft);
        session.state = "editing_items";
        await saveSession(deps.supabase, session);
        await sendEditItemsMenu(deps, lang);
        return;
      }

      let qty: number | null = null;
      if (incoming?.type === "text") {
        qty = parseQtyAnswer(incoming.text || "");
      }

      if (qty && qty > 0 && qty <= MAX_QTY) {
        item.qty = qty;
        clearEditState(session.draft);
        recomputeTotals(session.draft);
        session.state = nextMissingState(session.draft);
        await saveSession(deps.supabase, session);
        await promptForState(deps, session);
        return;
      }
      if (qty && qty > MAX_QTY) {
        await sendText(deps, T.maxQty(MAX_QTY, lang));
        return;
      }
      if (incoming?.type === "text" && await maybeAnswerQuestion(deps, incoming.text || "", session, catalog)) {
        await sendText(deps, T.askQtyFor(item.title, lang));
        return;
      }
      await sendText(deps, T.askQtyFor(item.title, lang));
      return;
    }




    case "confirm": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "confirm_yes") {
          const result = await deps.finalizeOrder(session.draft);
          if (result.success) {
            await deps.supabase.from("order_sessions").update({ state: "done" }).eq("id", session.id);
            await sendMetaEvent("Purchase", Math.floor(Date.now() / 1000), { phone: deps.phoneNumber }, { currency: "USD", value: session.draft.total, content_ids: session.draft.items.map((i) => i.product_id), content_name: session.draft.items.map((i) => i.title).join(", "), num_items: session.draft.items.reduce((s, i) => s + i.qty, 0) });
            await sendText(
              deps,
              T.orderPlaced(String(result.displayId ?? ""), session.draft.total, DELIVERY_FEE, lang),
            );
          } else {
            await sendText(deps, T.orderFailed(result.error || (lang === "ar" ? "جرب مرة تانية" : "please try again"), lang));
          }
          return;
        }
        if (incoming.id === "confirm_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, T.cancelledShort(lang));
          return;
        }
        if (incoming.id === "confirm_edit") {
          clearEditState(session.draft);
          await saveSession(deps.supabase, session);
          await sendConfirmEditMenu(deps, lang);
          return;
        }
        if (incoming.id === "edit_items") {
          session.state = "editing_items";
          await saveSession(deps.supabase, session);
          await sendEditItemsMenu(deps, lang);
          return;
        }
        if (incoming.id === "edit_address") {
          session.state = "address";
          session.draft.address = undefined;
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askAddressNew(lang));
          return;
        }
        if (incoming.id === "edit_name") {
          session.state = "name";
          session.draft.customer_name = undefined;
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askName(lang));
          return;
        }
        if (incoming.id === "edit_phone") {
          session.state = "phone";
          session.draft.contact_phone = undefined;
          await saveSession(deps.supabase, session);
          await sendText(deps, T.askPhoneNew(lang));
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session, catalog)) {
        await sendButtons(deps, T.readyConfirm(lang), [
          { id: "confirm_yes", title: T.btnConfirm(lang) },
          { id: "confirm_edit", title: T.btnEdit(lang) },
          { id: "confirm_cancel", title: T.btnCancel(lang) },
        ]);
        return;
      }
      await sendSummary(deps, session);
      return;
    }


  }
}

async function sendCartReview(deps: OrderFlowDeps, session: OrderSession): Promise<void> {
  const lang = session.draft.lang;
  const lines = session.draft.items.map((i) => `• ${i.qty}× ${i.title} — $${(i.qty * i.unit_price).toFixed(2)}`).join("\n");
  const subtotal = session.draft.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const body = `${T.cartHeader(lang)}\n${lines}\n\n${T.cartSubtotal(lang)}: $${subtotal.toFixed(2)}\n\n${T.cartAnythingElse(lang)}`;
  await sendButtons(deps, body, [
    { id: "cart_done", title: T.btnDone(lang) },
    { id: "cart_add", title: T.btnAdd(lang) },
    { id: "cart_cancel", title: T.btnCancel(lang) },
  ]);
}

async function sendConfirmEditMenu(deps: OrderFlowDeps, lang?: Lang): Promise<void> {
  await sendList(deps, T.editWhat(lang), T.btnEdit(lang), [
    { id: "edit_items", title: T.btnItems(lang) },
    { id: "edit_address", title: T.btnAddress(lang) },
    { id: "edit_phone", title: T.btnPhone(lang) },
    { id: "edit_name", title: T.btnName(lang) },
  ]);
}

async function sendEditItemsMenu(deps: OrderFlowDeps, lang?: Lang): Promise<void> {
  await sendButtons(deps, T.editItems(lang), [
    { id: "edit_add_item", title: T.btnAdd(lang) },
    { id: "edit_change_qty", title: T.btnChangeQty(lang) },
    { id: "edit_remove_item", title: T.btnRemove(lang) },
  ]);
}

async function promptForItemSelection(deps: OrderFlowDeps, session: OrderSession, body: string): Promise<void> {
  const lang = session.draft.lang;
  if (session.draft.items.length === 1) {
    const idx = 0;
    if (session.draft.edit_mode === "remove") {
      const removed = session.draft.items.splice(idx, 1)[0];
      clearEditState(session.draft);
      recomputeTotals(session.draft);
      session.state = "picking_product";
      await saveSession(deps.supabase, session);
      await sendText(deps, T.askReplaceProduct(removed.title, lang));
      return;
    }
    session.draft.edit_item_index = idx;
    session.state = "editing_qty";
    await saveSession(deps.supabase, session);
    await sendText(deps, T.askQtyFor(session.draft.items[idx].title, lang));
    return;
  }

  const lines = session.draft.items.map((i, idx) => `${idx + 1}. ${i.qty}× ${i.title}`).join("\n");
  await sendText(deps, T.askItemNumber(body, lines, lang));
}

async function sendSummary(deps: OrderFlowDeps, session: OrderSession): Promise<void> {
  const lang = session.draft.lang;
  const lines = session.draft.items.map((i) => `• ${i.qty}× ${i.title} — $${(i.qty * i.unit_price).toFixed(2)}`).join("\n");
  const body = [
    T.pleaseConfirm(lang),
    "",
    lines,
    "",
    `${T.deliveryLabel(lang)}: $${session.draft.delivery_fee.toFixed(2)}`,
    `${T.totalLabel(lang)}: $${session.draft.total.toFixed(2)}`,
    "",
    `${T.nameLabel(lang)}: ${session.draft.customer_name || "-"}`,
    `${T.phoneLabel(lang)}: ${session.draft.contact_phone || "-"}`,
    `${T.addressLabel(lang)}: ${session.draft.address}`,
  ].join("\n");
  await sendButtons(deps, body, [
    { id: "confirm_yes", title: T.btnConfirm(lang) },
    { id: "confirm_edit", title: T.btnEdit(lang) },
    { id: "confirm_cancel", title: T.btnCancel(lang) },
  ]);
}


