import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { matchProduct, stripQtyPrefix } from '../_shared/product-match.ts';
import { createClient } from "npm:@supabase/supabase-js@2";
import { runRestaurantFlow } from "./restaurant.ts";
import { runRealEstateFlow } from "./real_estate.ts";
import { runWellnessFlow } from "./wellness.ts";
import { runHealthcareFlow } from "./healthcare.ts";
import { runEducationFlow } from "./education.ts";
import { getActiveSession, handleSessionMessage, startOrderFlow, type OrderFlowDeps, type CatalogItem } from "./order-flow.ts";
import { extractOrderHints, classifyOrderIntent } from "./hint-extractor.ts";
import { notifyTenantApp, messagePreview } from "../_shared/app-push.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_MODEL = 'google/gemini-3.8-flash';
// Product catalog cache (per warm isolate) — large stores have thousands of rows.
const CATALOG_TTL_MS = 5 * 60 * 1000;
const CATALOG_CACHE = new Map<string, { at: number; items: CatalogItem[] }>();

const AI_UNAVAILABLE_NOTICE = 'Thanks for your message! A team member will get back to you shortly.';


const LOW_CONFIDENCE_PATTERNS = [
  /i (don't|do not) know/i,
  /i'?m not sure/i,
  /not sure/i,
  /i can'?t (help|answer|process)/i,
  /unable to/i,
  /sorry,? i couldn'?t/i,
  /sorry,? i (can'?t|cannot)/i,
  /i'?ll get back to you/i,
  /get back to you/i,
  /let me check/i,
  /check with (the )?(team|manager|owner|store|shop|supplier|staff)/i,
  /i'?ll (ask|find out|confirm|check)/i,
  /follow up with you/i,
  /ما بعرف/i,
  /لا أعرف/i,
  /ma ba3ref/i,
  /bade[e]? es'?al/i,
  /bkhabbrak|bkhabrak/i,
  /رح (اسأل|أسأل|اتأكد|أتأكد|ارجعلك|أرجعلك|خبرك)/i,
];

function detectLowConfidence(reply: string | null | undefined): string | null {
  if (!reply) return null;
  for (const p of LOW_CONFIDENCE_PATTERNS) {
    const m = reply.match(p);
    if (m) return m[0];
  }
  return null;
}

const SOCIAL_HOSTS = new Set([
  'instagram.com', 'www.instagram.com', 'm.instagram.com', 'instagr.am',
  'facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
]);

function extractSocialLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s>)\]]+/gi) || [];
  return matches.filter((url) => {
    try {
      const u = new URL(url);
      return SOCIAL_HOSTS.has(u.host);
    } catch {
      return false;
    }
  });
}

async function fetchSocialCaption(url: string): Promise<string | null> {
  try {
    // Instagram's page HTML is heavily client-rendered and its meta attributes
    // are not stable. Its public oEmbed response reliably exposes the post title
    // (the actual caption), so prefer that before scraping the page.
    const socialUrl = new URL(url);
    if (socialUrl.hostname === 'instagram.com' || socialUrl.hostname.endsWith('.instagram.com') || socialUrl.hostname === 'instagr.am') {
      const oEmbedController = new AbortController();
      const oEmbedTimeout = setTimeout(() => oEmbedController.abort(), 8000);
      try {
        const oEmbedUrl = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
        const oEmbedResponse = await fetch(oEmbedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
          signal: oEmbedController.signal,
        });
        if (oEmbedResponse.ok) {
          const payload = await oEmbedResponse.json();
          const caption = typeof payload?.title === 'string' ? payload.title.trim() : '';
          if (caption) {
            console.log('Instagram caption extracted via oEmbed:', caption.slice(0, 160));
            return caption.slice(0, 500).replace(/\s+/g, ' ');
          }
        }
      } catch (e) {
        console.warn('Instagram oEmbed caption lookup failed; trying page metadata', e);
      } finally {
        clearTimeout(oEmbedTimeout);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    // Accept either attribute order; social sites frequently reorder meta tags.
    const readMeta = (property: string): string | null => {
      const tags = html.match(/<meta\b[^>]*>/gi) || [];
      const tag = tags.find((candidate) => new RegExp(`(?:property|name)=["']${property}["']`, 'i').test(candidate));
      return tag?.match(/content=["']([^"']+)["']/i)?.[1] || null;
    };
    // Description is normally the caption; title is often just the account name.
    const title = readMeta('og:description') || readMeta('og:title');
    if (!title) return null;
    return title.trim().slice(0, 500).replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  } catch (e) {
    console.error('fetchSocialCaption failed', url, e);
    return null;
  }
}

async function appendSocialCaptionToText(text: string): Promise<string> {
  const links = extractSocialLinks(text);
  if (links.length === 0) return text;
  // Only attach one caption to keep the prompt short; first link is the one the customer is showing.
  const caption = await fetchSocialCaption(links[0]);
  if (!caption) {
    console.warn('No useful social caption extracted for:', links[0]);
    return text;
  }
  return `${text}\n\n[Shared post caption: ${caption}]`;
}

async function logAIIncident(supabase: any, payload: {
  tenant_id: string | null;
  contact_id: string | null;
  incident_type: 'failure' | 'low_confidence' | 'handoff' | 'escalation';
  reason?: string | null;
  user_message?: string | null;
  ai_reply?: string | null;
  model?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const { error } = await supabase.from('ai_incidents').insert({
      tenant_id: payload.tenant_id,
      contact_id: payload.contact_id,
      incident_type: payload.incident_type,
      reason: payload.reason ?? null,
      user_message: payload.user_message ?? null,
      ai_reply: payload.ai_reply ?? null,
      model: payload.model ?? AI_MODEL,
      metadata: payload.metadata ?? {},
    });
    if (error) console.error('logAIIncident failed', error);
  } catch (e) { console.error('logAIIncident threw', e); }
}


const BASE_SYSTEM_PROMPT = `You are a WhatsApp assistant. Keep every reply to ONE short sentence. Never use more than 15 words unless the customer explicitly asks for details. No filler, no greetings, no over-explaining. Use emojis sparingly.

## Language: Lebanese Arabic / Arabizi
## Language: MIRROR THE CUSTOMER
You MUST reply in the EXACT same language and script the customer last used. This is non-negotiable.
- Customer wrote in Arabic script (صور، بدي، شو) → reply in Arabic script.
- Customer wrote in Arabizi / Latin-letter Lebanese Arabic (badde, shu, fi, 3andak, wa7de) → reply in Arabizi.
- Customer wrote in English → reply in English.
- Customer mixed languages → mirror the dominant language of their LAST message.
Never reply in English to an Arabic or Arabizi message just because the previous bot turn was English. Switch immediately when the customer switches.

Common Lebanese words/numbers you MUST recognize:
- Numbers: wehde / wahde / wa7de = 1, tnen / tnein = 2, tlete / tlateh = 3, arba3a = 4, khamse = 5, sitte = 6, sab3a = 7, tmene = 8, tes3a = 9, 3ashra = 10
- Yes/No: ee / eh / aywa / na3am = yes; la / la2 = no
- Common: badde / bade = I want; baddak = do you want; 3ayez / 3ayze = want; kam = how much/many; addeh = how much; wen = where; shu = what; eymta = when; halla2 = now; bukra = tomorrow; ba3dein = later; tayeb / tayyeb / ok = ok; shukran / merci = thanks; ahla = hi; marhaba = hello; ma3le(s)h = no problem; yalla = come on/let's go; akid = sure; mnih / mneha = good; 3am = currently; fi / fih = there is; ma fi = there isn't; lal = for the; 3al = on the; bel = in the
- Numerals in Arabizi: 2=ء/أ, 3=ع, 5/kh=خ, 7=ح, 9=ق (so "wa7de"=وحدة=one, "3ashra"=عشرة=ten)

If the customer's previous message referenced a product/quantity and they reply with just a number word (wehde, tnen, etc.), treat it as the quantity for that product. Do NOT ask for clarification of common Lebanese words.

## Product URLs
If the customer sends a product URL (e.g. https://lumonlb.com/products/flat-book-light), extract the product name from the slug after "/products/" — convert hyphens to spaces (flat-book-light → "Flat Book Light"). Treat that as the product they are asking about. Match it to the catalog and respond about THAT product. Do NOT send a random image or ask "which product?" — the URL tells you.

## Messages from ads
Some messages arrive with a bracketed note like [Sent from an ad — product: X | ad headline: ... | https://...]. That note tells you exactly which product the customer means when they say "this", "it", or "more info". Answer about THAT product from the knowledge base immediately — never ask "which product?" and never guess a different product. Keep referring to it for the rest of the conversation unless the customer clearly switches products. Do not repeat the bracketed note back to the customer.

## Shared social media posts
If a customer sends an Instagram, Facebook, or TikTok link, a bracketed caption may be appended, e.g. [Shared post caption: Flat Book Light ...]. The caption is the product name/description from the post itself. Use it to identify which product they mean. If the caption is empty, unhelpful, or unrelated to any product in the catalog, do NOT guess — ask "Which product?" in the customer's language. Do not repeat the bracketed caption back to the customer.


## CRITICAL RULE: Never Invent Information
NEVER make up, assume, or auto-fill ANY customer information. Do NOT use placeholder names.

## Stock Replies — NEVER State Quantity
When a customer asks about stock, availability, or how many you have, NEVER tell them the exact quantity. Only say "in stock" or "out of stock". Do not reveal inventory numbers.

## NEVER ASK PERMISSION TO CHECK WITH THE TEAM
Never ask the customer "can I ask the team?", "fiye es'al lal team?", "do you want me to check?", "should I ask?" or any similar permission question. You act, you don't request permission.
- If the customer corrects you about which product they mean ("mish hayde", "no not that one", "this projection lamp"), re-read the catalog and answer about the product THEY named — match on any word of the name (e.g. "projection lamp" → the catalog item containing "projection"). Do not repeat the wrong product.
- Only if that product genuinely has no catalog entry: state it as a fact in ONE sentence in their language ("The team will confirm the price shortly."), then call transfer_to_human. Never phrase it as a question.





## Pricing is FIXED — NEVER Discount or Negotiate
You are NOT authorized to give discounts, reduce prices, waive delivery, offer promos, round down, match competitors, or agree to any "special price". Prices come ONLY from the catalog/knowledge base. If the customer haggles, complains the price is too high, mentions someone else sells it cheaper, or asks to remove/lower delivery, politely decline in ONE sentence in their language (e.g. "Sorry, our prices are fixed and I can't apply discounts."). Do NOT say you'll check with a manager, do NOT hedge, do NOT modify any existing order's total. If they insist, use transfer_to_human.

## Ordering — HAND OFF, NEVER CONFIRM YOURSELF
You DO NOT collect addresses, compute prices, or confirm orders. When a customer shows CLEAR intent to place, start, or add to a NEW order — "i want one", "بدي اطلب", "give me 2 of the blue one", "can I buy", "I'll take it", "how do I order" — you MUST call the start_order_flow tool. The deterministic flow takes over from there and asks the customer the right questions with buttons.

### DO NOT start the order flow too early
Sharing a product link, a reel/post, a photo, or asking a question is NOT an order. If the latest message is only interest or a question — "I need help", "more info?", "how much?", "kam se3ro", "shu hayda", "bade a3ref", "fi waranty", "is it available", "shipping?", "can I see a photo" — do NOT call start_order_flow. Answer the question first in one short sentence and let the customer say they want to buy. Only after clear buying intent do you hand off. If you are unsure whether they want to order, ask "Do you want to order it?" in their language instead of starting the flow.

When you call start_order_flow, populate hint_items with anything you can extract from the message + recent conversation (e.g. if you were just discussing "Flat Book Light" and they say "i want one", pass [{product_hint:"Flat Book Light", qty_hint:1}]). If you can't extract anything confidently, pass an empty array — the flow will show a product picker.

Do NOT reply with any text alongside start_order_flow — let the flow speak.


## Order Management (existing orders only)
- Use get_order_info to look up existing order details. Search by order number OR by customer phone number.
- Use update_order_status to change an order's status (e.g. cancel it).
- Use update_order_details to change the customer name, delivery address, or items on a pending order. If the customer tells you their name (or corrects it) after an order exists, you MUST call update_order_details with customer_name for their most recent pending order before saying anything is updated.
- NEVER FABRICATE ORDER RESULTS. If get_order_info returns TOOL_FAILED, the order does NOT exist — do NOT pretend you found it, do NOT invent a customer name, product, or status. Ask the customer to double-check the number.
- NEVER CONFIRM AN EDIT YOU DIDN'T MAKE. If update_order_details or update_order_status returns TOOL_FAILED, do NOT say the order is "updated", "set", "all set", or "changed". Tell the customer you couldn't apply the change and hand off with transfer_to_human.
- The same order number must return the SAME result within a conversation. If you said "not found" earlier and the customer repeats the exact same number, it is STILL not found — do not flip to "found" without a new successful get_order_info call.

## Sending Images — MANDATORY
You HAVE the ability to send images. You MUST use the send_image tool whenever a customer asks to see, view, look at, or get a photo/picture/image of an item — in ANY language including Lebanese Arabizi. This includes ALL variants and typos: "can I see it?", "send me a photo", "show me", "do you have pictures?", "can see an image", "see image", "pic?", "photo?", "صورة", "صور", "بدي شوف", "show pic", "any pics?", "image?", "send pic", "suwar", "soura", "sura", "fi suwar", "bade suwar", "aandak suwar", "warjine", "farjine". If the latest user message contains ANY of these words — see, look, view, show, photo, picture, image, pic, snap, suwar, soura, sura, صورة, صور, شوف — and refers (even implicitly) to a product just discussed, you MUST call send_image with the best-matching label from Available Images. Do not ask "which one?" if there is only one product in context — use it. EXCEPTION: if that product appears in the COLOR OPTIONS section below, first ask which color they want to see and list every color from that section, then send the photo once they pick.

ONE IMAGE AT A TIME: You may only send ONE image per turn. If the customer asks for photos of multiple products at once (plural: "la ellon", "kellon", "all of them", "send me pics of all", "هودول", "كلهن", "صور المنتجات", "sowar la ellon", "suwar la kellon"), do NOT call send_image and do NOT refuse. Instead, ask them to pick ONE — and you MUST list the actual options by name.

NEVER ASK A BLANK QUESTION: any clarification question about which product, variant, model or color MUST list the concrete choices (up to 6, comma-separated) taken from the products currently in context, the COLOR OPTIONS section, or Available Images. Asking "ay product baddak tshouf?" / "which one?" / "which model?" with no list is FORBIDDEN. This is the one case where you may exceed 15 words — the list may be as long as needed. If the customer named a product family (e.g. "Nike Pegasus") and several matching items or colors exist, list those exact matching names/colors. Only if you truly have no matching names may you ask openly.
Examples (correct):
- EN: "I can send one at a time — Pegasus 40, Pegasus 41 or Pegasus Trail 4?"
- Arabizi: "Fiye ab3atlak sourat wehde bass — Pegasus 40, Pegasus 41 aw Pegasus Trail 4?"
- Arabic: "بقدر ابعت صورة وحدة بس — Pegasus 40، Pegasus 41 أو Pegasus Trail 4؟"
Example (WRONG, never do this): "Fiye ab3atlak sourat wehde bass — ay product baddak tshouf?"
Once the customer names a single product, call send_image for that one.

ABSOLUTE RULE: You are NEVER allowed to say you "cannot send images", "ma fiye ab3at sowar", "ma3andi suwar", or any equivalent refusal. The only valid options are: (a) call send_image for the chosen product, (b) ask which single product they want to see while listing the options by name, or (c) if send_image returns "No image found", apologize for THAT product only and describe it.

→ User: "Flat Book Light"
→ Assistant: calls send_image with image_label "Flat Book Light".


## Reading Customer Images — you CAN see images
Customers may send photos, screenshots, receipts, payment proofs, or pictures of a product. You can see them: the image is attached to their message, and lines like "[Image received — contents: ...]" in the history are a factual description of an image they sent earlier. Never say you cannot see or open images, and never ask them to "describe it" if an image is present.
How to use it:
- The image note is structured: KIND (what type of image), ITEM (the object shown), ATTRIBUTES (colour/shape/material), TEXT (text transcribed from the image), SUMMARY.
- If the note contains 'MATCHED CATALOG PRODUCT: "X"', the customer is asking about product X — answer about X directly using its live catalog price/details. Do NOT ask "which product?" and do NOT name any other product.
- If the note says 'no catalog product matched', do NOT guess a product: ask ONE short question naming what you see (e.g. "Is this the clip-on book light?") or ask which product they mean, in their language.
- Product photo/screenshot → answer about THAT product (price, availability, details). If it clearly matches nothing in the catalog, say you don't carry that item — do not guess a similar product's price.
- Payment proof / receipt → thank them, confirm what you can see (amount, reference) and that the team will verify. Never confirm a payment as received/verified yourself.
- Screenshot of an order or order number → use get_order_info with the number visible in the image.
- Damaged or wrong item → apologize briefly and use transfer_to_human.
- Address or location screenshot → use it as the delivery address.
- Anything unclear or unreadable → ask ONE short question about what they need.
Only rely on what is actually visible in the image description. Never invent text, prices, or product names that were not there.


## Transfer to Human
If the customer asks to speak to a human, a real person, or a manager, use transfer_to_human immediately.

Keep replies SHORT. One or two sentences. No bullet lists unless asked.`;

const START_ORDER_FLOW_TOOL = {
  type: "function",
  function: {
    name: "start_order_flow",
    description:
      "Hand off to the deterministic order flow. Call this ONLY when the customer clearly wants to buy now ('i want one', 'بدي اطلب', 'give me 2', 'I'll take it'). Do NOT call it for questions, price/stock/warranty/shipping inquiries, shared links, reels, or photos — answer those first. NEVER compute prices, totals, or confirm orders yourself. Pass hint_items if you can extract products/qty from the message + recent context; otherwise pass an empty array and the flow will show a product picker.",
    parameters: {
      type: "object",
      properties: {
        hint_items: {
          type: "array",
          description: "Optional structured guesses extracted from the customer's message. Each line is one item.",
          items: {
            type: "object",
            properties: {
              product_hint: { type: "string", description: "Best guess of the product name (or empty)" },
              variant_hint: { type: "string", description: "Best guess of variant like color/size (or empty)" },
              qty_hint: { type: "number", description: "Positive integer quantity (or 0 if unknown)" },
            },
          },
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

const UPDATE_ORDER_STATUS_TOOL = {
  type: "function",
  function: {
    name: "update_order_status",
    description: "Update the status of an existing order. Use when customer wants to cancel or change order status.",
    parameters: {
      type: "object",
      properties: {
        order_display_id: { type: "number", description: "The 4-digit order number" },
        new_status: { type: "string", enum: ["pending", "processing", "completed", "cancelled"], description: "New status" },
      },
      required: ["order_display_id", "new_status"],
      additionalProperties: false
    }
  }
};

const UPDATE_ORDER_DETAILS_TOOL = {
  type: "function",
  function: {
    name: "update_order_details",
    description: "Update details of an existing order (customer name, address, or items). Only works for pending orders. Use this whenever the customer corrects or gives their name after an order was placed.",
    parameters: {
      type: "object",
      properties: {
        order_display_id: { type: "number", description: "The 4-digit order number" },
        customer_name: { type: "string", description: "Corrected full name for the order (optional)" },
        customer_address: { type: "string", description: "New delivery address (optional)" },
        items: {

          type: "array",
          description: "New list of items (replaces existing, optional)",
          items: {
            type: "object",
            properties: {
              product_name: { type: "string" },
              quantity: { type: "number" }
            },
            required: ["product_name", "quantity"]
          }
        }
      },
      required: ["order_display_id"],
      additionalProperties: false
    }
  }
};

const GET_ORDER_INFO_TOOL = {
  type: "function",
  function: {
    name: "get_order_info",
    description: "Look up detailed info about an order. Provide order_display_id if the customer gives an order number, OR provide customer_phone to find their most recent orders. Always checks Shopify for the latest fulfillment/tracking info.",
    parameters: {
      type: "object",
      properties: {
        order_display_id: { type: "number", description: "The order number (e.g. 1676). Use this when the customer provides an order number." },
        customer_phone: { type: "string", description: "Customer phone number to search orders by. Use when customer asks about 'my order' without providing a number." },
      },
      additionalProperties: false
    }
  }
};

const SEND_IMAGE_TOOL = {
  type: "function",
  function: {
    name: "send_image",
    description: "Send a product or reference image to the customer.",
    parameters: {
      type: "object",
      properties: {
        image_label: { type: "string", description: "Label of the image to send (must match exactly)" },
        color: { type: "string", description: "Color the customer chose, when the product comes in multiple colors (from COLOR OPTIONS). Omit if the product has one color." },
        caption: { type: "string", description: "Optional caption" }

      },
      required: ["image_label"],
      additionalProperties: false
    }
  }
};

type KnowledgeImage = { image_url: string; description: string };

function isUnsupportedWhatsAppImageUrl(imageUrl: string): boolean {
  try {
    return /\.(webp|avif|svg|gif|bmp|tiff?)$/i.test(new URL(imageUrl).pathname);
  } catch {
    return /\.(webp|avif|svg|gif|bmp|tiff?)(\?|$)/i.test(imageUrl);
  }
}

function getSendableImages(group: KnowledgeImage[] = []): KnowledgeImage[] {
  return group.filter((img) => !isUnsupportedWhatsAppImageUrl(img.image_url));
}

function findBestImageLabel(
  imageGroups: Record<string, KnowledgeImage[]>,
  requestedLabel: string | undefined,
): string | undefined {
  const requested = String(requestedLabel || '').toLowerCase().trim();
  const labels = Object.keys(imageGroups);
  if (!requested) return undefined; // never guess without a label

  // Token-aware match: label shares a meaningful word (>=3 chars) with the request,
  // or one string contains the other. Prevents random-image fallback like sending
  // "Minecraft Torch Light" when the customer asked about flood lights.
  const reqTokens = requested.split(/[^a-z0-9\u0600-\u06ff]+/i).filter((t) => t.length >= 3);
  const candidates = labels.filter((label) => {
    const lower = label.toLowerCase();
    if (lower === requested) return true;
    if (lower.includes(requested) || requested.includes(lower)) return true;
    const labelTokens = lower.split(/[^a-z0-9\u0600-\u06ff]+/i).filter((t) => t.length >= 3);
    return reqTokens.some((rt) => labelTokens.some((lt) => lt === rt || lt.includes(rt) || rt.includes(lt)));
  });

  if (candidates.length === 0) return undefined; // no confident match → let caller report "not found"

  return candidates.sort((a, b) => {
    const aSupported = getSendableImages(imageGroups[a]).length > 0 ? 1 : 0;
    const bSupported = getSendableImages(imageGroups[b]).length > 0 ? 1 : 0;
    if (aSupported !== bSupported) return bSupported - aSupported;
    const aExact = a.toLowerCase() === requested ? 1 : 0;
    const bExact = b.toLowerCase() === requested ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return b.length - a.length;
  })[0];
}


const TRANSFER_TO_HUMAN_TOOL = {
  type: "function",
  function: {
    name: "transfer_to_human",
    description: "Transfer the conversation to a human agent. Use when the customer explicitly asks to speak to a human, a real person, or a manager.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Brief reason the customer wants a human" }
      },
      required: ["reason"],
      additionalProperties: false
    }
  }
};

const TAG_CONTACT_TOOL = {
  type: "function",
  function: {
    name: "tag_contact",
    description: "Add or remove CRM tags on this contact based on what you learn about them from the conversation. Use to capture interests, preferences, segments, language, location, lead quality, repeat customer, VIP, complaint, etc. Tags must be short (1-3 words), lowercase, kebab-case (e.g. 'interested-lamps', 'wholesale', 'french-speaking', 'vip', 'complaint'). Call this silently — do NOT mention tagging to the customer.",
    parameters: {
      type: "object",
      properties: {
        add: { type: "array", items: { type: "string" }, description: "Tags to add" },
        remove: { type: "array", items: { type: "string" }, description: "Tags to remove (e.g. if previous tag was wrong)" }
      },
      additionalProperties: false
    }
  }
};


async function embedQuery(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  try {
    const r = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: text.slice(0, 4000) }),
    });
    if (!r.ok) {
      console.error('Embed query failed:', r.status, await r.text());
      return null;
    }
    const j = await r.json();
    return j.data?.[0]?.embedding || null;
  } catch (e) {
    console.error('Embed query exception:', e);
    return null;
  }
}


type ShopifyCreateResult = {
  success: boolean;
  shopifyOrderId?: string;
  orderNumber?: number;
  error?: string;
  // Classification for persistence + retry decisions.
  // - no_credentials: tenant has no Shopify connection → skip retries
  // - unmatched: no local items matched Shopify products → retry later (catalog may change)
  // - failed: transient / API error → retry
  // - success: created on Shopify
  kind: 'success' | 'no_credentials' | 'unmatched' | 'failed';
};

async function createShopifyOrder(supabase: any, tenantId: string, orderDetails: {
  customer_name: string;
  customer_address: string;
  customer_phone: string;
  items: Array<{ product_name: string; quantity: number }>;
}): Promise<ShopifyCreateResult> {
  try {
    const { data: cred } = await supabase
      .from('tenant_credentials')
      .select('access_token, shop_domain')
      .eq('tenant_id', tenantId)
      .eq('provider', 'shopify')
      .eq('is_active', true)
      .maybeSingle();

    if (!cred?.access_token || !cred?.shop_domain) {
      console.log('No Shopify credentials found, skipping Shopify order');
      return { success: false, kind: 'no_credentials', error: 'No Shopify credentials' };
    }

    // Match order items to Shopify variants (honor variant title like "- White" / "- Black")
    const lineItems: Array<{ variant_id: number; quantity: number }> = [];
    const unmatchedItems: string[] = [];

    for (const item of orderDetails.items) {
      const raw = stripQtyPrefix(item.product_name);
      let matched = false;

      // Search the live catalog for this item instead of paging every product —
      // large stores hold far more products than a single fetch can cover.
      const best = await matchProduct(cred.shop_domain, cred.access_token, raw);

      if (best) {
        const variants = best.product.variants || [];
        const baseTitle = String(best.product.title || '').toLowerCase();
        const requestedVariantText = raw.replace(baseTitle, '').replace(/[()]/g, ' ').trim();
        // Try to find a variant whose title/option appears in the requested name
        let variant = variants.find((v: any) => {
          const vt = String(v.title || '').toLowerCase();
          if (!vt || vt === 'default title') return false;
          if (raw.includes(vt)) return true;
          const toks = vt.split(/[\s/\-]+/).filter(Boolean);
          return toks.length > 0 && toks.every((tok: string) => raw.includes(tok));
        });
        // Falling back is safe only when no size/color was requested. If a
        // requested variant cannot be matched, leave the item unsynced rather
        // than silently ordering the first available size or color.
        if (!variant && !requestedVariantText) {
          variant =
            variants.find((v: any) => (v.inventory_quantity ?? 1) > 0) ||
            variants[0];
        }
        if (variant) {
          lineItems.push({ variant_id: variant.id, quantity: item.quantity });
          matched = true;
          console.log(
            `Matched "${item.product_name}" -> ${best.product.title} / ${variant.title} (stock: ${variant.inventory_quantity})`
          );
        }
      }

      if (!matched) {
        unmatchedItems.push(item.product_name);
      }
    }

    if (lineItems.length === 0) {
      console.log('No Shopify products matched, skipping Shopify order. Unmatched:', unmatchedItems);
      return { success: false, kind: 'unmatched', error: `No products matched: ${unmatchedItems.join(', ')}` };
    }

    // Parse customer name
    const nameParts = orderDetails.customer_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '.';

    // Format phone with + prefix if missing
    const formattedPhone = orderDetails.customer_phone.startsWith('+') 
      ? orderDetails.customer_phone 
      : `+${orderDetails.customer_phone}`;

    const addressObj = {
      first_name: firstName,
      last_name: lastName,
      address1: orderDetails.customer_address || 'N/A',
      city: 'N/A',
      country: 'LB',
      phone: formattedPhone,
    };

    // Look up existing Shopify customer by phone to avoid "phone has already been taken"
    let customerObj: any = { first_name: firstName, last_name: lastName, phone: formattedPhone };
    let foundExisting = false;
    try {
      const phoneVariants = Array.from(new Set([
        formattedPhone,
        formattedPhone.startsWith('+') ? formattedPhone.slice(1) : '+' + formattedPhone,
      ]));
      for (const p of phoneVariants) {
        const lookup = await fetch(
          `https://${cred.shop_domain}/admin/api/2026-01/customers/search.json?query=${encodeURIComponent('phone:' + p)}`,
          { headers: { 'X-Shopify-Access-Token': cred.access_token } },
        );
        const lookupData = await lookup.json();
        const existing = lookupData?.customers?.[0];
        if (existing?.id) {
          customerObj = { id: existing.id };
          foundExisting = true;
          console.log('Reusing existing Shopify customer:', existing.id, 'matched on', p);
          break;
        }
      }
    } catch (e) {
      console.log('Customer lookup failed, will create new:', e);
    }
    // If no match found, omit phone to avoid "phone has already been taken" collisions
    if (!foundExisting) {
      customerObj = { first_name: firstName, last_name: lastName };
      console.log('No existing Shopify customer found; creating without phone to avoid collision');
    }

    const shopifyOrder: any = {
      line_items: lineItems,
      customer: customerObj,
      shipping_address: addressObj,
      billing_address: addressObj,
      shipping_lines: [
        {
          title: 'Delivery Fee',
          price: '3.00',
          code: 'DELIVERY',
        },
      ],
      financial_status: 'pending',
      inventory_behaviour: 'bypass',
      send_receipt: false,
      send_fulfillment_receipt: false,
    };

    const orderRes = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/orders.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': cred.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: shopifyOrder }),
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok || orderData.errors) {
      console.error('Shopify order creation failed:', orderRes.status, JSON.stringify(orderData.errors || orderData));
      return {
        success: false,
        kind: 'failed',
        error: `HTTP ${orderRes.status}: ${JSON.stringify(orderData.errors || orderData).slice(0, 500)}`,
      };
    }

    const shopifyOrderNumber = orderData.order?.order_number;
    console.log('Shopify order created:', orderData.order?.id, 'name:', orderData.order?.name, 'order_number:', shopifyOrderNumber);
    return { success: true, kind: 'success', shopifyOrderId: String(orderData.order?.id), orderNumber: shopifyOrderNumber };
  } catch (err) {
    console.error('Exception creating Shopify order:', err);
    return { success: false, kind: 'failed', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Size availability helpers.
 *
 * Catalogs like shoesbullet store the SAME product many times (one row per
 * import run / per variant set) and encode the size range in the title
 * ("... FG 39-45", "... FG36-45", "39---45"). Some duplicate rows carry no
 * "Sizes:" line at all, so semantic retrieval can hand the model the empty
 * duplicate and it answers "I don't have that detail" even though the sizes
 * exist. Merge sizes across every row of the same base product so a size
 * question can always be answered.
 */
function extractSizes(title: string, content: string): string[] {
  const found = new Set<string>();
  const push = (raw: string) => {
    const v = raw.trim().replace(/\s*\(out of stock\)$/i, '');
    if (v && v.length <= 12) found.add(v);
  };

  const sizeLine = /(?:^|\n)\s*Sizes?\s*:\s*([^\n]+)/i.exec(content || '');
  if (sizeLine) sizeLine[1].split(/[,;|]/).forEach(push);

  const optLine = /(?:^|\n)\s*Options?\s*:\s*([^\n]+)/i.exec(content || '');
  if (optLine) {
    const seg = optLine[1].split('|').find((s) => /size|مقاس|قياس/i.test(s));
    if (seg) seg.replace(/^[^:]*:/, '').split(/[,;]/).forEach(push);
  }

  // Title-encoded ranges: "39-45", "36---45", "39 - 45", "FG36-45".
  const range = /(\d{2})\s*-{1,3}\s*(\d{2})\s*$/.exec(String(title || '').trim());
  if (range) {
    const from = parseInt(range[1], 10);
    const to = parseInt(range[2], 10);
    if (from >= 20 && to > from && to - from <= 20) {
      for (let n = from; n <= to; n++) push(String(n));
    }
  }

  return [...found].sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

/** Collapse cosmetic title differences so duplicate catalog rows group together. */
function baseProductKey(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/\d{2}\s*-{1,3}\s*\d{2}\s*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildSystemPrompt(
  supabase: any,
  tenantId: string | null,
  userMessage?: string,
): Promise<{ prompt: string; imageGroups: Record<string, Array<{ image_url: string; description: string }>> }> {
  // Semantic retrieval: top-15 most relevant knowledge entries for this message.
  let knowledgeEntries: Array<{ title: string; content: string; type?: string; isCatalog?: boolean }> = [];
  if (tenantId && userMessage) {
    const emb = await embedQuery(userMessage);
    if (emb) {
      const { data: matches, error: matchErr } = await supabase.rpc('match_knowledge', {
        p_tenant_id: tenantId,
        query_embedding: emb as any,
        match_count: 15,
      });
      if (matchErr) {
        console.error('match_knowledge error:', matchErr);
      } else if (matches && matches.length) {
        knowledgeEntries = matches.map((m: any) => ({ title: m.title, content: m.content }));
      }
    }

    // Exact-title boost for large catalogs. Semantic top-15 can miss an exact
    // product among thousands of near-identical variants. A price question such
    // as "ade lantern" often contains only one product word, so resolve catalog
    // titles from individual meaningful tokens instead of requiring a phrase.
    const titleStopwords = new Set([
      'fi', 'fih', 'hal', 'hyda', 'hayda', 'this', 'that', 'the', 'a', 'an',
      'is', 'are', 'do', 'does', 'have', 'available', 'stock', 'size', 'sizes',
      'please', 'pls', 'want', 'need', 'bade', 'badde', 'baddi', 'shu', 'what',
      'ade', 'adde', 'addeh', 'kam', 'price', 'se3er', 'se3r', 'cost', 'much',
    ]);
    const recentLines = userMessage.split('\n').map((line) => line.trim()).filter(Boolean).slice(-6).reverse();
    // Resolve EVERY recent line, not just the first hit: a customer asking about
    // two products in two messages must get both catalog entries, otherwise the
    // model reuses one product's price for the other.
    const boosted: Array<{ title: string; content: string; type?: string; isCatalog: true }> = [];
    const boostedTitles = new Set<string>();
    for (const line of recentLines.slice(0, 4)) {
      if (boosted.length >= 10) break;
      const words = line
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/[^\p{L}\p{N}.]+/gu, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 2 && !titleStopwords.has(word.toLowerCase()))
        .slice(0, 10);
      if (words.length < 1) continue;
      const safeWords = words.map((word) => word.replace(/[%_]/g, '')).filter(Boolean);
      if (!safeWords.length) continue;

      // Narrow AND search, most distinctive word first. An OR search over a
      // 10k+ product catalog is useless: a generic token like "nike" fills the
      // row limit with unrelated products and the model then reports the real
      // product ("vomero plus") as missing. So require ALL words to appear in
      // the title, then progressively drop the most generic (shortest) words
      // until something matches.
      const ordered = [...new Set(safeWords.map((w) => w.toLowerCase()))]
        .sort((a, b) => b.length - a.length)
        .slice(0, 5);
      let exactRows: any[] | null = null;
      for (let take = ordered.length; take >= 1 && !exactRows?.length; take--) {
        let q = supabase
          .from('ai_knowledge')
          .select('title, content, type')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .in('type', ['shopify_product', 'file_product', 'website_product', 'product']);
        for (const word of ordered.slice(0, take)) q = q.ilike('title', `%${word}%`);
        const { data } = await q.limit(25);
        exactRows = data || [];
      }
      if (!exactRows?.length) continue;
      const rankedRows = [...exactRows].sort((a: any, b: any) => {
        const aTitle = String(a.title || '').toLowerCase();
        const bTitle = String(b.title || '').toLowerCase();
        const aScore = ordered.filter((word) => aTitle.includes(word)).length;
        const bScore = ordered.filter((word) => bTitle.includes(word)).length;
        return bScore - aScore || aTitle.length - bTitle.length;
      }).slice(0, 5);
      for (const row of rankedRows) {
        if (boostedTitles.has(row.title)) continue;
        boostedTitles.add(row.title);
        boosted.push({ title: row.title, content: row.content, type: row.type, isCatalog: true });
      }
    }

    if (boosted.length) {
      knowledgeEntries = [
        ...boosted,
        ...knowledgeEntries.filter((entry) => !boostedTitles.has(entry.title)),
      ];
    }

  }

  // Fallback: include any non-shopify (manual/learned) rows so general info is always present.
  let fallbackQuery = supabase
    .from('ai_knowledge')
    .select('title, content')
    .eq('is_active', true)
    .not('type', 'in', '("shopify_product","file_product","website_product","product")')
    .order('created_at', { ascending: true });
  if (tenantId) fallbackQuery = fallbackQuery.eq('tenant_id', tenantId);
  const { data: manualEntries } = await fallbackQuery;
  const manualTitles = new Set<string>((manualEntries || []).map((e: any) => e.title));
  if (manualEntries && manualEntries.length) {
    const seen = new Set(knowledgeEntries.map((e) => e.title));
    for (const e of manualEntries) {
      if (!seen.has(e.title)) knowledgeEntries.push({ title: e.title, content: e.content, isCatalog: false });
    }
  }

  // Prices/stock may only come from live catalog rows (Shopify/file/website product
  // imports). Manual + learned notes go stale (old sale prices) and must never be
  // used as a price source, so they are labelled and pushed after the catalog.
  const isCatalogEntry = (e: { title: string; content: string; type?: string; isCatalog?: boolean }) =>
    e.isCatalog === true ||
    ['shopify_product', 'file_product', 'website_product', 'product'].includes(e.type || '') ||
    (e.isCatalog !== false && !manualTitles.has(e.title) && /^Product:\s/m.test(e.content || ''));
  knowledgeEntries = knowledgeEntries.map((e) => ({ ...e, isCatalog: isCatalogEntry(e) }));
  knowledgeEntries.sort((a, b) => Number(b.isCatalog) - Number(a.isCatalog));

  // Collapse duplicate catalog rows for the same title, keeping the richest one
  // (a row that actually lists sizes/variants beats an empty duplicate).
  {
    const best = new Map<string, typeof knowledgeEntries[number]>();
    const others: typeof knowledgeEntries = [];
    for (const e of knowledgeEntries) {
      if (!e.isCatalog) { others.push(e); continue; }
      const key = `${e.title}`.toLowerCase();
      const score = (x: typeof e) =>
        (/(^|\n)\s*Sizes?\s*:/i.test(x.content || '') ? 100 : 0) +
        (/(^|\n)\s*Variants?\s*:/i.test(x.content || '') ? 50 : 0) +
        Math.min((x.content || '').length / 100, 20);
      const prev = best.get(key);
      if (!prev || score(e) > score(prev)) best.set(key, e);
    }
    knowledgeEntries = [...best.values(), ...others];
  }

  // Build an authoritative size index for the retrieved catalog products,
  // merging sizes found across every stored row of the same base product.
  const sizeIndex: Array<{ title: string; sizes: string[] }> = [];
  if (tenantId) {
    const catalogTitles = knowledgeEntries.filter((e) => e.isCatalog).slice(0, 8).map((e) => e.title);
    const merged = new Map<string, { title: string; sizes: Set<string> }>();
    const addRow = (title: string, content: string) => {
      const sizes = extractSizes(title, content);
      if (!sizes.length) return;
      const key = baseProductKey(title);
      if (!merged.has(key)) merged.set(key, { title, sizes: new Set() });
      sizes.forEach((s) => merged.get(key)!.sizes.add(s));
    };
    for (const e of knowledgeEntries) if (e.isCatalog) addRow(e.title, e.content);
    if (catalogTitles.length) {
      const { data: dupRows } = await supabase
        .from('ai_knowledge')
        .select('title, content')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .in('title', catalogTitles)
        .limit(40);
      for (const r of dupRows || []) addRow(r.title, r.content);
    }
    for (const v of merged.values()) {
      sizeIndex.push({
        title: v.title,
        sizes: [...v.sizes].sort((a, b) => {
          const na = parseFloat(a), nb = parseFloat(b);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        }),
      });
    }
  }




  // Images: a large catalog can hold tens of thousands of photos, far beyond the
  // row cap of a single query. Fetching blindly returned only the oldest slice,
  // so the bot kept offering the same few products and claimed everything else
  // had no photo. Fetch photos for the products actually retrieved for THIS
  // message first, then top up with a general slice for manually added images.
  const imageGroups: Record<string, Array<{ image_url: string; description: string }>> = {};
  const addImageRows = (rows: any[] | null) => {
    for (const img of rows || []) {
      const key = img.label;
      if (!imageGroups[key]) imageGroups[key] = [];
      if (imageGroups[key].some((i) => i.image_url === img.image_url)) continue;
      imageGroups[key].push({ image_url: img.image_url, description: img.description });
    }
  };

  const retrievedTitles = [...new Set(knowledgeEntries.map((e) => e.title).filter(Boolean))].slice(0, 40);
  if (tenantId && retrievedTitles.length) {
    const { data: scopedImages, error: scopedErr } = await supabase
      .from('knowledge_images')
      .select('label, description, image_url')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('label', retrievedTitles)
      .order('created_at', { ascending: true })
      .limit(400);
    if (scopedErr) console.error('Error fetching scoped knowledge images:', scopedErr);
    addImageRows(scopedImages);
  }

  let imgQuery = supabase
    .from('knowledge_images')
    .select('label, description, image_url')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(600);
  if (tenantId) imgQuery = imgQuery.eq('tenant_id', tenantId);

  const { data: knowledgeImages, error: imgError } = await imgQuery;
  if (imgError) console.error('Error fetching knowledge images:', imgError);
  addImageRows(knowledgeImages);

  // Catalog-derived images: website/file/Shopify catalog rows carry their photo
  // inline as an "Image: <url>" line. Tenants that imported a catalog without
  // populating knowledge_images (e.g. website scrapes) otherwise have zero
  // sendable images and the bot appears unable to send product photos.
  for (const entry of knowledgeEntries) {
    if (!entry.isCatalog && !/^Product:\s/m.test(entry.content || '')) continue;
    const urls = [...String(entry.content || '').matchAll(/^\s*Images?\s*:\s*(https?:\/\/\S+)\s*$/gim)].map((m) => m[1]);
    if (!urls.length) continue;
    const titleMatch = String(entry.content || '').match(/^\s*Product\s*:\s*(.+)$/im);
    const label = (titleMatch?.[1] || entry.title || '').trim();
    if (!label) continue;
    if (!imageGroups[label]) imageGroups[label] = [];
    for (const url of urls) {
      if (imageGroups[label].some((i) => i.image_url === url)) continue;
      imageGroups[label].push({ image_url: url, description: label });
    }
  }

  // Colour index: catalog rows list variant options inline
  // ("Options: Color: Black, White | Size: 39, 40"). When a product comes in
  // several colours the bot must ask which colour before sending a photo.
  const colorIndex: Array<{ title: string; colors: string[] }> = [];
  for (const entry of knowledgeEntries) {
    if (!entry.isCatalog) continue;
    const optionLines = [...String(entry.content || '').matchAll(/^\s*Options?\s*:\s*(.+)$/gim)].map((m) => m[1]);
    const colors = new Set<string>();
    for (const line of optionLines) {
      for (const group of line.split('|')) {
        const m = group.match(/^\s*(colou?r\w*)\s*:\s*(.+)$/i);
        if (!m) continue;
        m[2]
          .split(',')
          .map((c) => c.trim())
          .filter((c) => c && c.length <= 30)
          .forEach((c) => colors.add(c));
      }
    }
    if (colors.size > 1) colorIndex.push({ title: entry.title, colors: [...colors] });
  }

  let prompt = BASE_SYSTEM_PROMPT;


  if (knowledgeEntries.length > 0) {
    const knowledgeSection = knowledgeEntries
      .map((entry) => {
        // Do not merely instruct the model to ignore stale prices: remove them
        // from non-catalog context so they cannot override live catalog values.
        const safeContent = entry.isCatalog
          ? entry.content
          : entry.content
              .replace(/\$\s*\d+(?:\.\d{1,2})?/g, '[old price removed]')
              .replace(/\b(?:USD|US\$)\s*\d+(?:\.\d{1,2})?/gi, '[old price removed]');
        return `## ${entry.title}${entry.isCatalog ? ' [LIVE CATALOG — authoritative price/stock]' : ' [GENERAL NOTES — NOT a price source]'}\n${safeContent}`;
      })
      .join('\n\n');
    prompt += `\n\nKnowledge base:\n\n${knowledgeSection}`;
    prompt += `\n\n## PRICE AUTHORITY (ABSOLUTE)\nPrices, sale prices and stock come ONLY from entries marked [LIVE CATALOG]. Entries marked [GENERAL NOTES] (website scrapes, manual notes, learned-from-conversation notes) contain OLD prices — never quote a number from them. If a price appears in both, the [LIVE CATALOG] number is correct. If the product has no [LIVE CATALOG] entry, state as a fact (never as a question, never asking permission) that the team will confirm the price, then call transfer_to_human — before doing that, re-check the catalog for a partial name match of the product the customer actually named. NEVER write the words '[old price removed]' or '[previous price removed]' in a reply — if you have no live catalog price, state that the team will confirm it. Never ask the customer for permission to check with the team.\nState the price ONCE, directly ("X is $9.99"). Never add "was/originally/kan aslan" or any old-price comparison unless the [LIVE CATALOG] entry itself lists a different higher compare-at price. When the customer asks about two or more products, give each product its own catalog price — never reuse one product's price for another.`;
    prompt += `\n\n## NEVER DENY A PRODUCT EXISTS (ABSOLUTE)\nThe knowledge base above is only a small slice of a much larger catalog, so a product missing from it does NOT mean the store doesn't sell it. NEVER say a product is not in the catalog, does not exist, or is unavailable ("ma fi ... bel catalog", "we don't have that", "not available") just because you can't see it here. Instead: if a similar name appears above, treat that as the product and confirm the exact model in one short line; otherwise say the team will confirm and call transfer_to_human. Only stock/size details explicitly present in a [LIVE CATALOG] entry may be used to say a specific size or variant is unavailable.`;
  }


  if (sizeIndex.length > 0) {
    const sizeLines = sizeIndex
      .slice(0, 12)
      .map((s) => `- ${s.title}: ${s.sizes.join(', ')}`)
      .join('\n');
    prompt += `\n\n## SIZE AVAILABILITY (LIVE CATALOG — authoritative)\n${sizeLines}\n\nRules for size questions:\n- When the customer asks whether a size exists ("fi 44?", "size 44?", "3ande 42?"), answer from this list for the product being discussed. If the size is listed, confirm it directly ("Eh fi 44"). If the product is listed but that size is not, say that size is not available and offer the sizes that are.\n- Never say you don't have size details for a product that appears in this list, and never ask the customer to wait for the team when the answer is here.\n- Only when the product being discussed is NOT in this list may you say the team will confirm the size, then call transfer_to_human.\n- If the customer names a size before naming a product, ask which product they mean — never guess a different product.`;
  }

  if (colorIndex.length > 0) {
    const colorLines = colorIndex
      .slice(0, 12)
      .map((c) => `- ${c.title}: ${c.colors.join(', ')}`)
      .join('\n');
    prompt += `\n\n## COLOR OPTIONS (LIVE CATALOG — authoritative)\n${colorLines}\n\nRules for photo requests on multi-color products:\n- If the customer asks for a photo of a product listed above, do NOT call send_image yet. Reply with ONE short sentence in the customer's language asking which color they want to see, and LIST every color from this index for that product (e.g. "Ayya lawn baddak tshuf? Black, White, Red" / "Which color? Black, White, Red").\n- Once the customer names a color, call send_image with that product's label and pass the color in the "color" argument.\n- If the product is NOT in this index, do not ask about color — send the photo directly.\n- Never invent a color that is not listed here.`;
  }



  const groupKeys = Object.keys(imageGroups);
  if (groupKeys.length > 0) {
    // Products relevant to this message come first, so a big catalog never
    // buries the item the customer just asked about.
    const relevant = new Set(retrievedTitles);
    const orderedKeys = [
      ...groupKeys.filter((k) => relevant.has(k)),
      ...groupKeys.filter((k) => !relevant.has(k)),
    ];
    const imageList = orderedKeys
      .slice(0, 30)
      .map((label) => `- "${label}": ${imageGroups[label][0].description} (${imageGroups[label].length} photo(s))`)
      .join('\n');
    prompt += `\n\n## Available Images\n${imageList}`;
  }


  // Fetch recent orders for context
  let ordersQuery = supabase
    .from('orders')
    .select('display_id, customer_name, customer_phone, product_name, quantity, status, customer_address')
    .order('created_at', { ascending: false })
    .limit(20);
  if (tenantId) ordersQuery = ordersQuery.eq('tenant_id', tenantId);

  const { data: recentOrders } = await ordersQuery;
  if (recentOrders && recentOrders.length > 0) {
    const ordersList = recentOrders.map((o: any) =>
      `#${o.display_id} | ${o.customer_name} | ${o.customer_phone} | ${o.product_name} (×${o.quantity}) | ${o.status} | ${o.customer_address}`
    ).join('\n');
    prompt += `\n\n## Recent Orders (for reference when customers ask about their orders)\n${ordersList}`;
  }

  console.log('Built prompt with', knowledgeEntries.length, 'knowledge entries,', groupKeys.length, 'image groups,', recentOrders?.length || 0, 'orders');
  return { prompt, imageGroups, knowledgeEntries };
}

async function createOrder(supabase: any, contactId: string, phoneNumber: string, tenantId: string, orderDetails: {
  customer_name: string;
  customer_address: string;
  items: Array<{ product_name: string; quantity: number }>;
}): Promise<{ success: boolean; orderId?: string; displayId?: number; error?: string; isDuplicate?: boolean }> {
  try {
    const productSummary = orderDetails.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ');
    const totalQuantity = orderDetails.items.reduce((sum, item) => sum + item.quantity, 0);

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, display_id, product_name, created_at')
      .eq('contact_id', contactId)
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (recentOrders && recentOrders.length > 0) {
      const normalizeProducts = (str: string) =>
        str.toLowerCase().replace(/\d+x\s*/g, '').split(',').map(s => s.trim()).sort().join(',');
      const targetNorm = normalizeProducts(productSummary);
      const existingOrder = recentOrders.find((order: any) => {
        const existingNorm = normalizeProducts(order.product_name);
        // exact match OR new order is subset of existing (same product mentioned again)
        return existingNorm === targetNorm
          || existingNorm.split(',').some((p: string) => targetNorm.split(',').includes(p));
      });
      if (existingOrder) {
        console.log('Duplicate order detected:', existingOrder.id);
        return { success: true, orderId: existingOrder.id, displayId: existingOrder.display_id, isDuplicate: true };
      }
    }

    // Create on Shopify FIRST to get the Shopify order number
    let shopifyOrderId: string | null = null;
    let shopifyOrderNumber: number | null = null;
    let shopifySyncStatus: string = 'pending';
    let shopifySyncError: string | null = null;

    if (tenantId) {
      const shopifyResult = await createShopifyOrder(supabase, tenantId, {
        customer_name: orderDetails.customer_name,
        customer_address: orderDetails.customer_address,
        customer_phone: phoneNumber,
        items: orderDetails.items,
      });
      if (shopifyResult.success && shopifyResult.shopifyOrderId) {
        shopifyOrderId = shopifyResult.shopifyOrderId;
        shopifyOrderNumber = shopifyResult.orderNumber || null;
        shopifySyncStatus = 'synced';
        console.log('Shopify order created first:', shopifyOrderId, 'order_number:', shopifyOrderNumber);
      } else {
        shopifySyncStatus = shopifyResult.kind || 'failed';
        shopifySyncError = shopifyResult.error || 'Unknown Shopify error';
        console.warn('Shopify order not created:', shopifySyncStatus, shopifySyncError);
      }
    } else {
      shopifySyncStatus = 'no_credentials';
    }

    // Price the order from the live catalog (warmed during prompt build) so
    // receipts and the orders board never show $0.00 for known items.
    let computedTotal: number | null = null;
    {
      const catalog = tenantId ? (CATALOG_CACHE.get(tenantId)?.items ?? []) : [];
      const normName = (s: string) => String(s || '').toLowerCase().replace(/\d+\s*[x×]\s*/g, '').replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').trim();
      let sum = 0;
      let allPriced = orderDetails.items.length > 0;
      for (const it of orderDetails.items) {
        const t = normName(it.product_name);
        const match = catalog.find((c) => {
          const ct = normName(c.title);
          return ct === t || (t.length > 2 && ct.includes(t)) || (ct.length > 2 && t.includes(ct));
        });
        if (match && match.price > 0) sum += match.price * (Number(it.quantity) || 1);
        else allPriced = false;
      }
      if (allPriced && sum > 0) computedTotal = Math.round(sum * 100) / 100;
    }

    // Now insert into local DB, using Shopify order number as display_id if available.
    // The local row is ALWAYS created — even on Shopify failure — so nothing is lost.
    const insertData: any = {
      contact_id: contactId,
      customer_name: orderDetails.customer_name,
      customer_address: orderDetails.customer_address,
      customer_phone: phoneNumber,
      product_name: productSummary,
      quantity: totalQuantity,
      status: 'pending',
      tenant_id: tenantId,
      shopify_order_id: shopifyOrderId,
      shopify_sync_status: shopifySyncStatus,
      shopify_sync_error: shopifySyncError,
      shopify_sync_attempts: tenantId ? 1 : 0,
      shopify_last_attempt_at: tenantId ? new Date().toISOString() : null,
      // Snapshot the items so the retry worker can rebuild the Shopify payload.
      line_items: orderDetails.items.map((it) => ({
        title: it.product_name,
        qty: it.quantity,
        source: 'ai',
      })),
    };

    if (shopifyOrderNumber) {
      insertData.display_id = shopifyOrderNumber;
    }
    if (computedTotal !== null) {
      insertData.total_price = computedTotal;
    }

    let { data: order, error } = await supabase
      .from('orders')
      .insert(insertData)
      .select()
      .single();

    // If display_id collision (Shopify number already used locally), retry without display_id
    // so the local sequence assigns a fresh one. The Shopify order is already created and
    // authoritative — we must NOT report failure or the AI will try to create it again.
    if (error && (error as any).code === '23505') {
      console.warn('display_id collision, retrying without display_id:', (error as any).details);
      const { display_id: _omit, ...retryData } = insertData;
      const retry = await supabase.from('orders').insert(retryData).select().single();
      order = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error creating order:', error);
      // If we already created the Shopify order, treat as success so the AI confirms it.
      if (shopifyOrderId) {
        return {
          success: true,
          orderId: shopifyOrderId,
          displayId: shopifyOrderNumber || undefined,
          message: 'Order placed on Shopify (local save failed but order is confirmed).',
        } as any;
      }
      return { success: false, error: error.message };
    }

    console.log('Order created:', order.id, 'display_id:', order.display_id);

    // Auto-save customer name to contact if it's still a placeholder (phone number or empty)
    try {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, phone_number')
        .eq('id', contactId)
        .maybeSingle();
      const currentName = (contact?.name || '').trim();
      const phone = contact?.phone_number || '';
      const isPlaceholder = !currentName || currentName === phone || currentName.replace(/\D/g, '') === phone.replace(/\D/g, '');
      const newName = orderDetails.customer_name?.trim();
      if (newName && isPlaceholder) {
        await supabase.from('contacts').update({ name: newName }).eq('id', contactId);
        console.log('Auto-saved contact name:', newName);
      }
    } catch (e) {
      console.error('Failed to auto-save contact name:', e);
    }

    return { success: true, orderId: order.id, displayId: order.display_id };
  } catch (err) {
    console.error('Exception creating order:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function cancelShopifyOrder(supabase: any, tenantId: string, shopifyOrderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: cred } = await supabase
      .from('tenant_credentials')
      .select('access_token, shop_domain')
      .eq('tenant_id', tenantId)
      .eq('provider', 'shopify')
      .eq('is_active', true)
      .maybeSingle();

    if (!cred?.access_token || !cred?.shop_domain) {
      return { success: false, error: 'No Shopify credentials' };
    }

    const res = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/orders/${shopifyOrderId}/cancel.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': cred.access_token,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok || data.errors) {
      console.error('Shopify cancel error:', JSON.stringify(data.errors || data));
      return { success: false, error: JSON.stringify(data.errors || 'Unknown error') };
    }

    console.log('Shopify order cancelled:', shopifyOrderId);
    return { success: true };
  } catch (err) {
    console.error('Exception cancelling Shopify order:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function updateOrderStatus(supabase: any, displayId: number, newStatus: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabase.from('orders').select('id, status, display_id, shopify_order_id').eq('display_id', displayId);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data: order, error: findError } = await query.maybeSingle();

    if (findError || !order) return { success: false, error: `Order #${displayId} not found` };

    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);
    if (error) return { success: false, error: error.message };

    // If cancelling and there's a linked Shopify order, cancel it too
    if (newStatus === 'cancelled' && order.shopify_order_id && tenantId) {
      const shopifyResult = await cancelShopifyOrder(supabase, tenantId, order.shopify_order_id);
      if (shopifyResult.success) {
        console.log(`Shopify order ${order.shopify_order_id} also cancelled`);
      } else {
        console.log(`Shopify cancel failed: ${shopifyResult.error}`);
      }
    }

    console.log(`Order #${displayId} status updated to ${newStatus}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

async function updateOrderDetails(supabase: any, displayId: number, tenantId: string, updates: {
  customer_name?: string;
  customer_address?: string;
  items?: Array<{ product_name: string; quantity: number }>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let query = supabase.from('orders').select('id, status, display_id, contact_id').eq('display_id', displayId);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { data: order, error: findError } = await query.maybeSingle();

    if (findError || !order) return { success: false, error: `Order #${displayId} not found` };
    if (order.status !== 'pending') return { success: false, error: `Order #${displayId} is ${order.status} and cannot be modified` };

    const updateData: any = {};
    const newName = updates.customer_name?.trim();
    if (newName) updateData.customer_name = newName.replace(/\s+/g, ' ').slice(0, 60);
    if (updates.customer_address) updateData.customer_address = updates.customer_address;
    if (updates.items && updates.items.length > 0) {
      updateData.product_name = updates.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');
      updateData.quantity = updates.items.reduce((sum, i) => sum + i.quantity, 0);
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'Nothing to update' };
    }

    const { error } = await supabase.from('orders').update(updateData).eq('id', order.id);
    if (error) return { success: false, error: error.message };

    // Keep the contact record in sync when the customer corrects their name.
    if (newName && order.contact_id) {
      const { error: cErr } = await supabase
        .from('contacts')
        .update({ name: updateData.customer_name })
        .eq('id', order.contact_id);
      if (cErr) console.error('Failed to sync contact name:', cErr);
    }

    console.log(`Order #${displayId} details updated`, Object.keys(updateData));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}


async function getOrderInfo(supabase: any, displayId: number | undefined, tenantId: string, customerPhone?: string): Promise<{ success: boolean; info?: string; error?: string }> {
  try {
    // Helper to fetch Shopify creds
    const getShopifyCreds = async () => {
      if (!tenantId) return null;
      const { data: cred } = await supabase
        .from('tenant_credentials')
        .select('access_token, shop_domain')
        .eq('tenant_id', tenantId)
        .eq('provider', 'shopify')
        .eq('is_active', true)
        .maybeSingle();
      return (cred?.access_token && cred?.shop_domain) ? cred : null;
    };

    // Helper to enrich order with Shopify details
    const enrichWithShopify = async (order: any) => {
      let info = `Order #${order.display_id}\nCustomer: ${order.customer_name}\nPhone: ${order.customer_phone}\nAddress: ${order.customer_address}\nItems: ${order.product_name} (×${order.quantity})\nStatus: ${order.status}\nDelivery Fee: $${parseFloat(order.delivery_fee || 3).toFixed(2)}\nCreated: ${order.created_at}`;

      if (order.shopify_order_id && tenantId) {
        try {
          const cred = await getShopifyCreds();
          if (cred) {
            const res = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/orders/${order.shopify_order_id}.json?fields=name,financial_status,fulfillment_status,fulfillments,total_price,created_at,cancelled_at`, {
              headers: { 'X-Shopify-Access-Token': cred.access_token, 'Content-Type': 'application/json' },
            });
            if (res.ok) {
              const so = (await res.json()).order;
              if (so) {
                info += `\n\n--- Shopify Details ---\nShopify Order: ${so.name}\nPayment: ${so.financial_status}\nFulfillment: ${so.fulfillment_status || 'unfulfilled'}\nTotal: $${so.total_price}`;
                for (const f of (so.fulfillments || [])) {
                  info += `\nShipment: ${f.status}`;
                  if (f.tracking_number) info += ` | Tracking: ${f.tracking_number}`;
                  if (f.tracking_url) info += ` | URL: ${f.tracking_url}`;
                  if (f.tracking_company) info += ` (${f.tracking_company})`;
                }
                if (so.cancelled_at) info += `\nCancelled: ${so.cancelled_at}`;
              }
            } else { await res.text(); }
          }
        } catch (e) { console.error('Shopify detail fetch error:', e); }
      }
      return info;
    };

    // CASE 1: Lookup by display_id
    if (displayId) {
      let query = supabase.from('orders').select('*').eq('display_id', displayId);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data: order } = await query.maybeSingle();

      if (order) {
        const info = await enrichWithShopify(order);
        return { success: true, info };
      }

      // Not found locally — try Shopify by order name (try with and without #)
      const cred = await getShopifyCreds();
      if (cred) {
        try {
          const nameVariants = [`%23${displayId}`, `${displayId}`];
          let so: any = null;
          for (const nv of nameVariants) {
            const res = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/orders.json?name=${nv}&status=any&limit=5`, {
              headers: { 'X-Shopify-Access-Token': cred.access_token, 'Content-Type': 'application/json' },
            });
            if (res.ok) {
              const data = await res.json();
              // Match exact order_number too (handles store prefixes like "JAW1234")
              // ONLY accept exact matches — never a fuzzy "first result" fallback,
              // otherwise a wrong order number silently resolves to somebody else's order.
              so = (data.orders || []).find((o: any) => String(o.order_number) === String(displayId) || o.name === `#${displayId}` || o.name === String(displayId)) || null;
              if (so) break;
            } else { await res.text(); }
          }
          if (so) {
            let info = `Shopify Order ${so.name}\nCustomer: ${so.customer?.first_name || ''} ${so.customer?.last_name || ''}\nPayment: ${so.financial_status}\nFulfillment: ${so.fulfillment_status || 'unfulfilled'}\nTotal: $${so.total_price}\nCreated: ${so.created_at}`;
            const items = (so.line_items || []).map((li: any) => `${li.quantity}x ${li.title}`).join(', ');
            if (items) info += `\nItems: ${items}`;
            if (so.shipping_address) info += `\nAddress: ${so.shipping_address.address1 || ''}, ${so.shipping_address.city || ''}`;
            for (const f of (so.fulfillments || [])) {
              info += `\nShipment: ${f.status}`;
              if (f.tracking_number) info += ` | Tracking: ${f.tracking_number}`;
              if (f.tracking_url) info += ` | URL: ${f.tracking_url}`;
              if (f.tracking_company) info += ` (${f.tracking_company})`;
            }
            if (so.cancelled_at) info += `\nCancelled: ${so.cancelled_at}`;
            return { success: true, info };
          }
        } catch (e) { console.error('Shopify order search error:', e); }
      }

      return { success: false, error: `Order #${displayId} not found in our system or Shopify` };
    }

    // CASE 2: Lookup by phone number (find recent orders for this customer)
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      
      // Search local DB first
      let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      // Match phone with or without country code
      query = query.or(`customer_phone.eq.${cleanPhone},customer_phone.ilike.%${cleanPhone.slice(-8)}%`);
      const { data: localOrders } = await query;

      if (localOrders && localOrders.length > 0) {
        const infos = await Promise.all(localOrders.map(enrichWithShopify));
        return { success: true, info: `Found ${localOrders.length} order(s) for this customer:\n\n${infos.join('\n\n---\n\n')}` };
      }

      // Try Shopify search by phone
      const cred = await getShopifyCreds();
      if (cred) {
        try {
          const tail = cleanPhone.slice(-8);
          // 1. Find customer by phone via Shopify search
          const phoneVariants = [
            cleanPhone,
            `+${cleanPhone}`,
            cleanPhone.startsWith('961') ? `+${cleanPhone}` : `+961${cleanPhone.replace(/^0/, '')}`,
          ];
          let customerId: string | null = null;
          for (const pv of phoneVariants) {
            const cRes = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/customers/search.json?query=${encodeURIComponent('phone:' + pv)}&limit=5`, {
              headers: { 'X-Shopify-Access-Token': cred.access_token, 'Content-Type': 'application/json' },
            });
            if (cRes.ok) {
              const cData = await cRes.json();
              const cust = (cData.customers || [])[0];
              if (cust?.id) { customerId = String(cust.id); break; }
            } else { await cRes.text(); }
          }

          let matching: any[] = [];
          if (customerId) {
            // 2. Fetch all orders for that customer
            const oRes = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/orders.json?customer_id=${customerId}&status=any&limit=10`, {
              headers: { 'X-Shopify-Access-Token': cred.access_token, 'Content-Type': 'application/json' },
            });
            if (oRes.ok) {
              const oData = await oRes.json();
              matching = oData.orders || [];
            } else { await oRes.text(); }
          }

          // 3. Fallback: scan recent 50 orders and filter by phone tail
          if (matching.length === 0) {
            const res = await fetch(`https://${cred.shop_domain}/admin/api/2026-01/orders.json?status=any&limit=50`, {
              headers: { 'X-Shopify-Access-Token': cred.access_token, 'Content-Type': 'application/json' },
            });
            if (res.ok) {
              const data = await res.json();
              matching = (data.orders || []).filter((o: any) => {
                const orderPhone = (o.customer?.phone || o.shipping_address?.phone || o.billing_address?.phone || '').replace(/\D/g, '');
                return orderPhone && (orderPhone.endsWith(tail) || tail.endsWith(orderPhone.slice(-8)));
              });
            } else { await res.text(); }
          }

          if (matching.length > 0) {
            const infos = matching.slice(0, 5).map((so: any) => {
              let info = `Shopify Order ${so.name}\nCustomer: ${so.customer?.first_name || ''} ${so.customer?.last_name || ''}\nPayment: ${so.financial_status}\nFulfillment: ${so.fulfillment_status || 'unfulfilled'}\nTotal: $${so.total_price}\nCreated: ${so.created_at}`;
              const items = (so.line_items || []).map((li: any) => `${li.quantity}x ${li.title}`).join(', ');
              if (items) info += `\nItems: ${items}`;
              for (const f of (so.fulfillments || [])) {
                info += `\nShipment: ${f.status}`;
                if (f.tracking_number) info += ` | Tracking: ${f.tracking_number}`;
                if (f.tracking_url) info += ` | URL: ${f.tracking_url}`;
              }
              return info;
            });
            return { success: true, info: `Found ${matching.length} Shopify order(s):\n\n${infos.join('\n\n---\n\n')}` };
          }
        } catch (e) { console.error('Shopify phone search error:', e); }
      }

      return { success: false, error: `No orders found for phone ${customerPhone}` };
    }

    return { success: false, error: 'Please provide an order number or phone number to look up' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ===== Outbound price sanitizer =====
// Prices are stripped out of stale (non-catalog) context with a placeholder so
// the model can't quote them. The model sometimes copies that placeholder into
// its reply. Never send a placeholder to a customer: swap it for the live
// catalog price when we can resolve the product, otherwise drop the clause.
const PRICE_PLACEHOLDER = '\\[(?:old|previous) price removed\\]';
const hasPricePlaceholder = (s: string) => new RegExp(PRICE_PLACEHOLDER, 'i').test(s);
const stripPricePlaceholder = (s: string, to: string) => s.replace(new RegExp(PRICE_PLACEHOLDER, 'gi'), to);

export function buildCatalogPriceMap(
  entries: Array<{ title: string; content: string; isCatalog?: boolean }>,
): Array<{ title: string; price: string }> {
  const out: Array<{ title: string; price: string }> = [];
  const push = (title: string, raw: string) => {
    const clean = title.replace(/^(?:product|item|name)\s*:\s*/i, '').trim();
    if (!clean || /^(?:price|sale price|compare|variants?|brand|handle|description|stock)$/i.test(clean)) return;
    out.push({ title: clean, price: `$${Number(raw).toFixed(2)}` });
  };
  for (const e of entries || []) {
    if (!e.isCatalog) continue;
    const content = String(e.content || '');
    // Catalog entries are shaped "Product: <name>\n...\nPrice: $X".
    const nameMatch = content.match(/^\s*Product\s*:\s*(.+)$/im);
    const priceMatch = content.match(/^\s*(?:Sale\s+)?Price\s*:\s*\$?\s*(\d+(?:\.\d{1,2})?)/im);
    const entryName = (nameMatch?.[1] || e.title || '').trim();
    if (entryName && priceMatch) push(entryName, priceMatch[1]);

    // Also accept flat "Name — $X" / "Name: $X" list lines.
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*[-*]?\s*(.+?)\s*[:—-]\s*\$\s*(\d+(?:\.\d{1,2})?)/);
      if (m) push(m[1], m[2]);
    }
  }
  // Longest titles first so "Flat Book Light" wins over "Book Light".
  return out.sort((a, b) => b.title.length - a.title.length);
}


// Clauses that only restate an old/original price ("was $X", "kan aslan $X").
// If we can't prove a real discount, they add nothing — drop them.
const OLD_PRICE_CLAUSE = /\b(?:w\s+)?(?:kan(?:\s+aslan)?|aslan|was|originally|before|previously|down\s+from|reduced\s+from)\b/i;

function priceForSegment(
  segment: string,
  catalog: Array<{ title: string; price: string }>,
  lastSeen: { title: string; price: string } | null,
): { title: string; price: string } | null {
  const lower = segment.toLowerCase();
  let best: { title: string; price: string } | null = null;
  let bestIdx = -1;
  for (const c of catalog || []) {
    if (!c.title) continue;
    const idx = lower.indexOf(c.title.toLowerCase());
    if (idx >= 0 && (bestIdx === -1 || c.title.length > (best?.title.length || 0))) {
      best = c;
      bestIdx = idx;
    }
  }
  return best || lastSeen;
}

const PRICE_NUMBER = /\$\s*\d+(?:[.,]\d{1,2})?|\b(?:USD|US\$)\s*\d+(?:[.,]\d{1,2})?/gi;

export function sanitizeOutgoingPrices(
  reply: string,
  catalog: Array<{ title: string; price: string }>,
  fallback = "Let me check the current price with the team and get back to you.",
): string {
  if (!reply) return reply;
  const hasNumber = PRICE_NUMBER.test(reply);
  PRICE_NUMBER.lastIndex = 0;
  if (!hasPricePlaceholder(reply) && !hasNumber) return reply;

  // Split into clauses so a multi-product reply resolves each product's own price.
  const parts = reply.split(/(?<=[.!?؟])\s+|\n+|,\s*|\s+(?=\bw\s)|\s+(?=\band\b)/i);
  let lastSeen: { title: string; price: string } | null = null;
  const kept: string[] = [];

  for (const part of parts) {
    if (!part.trim()) continue;
    const named = priceForSegment(part, catalog, null);
    const resolved = named || lastSeen;
    if (named) lastSeen = named;

    if (!hasPricePlaceholder(part)) {
      // Correct wrong numbers: a clause that names a catalog product must quote
      // that product's live price, never a price carried over from another item.
      const fixed = named
        ? part.replace(PRICE_NUMBER, named.price)
        : part;
      kept.push(fixed.trim());
      continue;
    }
    // Old-price restatement: never re-quote the same number as a fake discount.
    if (OLD_PRICE_CLAUSE.test(part)) continue;
    if (resolved) kept.push(stripPricePlaceholder(part, resolved.price).trim());
  }

  const out = kept.join(' ').replace(/\s+([,.!?])/g, '$1').replace(/,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  return out || fallback;
}




async function sendWhatsAppMessage(phoneNumberId: string, accessToken: string, to: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message }
        })
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return false;
    }
    console.log('WhatsApp message sent:', result.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

async function sendWhatsAppImage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string): Promise<boolean> {
  try {
    const body: any = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl },
    };
    if (caption) body.image.caption = caption;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp image API error:', result);
      return false;
    }
    console.log('WhatsApp image sent:', result.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp image:', error);
    return false;
  }
}

async function downloadMediaWithToken(mediaId: string, accessToken: string): Promise<{ base64: string; mimeType: string } | null> {
  const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!mediaInfoRes.ok) {
    const body = await mediaInfoRes.text().catch(() => '');
    console.error(`Failed to get media info (${mediaInfoRes.status}):`, body.slice(0, 500));
    return null;
  }
  const mediaInfo = await mediaInfoRes.json();
  const mediaUrl = mediaInfo.url;
  const mimeType = mediaInfo.mime_type || 'audio/ogg';
  if (!mediaUrl) {
    console.error('Media info had no url:', JSON.stringify(mediaInfo).slice(0, 300));
    return null;
  }

  const mediaRes = await fetch(mediaUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'curl/8.4.0' }
  });
  if (!mediaRes.ok) {
    const body = await mediaRes.text().catch(() => '');
    console.error(`Failed to download media (${mediaRes.status}):`, body.slice(0, 500));
    return null;
  }
  const arrayBuffer = await mediaRes.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  if (uint8Array.length === 0) {
    console.error('Downloaded media was empty');
    return null;
  }

  // Chunked base64 encoding — a per-byte string concat blows up on long voice notes.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < uint8Array.length; i += CHUNK) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK));
  }
  console.log(`📥 Media downloaded: ${mimeType}, ${uint8Array.length} bytes`);
  return { base64: btoa(binary), mimeType };
}

async function downloadWhatsAppMedia(mediaId: string, accessToken: string): Promise<{ base64: string; mimeType: string } | null> {
  const envToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || null;
  const tokens = [accessToken, envToken].filter((t, i, arr): t is string => !!t && arr.indexOf(t) === i);
  for (const token of tokens) {
    try {
      const media = await downloadMediaWithToken(mediaId, token);
      if (media) return media;
    } catch (error) {
      console.error('Error downloading WhatsApp media:', error);
    }
  }
  console.error(`Media ${mediaId} could not be downloaded with ${tokens.length} token(s)`);
  return null;
}


const TRANSCRIBE_PROMPT =
  'Transcribe this audio message exactly as spoken. The audio may be in English, Arabic, or a mix of both. Output ONLY the transcription text, nothing else. If the audio is unclear or empty, respond with "[Voice message - unclear audio]".';

// Maps a WhatsApp audio mime type to the container name the model expects.
function audioFormatFromMime(mimeType: string): string {
  const base = (mimeType || '').split(';')[0].toLowerCase();
  const map: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/opus': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'audio/flac': 'flac',
  };
  return map[base] || 'ogg';
}

async function callTranscription(apiKey: string, content: unknown[]): Promise<string | null> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3.6-flash',
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('Transcription API error:', response.status, body.slice(0, 800));
    return null;
  }

  const data = await response.json();
  const transcription = data.choices?.[0]?.message?.content?.trim();
  console.log('Transcription result:', transcription);
  return transcription || null;
}

async function transcribeAudio(base64Audio: string, mimeType: string, apiKey: string): Promise<string | null> {
  try {
    const format = audioFormatFromMime(mimeType);

    // Correct multimodal shape for audio: input_audio (NOT image_url, which the
    // provider rejects with a 400 for audio payloads).
    const primary = await callTranscription(apiKey, [
      { type: 'text', text: TRANSCRIBE_PROMPT },
      { type: 'input_audio', input_audio: { data: base64Audio, format } },
    ]);
    if (primary) return primary;

    // Fallback: some providers accept a data URL block instead.
    console.log('🎤 Retrying transcription with data-URL block...');
    return await callTranscription(apiKey, [
      { type: 'text', text: TRANSCRIBE_PROMPT },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Audio}` } },
    ]);
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return null;
  }
}

const IMAGE_ANALYSIS_PROMPT = `You are a product-identification assistant for a business receiving a customer photo on WhatsApp.
Answer in EXACTLY these lines, nothing else, no markdown:
KIND: one of product_photo | screenshot_of_product_page | receipt_or_payment_proof | order_screenshot | damaged_item | address_or_location | person_or_selfie | other
ITEM: the single main object shown, named as specifically as possible (e.g. "hexagonal LED honeycomb wall light", "clip-on rechargeable book reading lamp"). Write "none" if no object.
ATTRIBUTES: up to 8 comma-separated visual facts about the main object — colour(s), material, shape, size cues, packaging, on/off state, mounting type, distinctive parts.
TEXT: every piece of text visible in the image, transcribed exactly and separated by " | " (brand names, product titles, prices, order numbers, amounts, addresses). Keep Arabic text in Arabic. Write "none" if no text.
SUMMARY: one factual sentence (max 30 words) describing the image.
Rules: describe ONLY what is visible. Never invent brands, prices, product names, or text that is not in the image. If the photo is blurry or cropped, still describe what is visible and say "unclear" in ATTRIBUTES.`;

// Second pass: the model picks which of OUR catalog products the photo shows.
function buildImageMatchPrompt(titles: string[], analysis: string): string {
  return `A customer sent this photo. Identify which product from OUR catalog it shows.

CATALOG (choose one EXACT title, or NONE):
${titles.map((t) => `- ${t}`).join('\n')}

Vision notes about the photo:
${analysis}

Rules:
- Compare shape, colour, function and any visible text/brand to the catalog titles.
- Reply with ONLY the exact catalog title, character for character.
- If the photo is not one of these products, or you are not clearly confident, reply exactly: NONE
- Never invent a title that is not in the list.`;
}

// Narrow a big catalog down to plausible candidates using the vision text,
// so the match pass stays small and accurate for stores with thousands of rows.
function shortlistCatalogTitles(analysis: string, titles: string[], limit = 40): string[] {
  const STOP = new Set(['the', 'and', 'with', 'for', 'a', 'an', 'of', 'in', 'on', 'none', 'unclear', 'kind', 'item', 'text', 'summary', 'attributes', 'product', 'photo', 'image', 'colour', 'color', 'white', 'black', 'shows']);
  const words = new Set(
    analysis.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
  if (words.size === 0) return titles.slice(0, limit);
  const scored = titles.map((t) => {
    const tw = t.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    let score = 0;
    for (const w of tw) if (words.has(w)) score += 1;
    // whole-title mention in the transcribed text is the strongest signal
    if (analysis.toLowerCase().includes(t.toLowerCase())) score += 10;
    return { t, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return titles.slice(0, limit);
  return scored.slice(0, limit).map((s) => s.t);
}

async function matchImageToCatalog(
  base64Image: string,
  mimeType: string,
  apiKey: string,
  analysis: string,
  titles: string[],
): Promise<string | null> {
  if (!titles.length) return null;
  const shortlist = shortlistCatalogTitles(analysis, titles);
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildImageMatchPrompt(shortlist, analysis) },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        }],
      }),
    });
    if (!response.ok) {
      console.error('🖼️ Image match API error:', response.status, (await response.text().catch(() => '')).slice(0, 300));
      return null;
    }
    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim().replace(/^["'\-\s]+|["'\s]+$/g, '');
    if (!raw || /^none$/i.test(raw)) return null;
    // Only accept an answer that is really one of our titles.
    const exact = titles.find((t) => t.toLowerCase() === raw.toLowerCase())
      || titles.find((t) => raw.toLowerCase().includes(t.toLowerCase()));
    console.log('🖼️ Image catalog match:', raw, '=>', exact || 'rejected');
    return exact || null;
  } catch (e) {
    console.error('🖼️ Image match failed:', e);
    return null;
  }
}


// Reads a customer-sent image so its content survives in the conversation history
// (Meta media ids expire, and later turns only have the stored text).
async function analyzeImage(base64Image: string, mimeType: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: IMAGE_ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        }],
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('🖼️ Image analysis API error:', response.status, body.slice(0, 500));
      return null;
    }
    const data = await response.json();
    const desc = data.choices?.[0]?.message?.content?.trim();
    console.log('🖼️ Image analysis:', desc?.slice(0, 200));
    return desc || null;
  } catch (e) {
    console.error('🖼️ Image analysis failed:', e);
    return null;
  }
}




async function sendWhatsAppTemplate(phoneNumberId: string, accessToken: string, to: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' }
          }
        })
      }
    );

    const result = await response.json();
    if (!response.ok) {
      console.error('WhatsApp template API error:', result);
      return false;
    }
    console.log('WhatsApp escalation template sent:', result.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('Error sending template message:', error);
    return false;
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    if (mode === 'subscribe' && token) {
      const { data: cred } = await sb
        .from('tenant_credentials')
        .select('verify_token')
        .eq('verify_token', token)
        .eq('provider', 'whatsapp_cloud')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const envVerifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
      if (cred || token === envVerifyToken) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { status: 200 });
      }
    }
    return new Response('Forbidden', { status: 403 });
  }

  // Handle incoming messages (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Received webhook:', JSON.stringify(body, null, 2));

      if (body.object !== 'whatsapp_business_account') {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;
      const statuses = value?.statuses;
      const webhookPhoneNumberId = value?.metadata?.phone_number_id;

      // Handle delivery/read/failed status callbacks for campaign messages
      if (statuses && statuses.length > 0) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          const sb = createClient(supabaseUrl, supabaseKey);
          for (const st of statuses) {
            const wamid = st.id;
            const statusName = st.status;
            const ts = st.timestamp ? new Date(parseInt(st.timestamp) * 1000).toISOString() : new Date().toISOString();

            // Mirror delivery state onto the inbox message so the UI never shows
            // "sent" for a message Meta actually rejected (e.g. 131047 outside 24h window).
            try {
              const errText = st.errors?.[0]
                ? `${st.errors[0].title || st.errors[0].message || 'Delivery failed'}${st.errors[0].error_data?.details ? ` — ${st.errors[0].error_data.details}` : ''}`
                : null;
              if (statusName === 'failed') {
                await sb.from('messages')
                  .update({ status: 'failed', error_message: errText })
                  .eq('twilio_sid', wamid);
              } else if (statusName === 'delivered' || statusName === 'read') {
                await sb.from('messages')
                  .update({ status: statusName })
                  .eq('twilio_sid', wamid)
                  .eq('direction', 'outgoing');
              }
            } catch (e) {
              console.error('message status mirror failed', e);
            }

            const { data: rec } = await sb
              .from('campaign_recipients')
              .select('id, campaign_id, status, delivered_at, read_at')
              .eq('whatsapp_message_id', wamid)
              .maybeSingle();
            if (!rec) continue;

            const update: Record<string, unknown> = {};
            const incFields: string[] = [];
            if (statusName === 'delivered' && !rec.delivered_at) {
              update.delivered_at = ts;
              update.status = rec.status === 'read' ? 'read' : 'delivered';
              incFields.push('delivered_count');
            } else if (statusName === 'read' && !rec.read_at) {
              update.read_at = ts;
              update.status = 'read';
              if (!rec.delivered_at) { update.delivered_at = ts; incFields.push('delivered_count'); }
              incFields.push('read_count');
            } else if (statusName === 'failed') {
              update.failed_at = ts;
              update.status = 'failed';
              update.error_code = st.errors?.[0]?.code ? String(st.errors[0].code) : null;
              update.error = st.errors?.[0]?.title || st.errors?.[0]?.message || 'failed';
            }
            if (Object.keys(update).length > 0) {
              await sb.from('campaign_recipients').update(update).eq('id', rec.id);
              for (const f of incFields) {
                const { data: camp } = await sb.from('campaigns').select(f).eq('id', rec.campaign_id).maybeSingle();
                if (camp) await sb.from('campaigns').update({ [f]: ((camp as any)[f] || 0) + 1 }).eq('id', rec.campaign_id);
              }
            }
          }
        } catch (e) {
          console.error('status webhook handling failed', e);
        }
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      if (!messages || messages.length === 0) {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const message = messages[0];
      const phoneNumber = message.from;
      const messageId = message.id;

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // ===== Duplicate webhook delivery guard =====
      // Meta retries webhooks on timeouts/non-200s. Without this check, the AI
      // can reply multiple times to a single user message. Skip if we've already
      // stored an incoming message with this wamid.
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('twilio_sid', messageId)
          .maybeSingle();
        if (existingMsg) {
          console.log('Duplicate webhook delivery for', messageId, '— skipping');
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
      }


      // Tenant routing
      let tenantId: string | null = null;
      let tenantAccessToken: string | null = null;
      let tenantPhoneNumberId: string | null = null;

      if (webhookPhoneNumberId) {
        // Match on the number first. A connection that was marked inactive
        // (expired token, temporary disconnect) still belongs to that account,
        // so we keep storing its incoming messages instead of dropping them.
        const { data: creds } = await supabase
          .from('tenant_credentials')
          .select('tenant_id, access_token, phone_number_id, is_active')
          .eq('phone_number_id', webhookPhoneNumberId)
          .eq('provider', 'whatsapp_cloud')
          .order('is_active', { ascending: false })
          .limit(1);
        const cred = creds?.[0];

        if (cred) {
          if (!cred.is_active) {
            console.warn('Routing to tenant with inactive WhatsApp credential:', cred.tenant_id);
          }
          tenantId = cred.tenant_id;
          tenantPhoneNumberId = cred.phone_number_id;
          tenantAccessToken = (cred.access_token && cred.access_token !== 'FROM_ENV')
            ? cred.access_token
            : Deno.env.get('WHATSAPP_ACCESS_TOKEN') || null;
          console.log('Routed to tenant:', tenantId);
        }
      }

      if (!tenantAccessToken) {
        const envPhoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || null;
        // Only fall back to the shared env credentials when the message really
        // arrived on the env-owned number (or Meta sent no metadata). Otherwise
        // an unlinked number would leak its chats into another tenant's inbox.
        if (webhookPhoneNumberId && envPhoneNumberId && webhookPhoneNumberId !== envPhoneNumberId) {
          console.error('Unrouted WhatsApp number:', webhookPhoneNumberId, '— no tenant credential');
          try {
            await supabase.from('whatsapp_unrouted_events').insert({
              phone_number_id: webhookPhoneNumberId,
              display_phone_number: value?.metadata?.display_phone_number ?? null,
              from_number: phoneNumber ?? null,
              preview: (messages?.[0]?.text?.body || messages?.[0]?.type || '').slice(0, 200),
            });
          } catch (e) {
            console.error('failed logging unrouted event', e);
          }
          return new Response('OK', { status: 200, headers: corsHeaders });
        }

        tenantAccessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || null;
        tenantPhoneNumberId = envPhoneNumberId;
        if (!tenantId) {
          // Prefer the tenant whose credential is explicitly set to FROM_ENV
          // (i.e. the one that owns the shared env-var WhatsApp number).
          const { data: envCred } = await supabase
            .from('tenant_credentials')
            .select('tenant_id')
            .eq('provider', 'whatsapp_cloud')
            .eq('is_active', true)
            .eq('access_token', 'FROM_ENV')
            .limit(1)
            .maybeSingle();
          if (envCred) {
            tenantId = envCred.tenant_id;
            console.log('Fallback (FROM_ENV) tenant routing:', tenantId);
          } else {
            const { data: fallbackCred } = await supabase
              .from('tenant_credentials')
              .select('tenant_id')
              .eq('provider', 'whatsapp_cloud')
              .eq('is_active', true)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            if (fallbackCred) {
              tenantId = fallbackCred.tenant_id;
              console.log('Fallback tenant routing:', tenantId);
            }
          }
        }

      }


      if (!tenantAccessToken || !tenantPhoneNumberId) {
        console.error('No credentials found for this phone number');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Parse message content
      let messageText: string | null = null;
      let incomingMediaUrl: string | null = null;
      let incomingMediaType: string | null = null;
      let incomingImageBase64: { base64: string; mimeType: string } | null = null;
      let interactiveReplyId: string | null = null;

      if (message.type === 'text') {
        messageText = message.text?.body;
      } else if (message.type === 'audio' || message.type === 'voice') {
        console.log('🎤 Voice message received, transcribing...');
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

        const mediaId = message.audio?.id || message.voice?.id;
        if (!LOVABLE_API_KEY) {
          console.error('🎤 LOVABLE_API_KEY missing — cannot transcribe voice note');
        } else if (!mediaId) {
          console.error('🎤 Voice message had no media id:', JSON.stringify(message).slice(0, 300));
        } else {
          const media = await downloadWhatsAppMedia(mediaId, tenantAccessToken);
          if (media) {
            // Archive the audio so it stays playable / re-transcribable later —
            // Meta media ids expire and cannot be recovered from the wamid.
            try {
              const rawMime = (media.mimeType || 'audio/ogg').split(';')[0];
              const ext = audioFormatFromMime(rawMime);
              const path = `incoming/${tenantId || 'unknown'}/${messageId || crypto.randomUUID()}.${ext}`;
              const bytes = Uint8Array.from(atob(media.base64), c => c.charCodeAt(0));
              const { error: upErr } = await supabase.storage
                .from('chat-media')
                .upload(path, bytes, { contentType: rawMime, upsert: true });
              if (upErr) {
                console.error('🎤 Voice upload error:', upErr);
              } else {
                const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
                incomingMediaUrl = pub.publicUrl;
                incomingMediaType = rawMime;
                console.log('🎤 Voice archived:', incomingMediaUrl);
              }
            } catch (e) {
              console.error('🎤 Voice upload exception:', e);
            }

            messageText = await transcribeAudio(media.base64, media.mimeType, LOVABLE_API_KEY);
            if (messageText) {
              console.log('🎤 Transcribed:', messageText.substring(0, 100));
            } else {
              console.error('🎤 Transcription returned no text for media', mediaId);
            }
          }
        }

        if (!messageText) {
          messageText = '[Voice message - could not be transcribed]';
        }


      } else if (message.type === 'image' || message.type === 'sticker' || (message.type === 'document' && (message.document?.mime_type || '').startsWith('image/'))) {
        console.log('🖼️ Image message received:', message.type);
        const media_obj = message.image || message.sticker || message.document;
        const mediaId = media_obj?.id;
        const caption = media_obj?.caption || '';
        let imageDescription: string | null = null;
        let imageMatchedProduct: string | null = null;
        if (mediaId) {
          const media = await downloadWhatsAppMedia(mediaId, tenantAccessToken);
          if (media) {
            incomingImageBase64 = media;
            incomingMediaType = media.mimeType;
            // Upload to chat-media bucket
            try {
              const ext = (media.mimeType.split('/')[1] || 'jpg').split(';')[0];
              const path = `incoming/${tenantId || 'unknown'}/${messageId || crypto.randomUUID()}.${ext}`;
              const bytes = Uint8Array.from(atob(media.base64), c => c.charCodeAt(0));
              const { error: upErr } = await supabase.storage
                .from('chat-media')
                .upload(path, bytes, { contentType: media.mimeType, upsert: true });
              if (upErr) {
                console.error('Image upload error:', upErr);
              } else {
                const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path);
                incomingMediaUrl = pub.publicUrl;
                console.log('Image uploaded:', incomingMediaUrl);
              }
            } catch (e) {
              console.error('Image upload exception:', e);
            }

            // Read the image so its content persists in the conversation history.
            const VISION_KEY = Deno.env.get('LOVABLE_API_KEY');
            if (VISION_KEY) {
              imageDescription = await analyzeImage(media.base64, media.mimeType, VISION_KEY);
              // Then resolve WHICH of our products the photo shows, so later turns
              // (and the order flow) get a real catalog product, not a description.
              if (imageDescription && tenantId) {
                try {
                  const titles: string[] = [];
                  const PAGE = 1000;
                  for (let from = 0; from < 4000; from += PAGE) {
                    const { data: rows } = await supabase
                      .from('ai_knowledge')
                      .select('title')
                      .eq('tenant_id', tenantId)
                      .eq('is_active', true)
                      .in('type', ['shopify_product', 'file_product', 'website_product', 'product'])
                      .range(from, from + PAGE - 1);
                    for (const r of rows || []) {
                      const t = r.title ? String(r.title).trim() : '';
                      if (!t || /^(main[_\s-]?knowledge|knowledge|website|site[_\s-]?content|faq|about|policy|policies|menu|brief|document|content)$/i.test(t)) continue;
                      titles.push(t.slice(0, 80));
                    }

                    if (!rows || rows.length < PAGE) break;
                  }
                  const matched = await matchImageToCatalog(media.base64, media.mimeType, VISION_KEY, imageDescription, titles);
                  if (matched) imageMatchedProduct = matched;
                } catch (e) {
                  console.error('🖼️ Catalog match step failed:', e);
                }
              }
            }
          }
        }
        const visionLines = imageDescription
          ? imageDescription.replace(/\s*\n\s*/g, ' | ').slice(0, 700)
          : null;
        const visionNote = visionLines
          ? `[Image received — contents: ${visionLines}${imageMatchedProduct ? ` | MATCHED CATALOG PRODUCT: "${imageMatchedProduct}" — the customer is asking about THIS product` : ' | no catalog product matched — ask which product they mean'}]`
          : '[Image]';
        messageText = caption ? `${caption}\n${visionNote}` : visionNote;


      } else if (message.type === 'interactive') {
        const br = message.interactive?.button_reply;
        const lr = message.interactive?.list_reply;
        interactiveReplyId = br?.id || lr?.id || null;
        messageText = br?.title || lr?.title || '[Interactive reply]';
        console.log('🔘 Interactive reply:', interactiveReplyId, messageText);
      } else {
        console.log('Unsupported message type:', message.type);
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      if (!phoneNumber || !messageText) {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // ===== Click-to-WhatsApp ad referral =====
      // Messages started from a Facebook/Instagram ad carry a `referral` object with
      // the ad headline, body and the source URL (often the product page). Without it,
      // generic openers like "Hello! Can I get more info on this?" have no product context.
      const referral = message.referral || value?.referral || null;
      if (referral) {
        try {
          const parts: string[] = [];
          const srcUrl: string = referral.source_url || '';
          let productName = '';
          const slugMatch = srcUrl.match(/\/products\/([^/?#]+)/i);
          if (slugMatch) {
            productName = decodeURIComponent(slugMatch[1])
              .replace(/[-_]+/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
              .trim();
          }
          if (productName) parts.push(`product: ${productName}`);
          if (referral.headline) parts.push(`ad headline: ${String(referral.headline).slice(0, 120)}`);
          if (!productName && referral.body) parts.push(`ad text: ${String(referral.body).slice(0, 160)}`);
          if (srcUrl) parts.push(srcUrl);
          if (parts.length > 0) {
            messageText = `${messageText}\n\n[Sent from an ad — ${parts.join(' | ')}. "this" refers to this product.]`;
            console.log('📢 Ad referral context attached:', parts.join(' | '));
          }
        } catch (e) {
          console.error('referral parse failed', e);
        }
      }

      // For social media links (Instagram, Facebook, TikTok), try to fetch the
      // post caption and append it to the message so the order-flow matchers can
      // resolve the actual product name instead of guessing from a shortcode.
      messageText = await appendSocialCaptionToText(messageText);

      console.log('Processing message from:', phoneNumber, 'Text:', messageText);

      // Built after the incoming message is stored so vague follow-ups such as
      // "Fi sizes?" can retrieve knowledge using the product named just before it.
      let systemPrompt = BASE_SYSTEM_PROMPT;
      let availableImageGroups: Record<string, Array<{ image_url: string; description: string }>> = {};
      let knowledgeEntries: Array<{ title: string; content: string }> = [];

      // Find or create contact — normalize phone with leading "+" so it matches CSV imports.
      // IMPORTANT: scope by tenant_id so the same phone can exist across multiple tenants
      // (e.g. Super Admin inbox vs. main product tenant) without cross-tenant leakage.
      const phoneWithPlus = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      const phoneNoPlus = phoneNumber.replace(/^\+/, '');
      let contactQuery = supabase
        .from('contacts')
        .select('*')
        .in('phone_number', [phoneWithPlus, phoneNoPlus]);
      if (tenantId) {
        contactQuery = contactQuery.eq('tenant_id', tenantId);
      } else {
        contactQuery = contactQuery.is('tenant_id', null);
      }
      let { data: contactCandidates } = await contactQuery;

      // Prefer the "+"-prefixed row if both exist
      let contact: any = (contactCandidates || []).find((c: any) => c.phone_number === phoneWithPlus)
        || (contactCandidates || [])[0]
        || null;

      if (contact && !contact.tenant_id && tenantId) {
        await supabase.from('contacts').update({ tenant_id: tenantId }).eq('id', contact.id);
        contact.tenant_id = tenantId;
      }

      if (!contact) {
        const insertData: any = { phone_number: phoneWithPlus, name: phoneWithPlus };
        if (tenantId) insertData.tenant_id = tenantId;

        const { data: newContact, error: createError } = await supabase
          .from('contacts')
          .insert(insertData)
          .select()
          .single();

        if (createError) throw createError;
        contact = newContact;
      }

      // Store incoming message
      const { data: storedMsg, error: messageError } = await supabase
        .from('messages')
        .insert({
          contact_id: contact.id,
          content: messageText,
          direction: 'incoming',
          status: 'delivered',
          twilio_sid: messageId,
          media_url: incomingMediaUrl,
          media_type: incomingMediaType,
        })
        .select('id, created_at')
        .single();

      if (messageError) throw messageError;

      // Mobile app push: new inbound WhatsApp message.
      console.log('[app-push] call site: inbound_message', {
        tenant: contact.tenant_id ?? tenantId ?? null,
        contact: contact.id,
      });
      await notifyTenantApp(supabase, contact.tenant_id ?? tenantId ?? null, {
        eventType: 'inbound_message',
        title: 'New message',
        body: `${contact.name || phoneWithPlus}: ${messagePreview(messageText, incomingMediaType)}`,
        url: `/app?contact=${contact.id}`,
      });

      // Semantic search needs the freshest customer context, not only the final
      // short follow-up. Combining recent incoming turns makes queries such as
      // "Nike Mind 001 - Black ST" followed by "Fi sizes?" retrieve that exact
      // product row (including its imported sizes and variants).
      const { data: retrievalMessages } = await supabase
        .from('messages')
        .select('content')
        .eq('contact_id', contact.id)
        .eq('direction', 'incoming')
        .order('created_at', { ascending: false })
        .limit(6);
      const retrievalText = (retrievalMessages || [])
        .slice()
        .reverse()
        .map((m: any) => String(m.content || '').trim())
        .filter(Boolean)
        .join('\n');
      ({ prompt: systemPrompt, imageGroups: availableImageGroups, knowledgeEntries } =
        await buildSystemPrompt(supabase, tenantId, retrievalText || messageText));

      // ===== OPT-OUT / OPT-IN HANDLING =====
      // Detect explicit marketing opt-out words only. Do not treat generic "cancel"
      // replies/buttons as unsubscribe, because order flows also use Cancel.
      {
        const normalized = (messageText || '').trim().toLowerCase().replace(/[.!?،]+$/g, '');
        const stopWords = ['stop', 'unsubscribe', 'stop all', 'stopall', 'remove me', 'opt out', 'optout', 'توقف', 'ايقاف', 'إيقاف'];
        const startWords = ['start', 'unstop', 'resubscribe', 'subscribe', 'ابدأ', 'ابدا', 'اشترك'];
        const isStop = stopWords.includes(normalized);
        const isStart = startWords.includes(normalized);
        if (isStop || isStart) {
          await supabase.from('contacts').update({
            opted_out: isStop,
            opted_out_at: isStop ? new Date().toISOString() : null,
            ai_enabled: isStop ? false : true,
          }).eq('id', contact.id);
          const reply = isStop
            ? "You've been unsubscribed from promotional messages. Reply START to resubscribe."
            : "You're resubscribed. You'll receive our messages again.";
          try {
            await sendWhatsAppMessage(tenantPhoneNumberId!, tenantAccessToken!, phoneNumber, reply);
            await supabase.from('messages').insert({
              contact_id: contact.id,
              content: reply,
              direction: 'outgoing',
              status: 'sent',
            });
          } catch (e) {
            console.error('opt-out reply failed', e);
          }
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
      }

      // Debounce: customers often send several messages in quick succession.
      // Wait briefly, then if a NEWER incoming message exists for this contact,
      // skip replying here — the newest message's invocation replies once with full context.
      // While a guided order session is active (or the customer tapped a button/list item)
      // replies are deterministic and must feel instant, so debounce is minimal.
      let debounceMs = 6000;
      if (interactiveReplyId) {
        debounceMs = 0;
      } else if (tenantId) {
        const { data: liveSession } = await supabase
          .from('order_sessions')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('contact_id', contact.id)
          .not('state', 'in', '(done,cancelled)')
          .gt('expires_at', new Date().toISOString())
          .limit(1);

        if (liveSession && liveSession.length > 0) debounceMs = 1200;
      }
      if (debounceMs > 0) await new Promise((r) => setTimeout(r, debounceMs));

      const { data: newerMsgs } = await supabase
        .from('messages')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('direction', 'incoming')
        .gt('created_at', storedMsg.created_at)
        .neq('id', storedMsg.id)
        .limit(1);
      if (newerMsgs && newerMsgs.length > 0) {
        console.log('Debounce: newer message from contact exists — skipping reply for this one');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // ===== VERTICAL ROUTER =====
      // Restaurant tenants run an isolated flow. E-commerce code below is untouched.
      if (tenantId) {
        try {
          const { data: tenantRow } = await supabase
            .from('tenants').select('vertical').eq('id', tenantId).maybeSingle();
          const v = tenantRow?.vertical;
          if (v === 'restaurant' || v === 'real_estate' || v === 'wellness' || v === 'service' || v === 'healthcare' || v === 'education') {
            // Tenant-wide master switch must win over any per-chat setting.
            const { data: globalRow } = await supabase
              .from('app_settings')
              .select('value')
              .eq('tenant_id', tenantId)
              .eq('key', 'ai_replies_enabled')
              .maybeSingle();
            if (globalRow && (globalRow.value === false || globalRow.value === 'false')) {
              console.log('Global AI replies disabled for tenant (vertical flow)', tenantId);
              return new Response('OK', { status: 200, headers: corsHeaders });
            }
            const { data: tRow } = await supabase
              .from('tenants').select('ai_replies_enabled').eq('id', tenantId).maybeSingle();
            if (tRow?.ai_replies_enabled === false) {
              console.log('Global AI replies disabled on tenant row (vertical flow)', tenantId);
              return new Response('OK', { status: 200, headers: corsHeaders });
            }
            const { data: cRow } = await supabase
              .from('contacts').select('ai_enabled, blocked').eq('id', contact.id).maybeSingle();
            if ((cRow as any)?.blocked === true) {
              console.log('Contact is blocked — ignoring (vertical flow)', contact.id);
              return new Response('OK', { status: 200, headers: corsHeaders });
            }
            if (cRow?.ai_enabled === false) {
              return new Response('OK', { status: 200, headers: corsHeaders });
            }
            const flowOpts = {
              supabase, tenantId, contact, phoneNumber,
              tenantPhoneNumberId: tenantPhoneNumberId!,
              tenantAccessToken: tenantAccessToken!,
              messageText: messageText || null,
              interactiveReplyId: interactiveReplyId || null,
            };
            if (v === 'restaurant') await runRestaurantFlow(flowOpts);
            else if (v === 'real_estate') await runRealEstateFlow(flowOpts);
            else if (v === 'wellness' || v === 'service') await runWellnessFlow(flowOpts);
            else if (v === 'healthcare') await runHealthcareFlow(flowOpts);
            else await runEducationFlow(flowOpts);
            return new Response('OK', { status: 200, headers: corsHeaders });
          }
        } catch (rErr) {
          console.error('vertical flow error', rErr);
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
      }
      // ===== END VERTICAL ROUTER (e-commerce continues below, unchanged) =====

      // ===== AI OFF SWITCHES (must run before ANY automated reply) =====
      // Tenant-wide master switch from Settings.
      if (tenantId) {
        const { data: globalRow } = await supabase
          .from('app_settings')
          .select('value')
          .eq('tenant_id', tenantId)
          .eq('key', 'ai_replies_enabled')
          .maybeSingle();
        if (globalRow && (globalRow.value === false || globalRow.value === 'false')) {
          console.log('Global AI replies disabled for tenant', tenantId);
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
      }

      // Per-chat toggle. This must be checked BEFORE resuming any guided order
      // session, otherwise mid-order chats keep getting bot replies with AI off.
      {
        const { data: contactRow } = await supabase
          .from('contacts')
          .select('ai_enabled, blocked')
          .eq('id', contact.id)
          .maybeSingle();
        if ((contactRow as any)?.blocked === true) {
          console.log('Contact is blocked — ignoring', contact.id);
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
        if (contactRow?.ai_enabled === false) {
          console.log('AI replies disabled for contact', contact.id);
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
      }
      // ===== END AI OFF SWITCHES =====



      // ===== GUIDED ORDER FLOW (deterministic state machine) =====
      // 1) If there's an active session, route the message to the state machine and stop.
      // 2) Otherwise, the AI may later call start_order_flow to begin one.
      const LOVABLE_API_KEY_FOR_FLOW = Deno.env.get('LOVABLE_API_KEY');

      // Load tenant settings for guided flow
      let guidedFlowEnabled = true;
      let aiHintsEnabled = true;
      if (tenantId) {
        const { data: settings } = await supabase
          .from('app_settings')
          .select('guided_order_flow_enabled, guided_order_flow_ai_hints_enabled')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (settings) {
          guidedFlowEnabled = settings.guided_order_flow_enabled !== false;
          aiHintsEnabled = settings.guided_order_flow_ai_hints_enabled !== false;
        }
      }

      // Tenant-wide upsell / recommendation switch (Settings → AI Auto-Replies).
      // Single source of truth: `ai_upsell_enabled`, with the legacy per-vertical
      // key as fallback. Used by BOTH the AI prompt and the programmatic order flow.
      let upsellEnabled = false;
      if (tenantId) {
        try {
          const { data: upsellRows } = await supabase
            .from('app_settings')
            .select('key, value')
            .eq('tenant_id', tenantId)
            .in('key', ['ai_upsell_enabled', 'restaurant_upsell_enabled']);
          const pick = (k: string) => (upsellRows || []).find((r: any) => r.key === k)?.value;
          const primary = pick('ai_upsell_enabled');
          const legacy = pick('restaurant_upsell_enabled');
          const raw = primary !== undefined && primary !== null ? primary : legacy;
          upsellEnabled = raw === true || raw === 'true';
        } catch (e) {
          console.error('upsell setting fetch failed', e);
        }
      }
      console.log('upsell enabled for tenant', tenantId, '=', upsellEnabled);



      // Catalog loader (shared between session resume and start_order_flow)
      const loadCatalog = async (): Promise<CatalogItem[]> => {
        if (!tenantId) return [];
        // Only real product rows may act as a catalog. Generic knowledge documents
        // (e.g. "main_knowledge") must never show up as pickable products.
        // Cached per tenant (short TTL) because large stores have thousands of rows and
        // re-downloading them on every order step made each reply take seconds.
        const cached = CATALOG_CACHE.get(tenantId);
        if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.items;

        const source: any[] = [];
        const PAGE_SIZE = 1000;
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data, error } = await supabase
            .from('ai_knowledge')
            .select('id, title, content, type')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .in('type', ['shopify_product', 'file_product', 'website_product', 'product'])
            .range(from, from + PAGE_SIZE - 1);
          if (error) {
            console.error('loadCatalog page failed:', error);
            break;
          }
          source.push(...(data || []));
          if (!data || data.length < PAGE_SIZE) break;
        }
        const items: CatalogItem[] = [];
        // Document-style rows (whole-site scrapes, brochures, FAQ dumps) are never
        // orderable products even if mislabeled with a product type.
        const DOC_TITLE = /^(main[_\s-]?knowledge|knowledge|website|site[_\s-]?content|faq|about|policy|policies|menu|brief|document|content)$/i;
        for (const r of source) {
          if (!r.title) continue;
          if (DOC_TITLE.test(String(r.title).trim())) continue;

          // extract price: prefer "sale $X" / "$X" but skip "was/used to be $X"
          const text = String(r.content || '');
          const cleaned = text.replace(/(was|used to be|كان)\s*\$?\d+(?:\.\d+)?/gi, '');
          const m = cleaned.match(/\$\s*(\d+(?:\.\d+)?)/);
          const price = m ? parseFloat(m[1]) : 0;
          if (price > 0) {
            items.push({ id: r.id, title: r.title.slice(0, 60), price, description: text.slice(0, 2500) });
          }
        }
        // Keep the full loaded catalog available to matching. Truncating this list
        // could omit one of two similarly named products and force a wrong match.
        CATALOG_CACHE.set(tenantId, { at: Date.now(), items });
        return items;
      };



      // Finalize order: writes to public.orders with source='whatsapp_flow' and line_items.
      // ALSO registers on Shopify (previously this path skipped Shopify — the source of most
      // "un-registered" orders). Local row is always kept; sync failures are recorded and retried.
      const finalizeFlowOrder = async (draft: any): Promise<{ success: boolean; displayId?: number; error?: string }> => {
        try {
          const productSummary = draft.items.map((i: any) => `${i.qty}x ${i.title}`).join(', ');
          const totalQty = draft.items.reduce((s: number, i: any) => s + i.qty, 0);
          const customerName = draft.customer_name || contact.name || phoneNumber;
          const customerPhone = draft.contact_phone || phoneNumber;
          const customerAddress = draft.address || '';

          // Attempt Shopify registration first (same pattern as AI flow).
          let shopifyOrderId: string | null = null;
          let shopifyOrderNumber: number | null = null;
          let syncStatus: string = 'pending';
          let syncError: string | null = null;

          if (tenantId) {
            const shopifyItems = draft.items.map((i: any) => ({
              product_name: String(i.title || ''),
              quantity: Number(i.qty || 1),
            }));
            const r = await createShopifyOrder(supabase, tenantId, {
              customer_name: customerName,
              customer_address: customerAddress,
              customer_phone: customerPhone,
              items: shopifyItems,
            });
            if (r.success && r.shopifyOrderId) {
              shopifyOrderId = r.shopifyOrderId;
              shopifyOrderNumber = r.orderNumber || null;
              syncStatus = 'synced';
            } else {
              syncStatus = r.kind || 'failed';
              syncError = r.error || 'Unknown Shopify error';
              console.warn('flow order Shopify sync', syncStatus, syncError);
            }
          } else {
            syncStatus = 'no_credentials';
          }

          const insertData: any = {
            contact_id: contact.id,
            tenant_id: tenantId,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            product_name: productSummary,
            quantity: totalQty,
            status: 'pending',
            delivery_fee: draft.delivery_fee,
            total_price: draft.total,
            source: 'whatsapp_flow',
            line_items: draft.items,
            shopify_order_id: shopifyOrderId,
            shopify_sync_status: syncStatus,
            shopify_sync_error: syncError,
            shopify_sync_attempts: tenantId ? 1 : 0,
            shopify_last_attempt_at: tenantId ? new Date().toISOString() : null,
          };
          if (shopifyOrderNumber) insertData.display_id = shopifyOrderNumber;

          let { data: order, error } = await supabase
            .from('orders').insert(insertData).select('id, display_id').single();

          if (error && (error as any).code === '23505') {
            // display_id or shopify_order_id collision — retry without display_id
            const { display_id: _o, ...retryData } = insertData;
            const retry = await supabase.from('orders').insert(retryData).select('id, display_id').single();
            order = retry.data; error = retry.error;
          }

          if (error) {
            console.error('finalizeFlowOrder DB insert failed:', error);
            // If Shopify succeeded but local save failed, we still have an authoritative order.
            if (shopifyOrderId) {
              return { success: true, displayId: shopifyOrderNumber || undefined };
            }
            return { success: false, error: error.message };
          }

          // Auto-save customer name (and phone if missing) to contact if still a placeholder,
          // so the CRM shows the real name/number instead of the raw WhatsApp phone.
          try {
            const { data: c } = await supabase
              .from('contacts').select('name, phone_number').eq('id', contact.id).maybeSingle();
            const currentName = (c?.name || '').trim();
            const phone = c?.phone_number || '';
            const isPlaceholder = !currentName || currentName === phone
              || currentName.replace(/\D/g, '') === phone.replace(/\D/g, '');
            const patch: any = {};
            if (customerName && isPlaceholder && customerName !== phoneNumber) patch.name = customerName;
            if (!phone && customerPhone) patch.phone_number = customerPhone;
            if (Object.keys(patch).length) {
              await supabase.from('contacts').update(patch).eq('id', contact.id);
            }
          } catch (e) {
            console.error('finalizeFlowOrder contact auto-save failed:', e);
          }

          return { success: true, displayId: order.display_id };
        } catch (e: any) {
          console.error('finalizeFlowOrder exception:', e);
          return { success: false, error: e.message };
        }
      };

      // Text of the most recent campaign/broadcast sent to this contact. Replies to a
      // campaign are about THAT product, so it resets stale product context.
      let latestCampaignText: string | null = null;
      try {
        const { data: lastCamp } = await supabase
          .from('campaign_recipients')
          .select('sent_at')
          .eq('contact_id', contact.id)
          .not('sent_at', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCamp?.sent_at) {
          const t = new Date(lastCamp.sent_at).getTime();
          const { data: campMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('contact_id', contact.id)
            .eq('direction', 'outgoing')
            .gte('created_at', new Date(t - 120000).toISOString())
            .lte('created_at', new Date(t + 120000).toISOString())
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (campMsg?.content) latestCampaignText = String(campMsg.content);
        }
      } catch (e) {
        console.error('campaign context lookup failed (non-fatal):', e);
      }

      const buildFlowDeps = (history: Array<{ role: string; content: string }> = []): OrderFlowDeps => ({
        supabase,
        tenantId: tenantId || '',
        contactId: contact.id,
        phoneNumber,
        phoneNumberId: tenantPhoneNumberId!,
        accessToken: tenantAccessToken!,
        loadCatalog,
        finalizeOrder: finalizeFlowOrder,
        lovableApiKey: LOVABLE_API_KEY_FOR_FLOW,
        conversationHistory: history,
        aiHintsEnabled,
        knowledgeEntries,
        latestCampaignText,
        upsellEnabled,

      });


      // Resume active session if any
      if (guidedFlowEnabled && tenantId) {
        const activeSession = await getActiveSession(supabase, tenantId, contact.id);
        if (activeSession) {
          console.log('Resuming order session', activeSession.id, 'state=', activeSession.state);
          const { data: prior } = await supabase
            .from('messages').select('content, direction').eq('contact_id', contact.id)
            .order('created_at', { ascending: false }).limit(10);
          const history = (prior || []).reverse().map((m: any) => ({
            role: m.direction === 'incoming' ? 'user' : 'assistant',
            content: m.content,
          }));
          await handleSessionMessage(
            buildFlowDeps(history),
            activeSession as any,
            messageText,
            interactiveReplyId,
          );
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
      }
      // ===== END GUIDED ORDER FLOW pre-check =====




      // Track campaign reply (best-effort)
      try {
        const { data: rec } = await supabase
          .from('campaign_recipients')
          .select('id, campaign_id, replied_at, sent_at')
          .eq('contact_id', contact.id)
          .not('sent_at', 'is', null)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rec && !rec.replied_at && rec.sent_at) {
          // Only count replies within 7 days of send
          const sentAt = new Date(rec.sent_at).getTime();
          if (Date.now() - sentAt < 7 * 24 * 3600 * 1000) {
            await supabase.from('campaign_recipients')
              .update({ replied_at: new Date().toISOString() }).eq('id', rec.id);
            const { data: camp } = await supabase
              .from('campaigns').select('replied_count').eq('id', rec.campaign_id).maybeSingle();
            if (camp) await supabase.from('campaigns')
              .update({ replied_count: ((camp as any).replied_count || 0) + 1 })
              .eq('id', rec.campaign_id);
          }
        }
      } catch (e) { console.error('reply tracking failed', e); }


      // Auto-flag interested customers (best-effort, non-blocking)
      try {
        if (!contact.is_interested) {
          const { count: incomingCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contact.id)
            .eq('direction', 'incoming');

          // Only run classifier after at least 3 incoming messages to save cost
          if ((incomingCount || 0) >= 3) {
            const { data: convoMsgs } = await supabase
              .from('messages')
              .select('content, direction')
              .eq('contact_id', contact.id)
              .order('created_at', { ascending: false })
              .limit(20);

            const transcript = (convoMsgs || []).reverse()
              .map((m: any) => `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.content}`)
              .join('\n');

            const LOVABLE_API_KEY_FLAG = Deno.env.get('LOVABLE_API_KEY');
            if (LOVABLE_API_KEY_FLAG) {
              const classifyRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY_FLAG}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: 'google/gemini-3.8-flash',
                  messages: [
                    { role: 'system', content: 'You judge whether a WhatsApp customer is genuinely interested in buying a product. Genuine interest = asked multiple specific product questions (price, availability, features, photos, sizes, colors, delivery) and has NOT yet placed an order. Casual greetings, single questions, complaints, or order tracking are NOT interest. Reply ONLY with valid JSON: {"interested": true|false, "reason": "<short reason under 12 words>"}.' },
                    { role: 'user', content: transcript }
                  ],
                  response_format: { type: 'json_object' }
                }),
              });

              if (classifyRes.ok) {
                const classifyData = await classifyRes.json();
                const raw = classifyData.choices?.[0]?.message?.content || '{}';
                let parsed: any = {};
                try { parsed = JSON.parse(raw); } catch {}
                if (parsed.interested === true) {
                  await supabase
                    .from('contacts')
                    .update({
                      is_interested: true,
                      interest_reason: (parsed.reason || 'Asked multiple product questions').slice(0, 200),
                      interested_at: new Date().toISOString(),
                    })
                    .eq('id', contact.id);
                  console.log('Flagged contact as interested:', contact.id, parsed.reason);
                }
              }
            }
          }
        }
      } catch (flagErr) {
        console.error('Interest flagging error (non-fatal):', flagErr);
      }

      // AI toggles (tenant master switch + per-chat) are enforced earlier,
      // before the guided order flow, so nothing auto-replies when AI is off.




      // Fetch conversation context
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('content, direction, created_at')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(40);

      // Coalesce consecutive same-role messages so rapid-fire user messages
      // appear as a single user turn (otherwise Gemini sometimes returns empty).
      const conversationHistory: any[] = [];
      for (const msg of (recentMessages || []).slice().reverse()) {
        const role = msg.direction === 'incoming' ? 'user' : 'assistant';
        // Prior bot replies can contain a price that has since changed or was
        // previously hallucinated. Never feed assistant-authored prices back to
        // the model as evidence; current catalog rows in the system prompt win.
        const historyContent = role === 'assistant'
          ? String(msg.content || '')
              .replace(/\$\s*\d+(?:\.\d{1,2})?/g, '[previous price removed]')
              .replace(/\b(?:USD|US\$)\s*\d+(?:\.\d{1,2})?/gi, '[previous price removed]')
          : msg.content;
        const last = conversationHistory[conversationHistory.length - 1];
        if (last && last.role === role && typeof last.content === 'string') {
          last.content = `${last.content}\n${historyContent}`;
        } else {
          conversationHistory.push({ role, content: historyContent });
        }
      }

      // If the current message doesn't include an image, look back for a recent incoming image
      // (last ~5 minutes, no assistant reply in between) — customers often send the photo first,
      // then a follow-up like "is this available?" as a separate message.

      if (!incomingImageBase64) {
        try {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: recentMsgs } = await supabase
            .from('messages')
            .select('media_url, media_type, direction, created_at')
            .eq('contact_id', contact.id)
            .gte('created_at', fiveMinAgo)
            .order('created_at', { ascending: false })
            .limit(10);
          // Walk from newest to oldest, stop at first outgoing assistant message
          let candidateUrl: string | null = null;
          let candidateType: string | null = null;
          for (const m of (recentMsgs || [])) {
            if (m.direction === 'outgoing') break;
            if (m.media_url && (m.media_type || '').startsWith('image/')) {
              candidateUrl = m.media_url;
              candidateType = m.media_type;
              break;
            }
          }
          if (candidateUrl) {
            const imgRes = await fetch(candidateUrl);
            if (imgRes.ok) {
              const ab = await imgRes.arrayBuffer();
              const bytes = new Uint8Array(ab);
              let bin = '';
              for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
              incomingImageBase64 = { base64: btoa(bin), mimeType: candidateType || 'image/jpeg' };
              console.log('🖼️ Re-attached recent image for context:', candidateUrl);
            }
          }
        } catch (e) {
          console.error('recent-image lookup failed', e);
        }
      }

      // If current message includes an image, attach it as multimodal content to the last user turn
      if (incomingImageBase64) {
        const lastUserIdx = (() => {
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            if (conversationHistory[i].role === 'user') return i;
          }
          return -1;
        })();
        const multimodal: any = {
          role: 'user',
          content: [
            { type: 'text', text: messageText || '[Image]' },
            { type: 'image_url', image_url: { url: `data:${incomingImageBase64.mimeType};base64,${incomingImageBase64.base64}` } },
          ],
        };
        if (lastUserIdx >= 0) {
          (conversationHistory as any)[lastUserIdx] = multimodal;
        } else {
          (conversationHistory as any).push(multimodal);
        }
      }


      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) throw new Error('AI service not configured');

      // Build tools array
      const tools: any[] = [START_ORDER_FLOW_TOOL, UPDATE_ORDER_STATUS_TOOL, UPDATE_ORDER_DETAILS_TOOL, TRANSFER_TO_HUMAN_TOOL, SEND_IMAGE_TOOL, GET_ORDER_INFO_TOOL, TAG_CONTACT_TOOL];

      const currentTags: string[] = Array.isArray(contact.tags) ? contact.tags : [];
      const taggingContext = `\n\n## CRM Tagging\nCurrent tags on this contact: ${currentTags.length ? currentTags.join(', ') : '(none)'}.\nWhenever you learn something useful about who this customer is or what they want (interests, language, location, lead quality, complaints, VIP, repeat buyer, wholesale, etc.), call tag_contact to add concise lowercase kebab-case tags. Avoid duplicates and avoid tagging trivial/transient things. Never mention tagging to the customer.`;

      // Inject recent campaign context so AI knows which product was promoted
      let campaignContext = '';
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { data: recentCampaignRec } = await supabase
          .from('campaign_recipients')
          .select('sent_at, campaign:campaigns(name, template_name, variables)')
          .eq('contact_id', contact.id)
          .not('sent_at', 'is', null)
          .gte('sent_at', sevenDaysAgo)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recentCampaignRec?.campaign) {
          const c: any = recentCampaignRec.campaign;
          const vars = Array.isArray(c.variables) && c.variables.length ? ` | vars: ${c.variables.join(' | ')}` : '';
          campaignContext = `\n\n## Recent Campaign Context\nThis customer was sent a WhatsApp campaign template "${c.template_name}" (campaign: "${c.name}")${vars}, sent at ${recentCampaignRec.sent_at}.\nONLY use this context if the customer has NOT discussed a different specific product in the recent conversation above. If they have already been talking about another product (e.g. you sent an image of "Triple Solar Security Light" earlier), stay on THAT product — do NOT switch to the campaign product. The campaign product is only a fallback when the customer references "the product/this/it" with no other product in context. Never invent a product name from the campaign template if the conversation is clearly about something else.`;
        }
      } catch (e) { console.error('campaign context fetch failed', e); }

      const pricingContext = `\n\n## Sale Pricing\nWhen quoting a price for a product that has a "used to be $X" or "(was $X)" note in the knowledge base, ALWAYS mention both: e.g. "It's $25, used to be $40." Never hide the original price when an item is on sale — customers love hearing the savings.`;

      // Tenant-wide upsell / recommendation switch (Settings → AI Auto-Replies).
      // `upsellEnabled` is resolved once earlier in this request.
      let _upsellDirective = `\n\n## NO UPSELLING\nDo NOT suggest extra items, add-ons, alternatives, or promotions. Only answer what the customer asked.`;
      if (upsellEnabled) {
        // Never upsell on complaints, delivery chasing, or human-handover turns.
        const _lu = (messageText || '').toLowerCase();
        const _noUpsellNow = /\b(refund|broken|damaged|late|complain|complaint|where is my order|track|tracking|cancel|human|agent|manager|speak to someone)\b/.test(_lu)
          || /(مرتجع|مكسور|تعطل|متأخر|شكوى|وين طلبي|الغاء|إلغاء|بدي حد|موظف)/.test(messageText || '');

        // Pick ONE real candidate from the live catalog so the model never invents one.
        let _candidateLine = '';
        if (!_noUpsellNow) {
          try {
            const catalogForUpsell = await loadCatalog();
            if (catalogForUpsell.length > 1) {
              const recentText = [
                messageText || '',
                ...(conversationHistory || []).slice(-6).map((m: any) => String(m?.content || '')),
              ].join(' \n ').toLowerCase();
              const mentioned = (t: string) => recentText.includes(t.toLowerCase().slice(0, 22));
              const isOnSale = (c: any) => /(was|used to be|sale|كان|تنزيلات)/i.test(String(c.description || ''));
              const pool = catalogForUpsell.filter((c) => c.price > 0 && !mentioned(c.title));
              const candidate = pool.find(isOnSale) || pool[0] || null;
              if (candidate) {
                _candidateLine = `\nSUGGESTION TO USE (exact name and exact price, do not change them): "${candidate.title}" — $${Number(candidate.price).toFixed(2)}${isOnSale(candidate) ? ' (on sale)' : ''}.`;
              }
            }
          } catch (e) { console.error('upsell candidate pick failed', e); }
        }

        _upsellDirective = _noUpsellNow
          ? `\n\n## NO UPSELLING ON THIS TURN\nThis message is a complaint, delivery/tracking question, cancellation, or a human request. Do NOT suggest anything extra — just handle it.`
          : `\n\n## UPSELL & RECOMMEND — REQUIRED (OVERRIDES THE ONE-SENTENCE LIMIT)\nUpselling is turned ON by the business. After answering the customer's question, you MUST add ONE short extra sentence suggesting one relevant product — a matching add-on, or an alternative if they asked about a product but have not ordered.${_candidateLine}\nFor this reply only, you are allowed TWO short sentences (up to ~28 words total): the answer, then the suggestion. Keep it casual, e.g. "Also, our X is $9.99 if you want to add it."\nHard rules: exactly ONE suggestion, never repeat it if they already declined it earlier in the chat, never invent a product name or a price that is not given above or in the knowledge base, and never delay or complicate an order already in progress.`;
      }


      // Detect language of latest customer message and inject a hard mirror directive
      const _lastUser = (messageText || '').trim();
      const _hasArabicScript = /[\u0600-\u06FF]/.test(_lastUser);
      const _arabiziTokens = /\b(badde|bade|baddak|3ayez|3ayze|shu|kam|addeh|adesh|2addeh|2adesh|wen|eymta|halla2|bukra|ba3dein|tayeb|tayyeb|tayib|shukran|merci|ahla|marhaba|ma3lesh|ma3leesh|yalla|akid|mnih|mneha|fi|fih|3andak|3ande|wa7de|wehde|wahde|tnen|tnein|tlete|tlateh|arba3a|khamse|sitte|sab3a|tmene|tes3a|3ashra|suwar|soura|sura|warjine|farjine|aywa|na3am|la2|ade|aande|aandak|hayda|hayde|hek|kif|kifak|kifik|lawn|loun|byaamol|bya3mol|3al|bel|lal)\b/i;
      const _isArabizi = !_hasArabicScript && _arabiziTokens.test(_lastUser);
      let _langDirective = '';
      if (_hasArabicScript) {
        _langDirective = `## HARD LANGUAGE LOCK (HIGHEST PRIORITY)\nThe customer's LATEST message is in ARABIC SCRIPT (e.g. "${_lastUser.slice(0, 60)}"). You MUST reply in ARABIC SCRIPT only. Do NOT reply in English. Do NOT reply in Arabizi/Latin letters. Ignore that previous bot turns were in English — switch NOW. Mirror the customer's current script every turn.`;
      } else if (_isArabizi) {
        _langDirective = `## HARD LANGUAGE LOCK (HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE)\nThe customer's LATEST message is in LEBANESE ARABIZI (Latin letters): "${_lastUser.slice(0, 80)}".\nYou MUST reply ONLY in Arabizi (Latin letters with 2/3/5/7 numerals). DO NOT reply in English. DO NOT reply in Arabic script. Ignore that previous bot turns may have been in English — switch to Arabizi NOW and stay in Arabizi until the customer changes language.\nExamples of correct Arabizi replies:\n- "shu se3ro?" → "se3ro 24.99 dollar, kein 34.99."\n- "fi stock?" → "eh fi, 3andna 186 piece."\n- "ade bya3mol?" → "bya3mol 360° taghteye lal beit, solar w ma byestehlek kahraba."\n- "shu muwasafeto?" → "tlet rouss LED ma3 motion sensor, solar, weatherproof lal barra."\nIf you are about to write an English word like "The", "It", "Yes", "Sorry", STOP and rewrite the whole reply in Arabizi.`;

      }
      // Tenant-wide forced reply language (Settings → AI Auto-Replies → Reply language)
      try {
        if (tenantId) {
          const { data: langRow } = await supabase
            .from('app_settings')
            .select('value')
            .eq('tenant_id', tenantId)
            .eq('key', 'ai_reply_language')
            .maybeSingle();
          const forced = typeof langRow?.value === 'string'
            ? langRow.value.replace(/^"|"$/g, '')
            : (langRow?.value ? String(langRow.value) : 'all');
          const LOCKS: Record<string, string> = {
            english: `## HARD LANGUAGE LOCK (HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE)\nThe business has locked replies to ENGLISH ONLY. Reply ONLY in English, no matter what language the customer writes in. Never reply in Arabic script, Arabizi, or French.`,
            arabizi: `## HARD LANGUAGE LOCK (HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE)\nThe business has locked replies to LEBANESE ARABIZI ONLY (Latin letters with 2/3/5/7 numerals). Reply ONLY in Arabizi, no matter what language the customer writes in. Never reply in English, Arabic script, or French. If you are about to write an English word like "The", "It", "Yes", "Sorry", STOP and rewrite the whole reply in Arabizi.`,
            arabic: `## HARD LANGUAGE LOCK (HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE)\nThe business has locked replies to ARABIC SCRIPT ONLY. Reply ONLY in Arabic script, no matter what language the customer writes in. Never reply in English, Arabizi/Latin letters, or French.`,
            french: `## HARD LANGUAGE LOCK (HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE)\nThe business has locked replies to FRENCH ONLY. Reply ONLY in French, no matter what language the customer writes in. Never reply in English, Arabic script, or Arabizi.`,
          };
          if (forced && forced !== 'all' && LOCKS[forced]) {
            _langDirective = LOCKS[forced];
          }
        }
      } catch (e) { console.error('reply language fetch failed', e); }

      const _answerDirective = `\n\n## ANSWER THE EXACT QUESTION\nAlways answer the SPECIFIC question the customer asked. If they ask price, give the price. If they ask stock, give stock. If they ask color, give color. Do NOT pivot to a different attribute (e.g. answering "out of stock" when they asked the price). If the item is out of stock, still answer the question first (price/color/etc.), then add the stock note in the same reply.\n\n## USE THE KNOWLEDGE BASE — DO NOT REFUSE EASILY\nThe BUSINESS INFORMATION above (product descriptions, prices, variants, FAQs, additional info, tags) IS your source of truth. ALWAYS answer from it when the info is there, even if phrased differently than the customer's question (paraphrasing and reasonable inference from the description is fine and expected). Price, stock, colors, sizes, materials, what's in the box, how to use, care instructions, warranty, shipping — if it's in the knowledge base in any form, answer it directly.\n\nONLY reply "I don't have that detail — want me to check with the team?" (mirror the customer's language) when the knowledge base genuinely says NOTHING about the topic. Do NOT use that fallback when the answer is in the description or FAQ — read carefully before refusing.\n\nNEVER fabricate specific performance numbers, durations, distances, or behaviour claims (e.g. "lasts 8 hours", "works in heavy rain", "100m range", "stays bright on cloudy days") if the knowledge base does not state them. No hedging like "might", "may vary", "could be" — either it's stated in the KB or you don't know.`;
      const fullSystemPrompt = systemPrompt + taggingContext + campaignContext + pricingContext + _answerDirective + (_langDirective ? '\n\n' + _langDirective : '') + _upsellDirective;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.8-flash',
          messages: [
            { role: 'system', content: fullSystemPrompt },
            ...conversationHistory,
            ...(_langDirective ? [{ role: 'system' as const, content: _langDirective }] : []),
          ],
          tools,
          tool_choice: "auto"
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        await logAIIncident(supabase, {
          tenant_id: tenantId,
          contact_id: contact.id,
          incident_type: 'failure',
          reason: `AI API error ${aiResponse.status}`,
          user_message: messageText,
          model: AI_MODEL,
          metadata: { status: aiResponse.status, error: errorText.slice(0, 1000) },
        });

        // Credits exhausted / rate limited: don't leave the customer with dead air,
        // and don't throw (Meta would retry the webhook and pile up more incidents).
        if (aiResponse.status === 402 || aiResponse.status === 429) {
          if (tenantPhoneNumberId && tenantAccessToken) {
            const { data: recentOut } = await supabase
              .from('messages')
              .select('content, created_at')
              .eq('contact_id', contact.id)
              .eq('direction', 'outgoing')
              .order('created_at', { ascending: false })
              .limit(1);
            const alreadyNotified = (recentOut?.[0]?.content || '').includes(AI_UNAVAILABLE_NOTICE);
            if (!alreadyNotified) {
              try {
                await sendWhatsAppMessage(tenantPhoneNumberId, tenantAccessToken, phoneNumber, AI_UNAVAILABLE_NOTICE);
                await supabase.from('messages').insert({
                  tenant_id: tenantId,
                  contact_id: contact.id,
                  content: AI_UNAVAILABLE_NOTICE,
                  direction: 'outgoing',
                  status: 'sent',
                });
              } catch (notifyError) {
                console.error('Failed to send AI-unavailable notice:', notifyError);
              }
            }
          }
          return new Response('OK', { status: 200, headers: corsHeaders });
        }
        throw new Error(`AI API error: ${aiResponse.status}`);
      }


      const aiData = await aiResponse.json();
      const aiMessage = aiData.choices?.[0]?.message;

      if (!aiMessage) {
        await logAIIncident(supabase, {
          tenant_id: tenantId,
          contact_id: contact.id,
          incident_type: 'failure',
          reason: 'No AI response generated',
          user_message: messageText,
          model: AI_MODEL,
          metadata: { raw: JSON.stringify(aiData).slice(0, 1000) },
        });
        throw new Error('No AI response generated');
      }

      let aiReply = aiMessage.content || '';
      const usedPhoneNumberId = tenantPhoneNumberId!;
      const usedAccessToken = tenantAccessToken!;
      let imageSent = false;
      
      // Handle tool calls
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        for (const toolCall of aiMessage.tool_calls) {
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch { continue; }

          let toolResponse = '';

          if (toolCall.function.name === 'send_image') {
            // Large catalogs cannot be held in the prompt, so look the requested
            // product's photos up live before concluding there are none.
            if (tenantId && args.image_label) {
              const wanted = String(args.image_label);
              const alreadyMatched = findBestImageLabel(availableImageGroups, wanted);
              if (!alreadyMatched) {
                const words = wanted
                  .replace(/[^\p{L}\p{N}.]+/gu, ' ')
                  .split(/\s+/)
                  .filter((w) => w.length >= 3)
                  .sort((a, b) => b.length - a.length)
                  .slice(0, 4);
                let found: any[] | null = null;
                for (let take = words.length; take >= 1 && !found?.length; take--) {
                  let q = supabase
                    .from('knowledge_images')
                    .select('label, description, image_url')
                    .eq('tenant_id', tenantId)
                    .eq('is_active', true);
                  for (const w of words.slice(0, take)) q = q.ilike('label', `%${w}%`);
                  const { data } = await q.limit(20);
                  found = data || [];
                }
                for (const img of found || []) {
                  if (!availableImageGroups[img.label]) availableImageGroups[img.label] = [];
                  if (availableImageGroups[img.label].some((i: any) => i.image_url === img.image_url)) continue;
                  availableImageGroups[img.label].push({ image_url: img.image_url, description: img.description });
                }
                if (found?.length) console.log('Lazy image lookup found', found.length, 'photos for', wanted);
              }
            }

            if (Object.keys(availableImageGroups).length === 0) {
              toolResponse = `No images are configured yet. Tell the customer you don't have photos available right now and describe the product instead.`;
            } else {
            // Find matching image group (fuzzy match), preferring WhatsApp-compatible images
            const matchedLabel = findBestImageLabel(availableImageGroups, args.image_label);

            if (matchedLabel) {
              const imageGroup = getSendableImages(availableImageGroups[matchedLabel]);

              if (imageGroup.length === 0) {
                console.log('No WhatsApp-compatible image available for:', matchedLabel);
                toolResponse = `No sendable image found for "${matchedLabel}".`;
                continue;
              }

              // Count how many images of this item were already sent in conversation
              const { data: sentImages } = await supabase
                .from('messages')
                .select('media_url')
                .eq('contact_id', contact.id)
                .eq('direction', 'outgoing')
                .not('media_url', 'is', null)
                .order('created_at', { ascending: true });

              const sentUrls = (sentImages || []).map((m: any) => m.media_url);
              // When the customer picked a color, prefer a photo whose description
              // or URL mentions it; otherwise fall back to the normal rotation.
              const chosenColor = String(args.color || '').trim();
              const colorMatch = chosenColor
                ? imageGroup.find((img) => {
                    const hay = `${img.description || ''} ${img.image_url}`.toLowerCase();
                    return hay.includes(chosenColor.toLowerCase());
                  })
                : undefined;
              const sentCountForItem = imageGroup.filter(img => sentUrls.includes(img.image_url)).length;
              const nextIndex = Math.min(sentCountForItem, imageGroup.length - 1);
              const imageToSend = colorMatch || imageGroup[nextIndex];
              const imageUrl = imageToSend.image_url;

              const isLastPhoto = nextIndex >= imageGroup.length - 1;
              console.log(`Sending image ${nextIndex + 1}/${imageGroup.length} for "${matchedLabel}"${chosenColor ? ` (color: ${chosenColor})` : ''}`);
              imageSent = await sendWhatsAppImage(
                usedPhoneNumberId, usedAccessToken, phoneNumber,
                imageUrl,
                args.caption || (chosenColor ? `${matchedLabel} — ${chosenColor}` : imageToSend.description)
              );


              if (imageSent) {
                await supabase.from('messages').insert({
                  contact_id: contact.id,
                  content: args.caption || `📷 ${matchedLabel} (${nextIndex + 1}/${imageGroup.length})`,
                  direction: 'outgoing',
                  status: 'sent',
                  media_url: imageUrl,
                  media_type: imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg',
                });
              }

              toolResponse = imageSent
                ? `__IMAGE_SENT__`
                : `Failed to send image "${matchedLabel}".`;
            } else {
              toolResponse = `No image found matching "${args.image_label}". Available items: ${Object.keys(availableImageGroups).join(', ')}.`;
            }
            }
          } else if (toolCall.function.name === 'start_order_flow') {
            if (!guidedFlowEnabled) {
              toolResponse = 'Guided order flow is disabled for this tenant. Ask the customer for their name, address, and items, then call back when implemented.';
            } else {
              try {
                let hintItems = Array.isArray(args?.hint_items) ? args.hint_items : [];
                // Fallback: if AI didn't extract any hints, run the dedicated extractor on the current message + history
                if (hintItems.length === 0 && LOVABLE_API_KEY) {
                  try {
                    hintItems = await extractOrderHints(LOVABLE_API_KEY, conversationHistory as any, messageText || '');
                    console.log('start_order_flow fallback hints:', JSON.stringify(hintItems));
                  } catch (e) {
                    console.error('hint extraction fallback failed:', e);
                  }
                }
                await startOrderFlow(buildFlowDeps(conversationHistory as any), hintItems);
                toolResponse = '__FLOW_STARTED__'; // sentinel: skip follow-up AI reply

              } catch (e: any) {
                console.error('startOrderFlow failed:', e);
                toolResponse = `Could not start order flow: ${e.message}. Ask the customer to try again.`;
              }
            }
          } else if (toolCall.function.name === 'update_order_status') {
            const result = await updateOrderStatus(supabase, args.order_display_id, args.new_status, tenantId || '');
            toolResponse = result.success
              ? `Order #${args.order_display_id} status updated to ${args.new_status}.`
              : `TOOL_FAILED: could not update order #${args.order_display_id} (${result.error}). DO NOT tell the customer the order was updated. Tell them you couldn't apply the change and a human will follow up, then call transfer_to_human.`;
          } else if (toolCall.function.name === 'update_order_details') {
            const result = await updateOrderDetails(supabase, args.order_display_id, tenantId || '', {
              customer_name: args.customer_name,
              customer_address: args.customer_address,
              items: args.items,
            });

            toolResponse = result.success
              ? `Order #${args.order_display_id} updated successfully.`
              : `TOOL_FAILED: could not update order #${args.order_display_id} (${result.error}). DO NOT tell the customer the order was updated or that it is "all set". Tell them you couldn't apply the change and a human will follow up, then call transfer_to_human.`;
          } else if (toolCall.function.name === 'get_order_info') {
            const result = await getOrderInfo(supabase, args.order_display_id, tenantId || '', args.customer_phone);
            toolResponse = result.success
              ? result.info!
              : `TOOL_FAILED: ${result.error}. DO NOT invent order details. Ask the customer to double-check the order number, or offer to look it up by their phone number.`;
          } else if (toolCall.function.name === 'transfer_to_human') {
            // Flag the contact as needing a human in the dashboard
            try {
              const { error: flagErr } = await supabase
                .from('contacts')
                .update({
                  needs_human: true,
                  human_requested_at: new Date().toISOString(),
                })
                .eq('id', contact.id);

              if (flagErr) {
                console.error('Failed to flag contact for human:', flagErr);
                toolResponse = 'Could not flag the conversation. Tell the customer to try again shortly.';
              } else {
                console.log('Contact flagged for human review:', contact.id);
                toolResponse = 'Conversation has been flagged for a human agent. Tell the customer someone will reach out shortly.';
                await logAIIncident(supabase, {
                  tenant_id: tenantId,
                  contact_id: contact.id,
                  incident_type: 'handoff',
                  reason: args?.reason || 'Customer asked for a human',
                  user_message: messageText,
                  model: AI_MODEL,
                  metadata: { tool: 'transfer_to_human', args },
                });
              }
            } catch (err) {
              console.error('transfer_to_human error:', err);
              toolResponse = 'Could not flag the conversation. Tell the customer to try again shortly.';
            }
          } else if (toolCall.function.name === 'tag_contact') {
            try {
              const norm = (t: string) => String(t).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
              const toAdd: string[] = Array.isArray(args.add) ? args.add.map(norm).filter(Boolean) : [];
              const toRemove: string[] = Array.isArray(args.remove) ? args.remove.map(norm).filter(Boolean) : [];
              const existing: string[] = Array.isArray(contact.tags) ? contact.tags : [];
              const next = Array.from(new Set([...existing, ...toAdd])).filter(t => !toRemove.includes(t)).slice(0, 30);
              const { error: tagErr } = await supabase.from('contacts').update({ tags: next }).eq('id', contact.id);
              if (tagErr) {
                console.error('tag_contact error:', tagErr);
                toolResponse = 'Could not update tags. Continue the conversation normally.';
              } else {
                contact.tags = next;
                toolResponse = `Tags updated. Current: ${next.join(', ') || '(none)'}. Do not mention this to the customer — continue the conversation normally.`;
              }
            } catch (err) {
              console.error('tag_contact error:', err);
              toolResponse = 'Could not update tags. Continue normally.';
            }
          }

          // If the flow took over, suppress any follow-up AI reply entirely.
          if (toolResponse === '__FLOW_STARTED__' || toolResponse === '__IMAGE_SENT__') {
            return new Response('OK', { status: 200, headers: corsHeaders });
          }

          // Get follow-up from AI
          const followUp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-3.8-flash',
              messages: [
                { role: 'system', content: fullSystemPrompt },
                ...conversationHistory,
                aiMessage,
                { role: 'tool', tool_call_id: toolCall.id, content: toolResponse }
              ],
            }),
          });

          if (followUp.ok) {
            const followUpData = await followUp.json();
            aiReply = followUpData.choices?.[0]?.message?.content || aiReply || toolResponse;
          }
        }
      }

      if (!aiReply && !imageSent) {
        // Retry once with a plain completion (no tools) — common when the model
        // returned only a tool call with no text, or coalesced rapid messages.
        try {
          const retry = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-3.8-flash',
              messages: [
                { role: 'system', content: fullSystemPrompt },
                ...conversationHistory,
              ],
            }),
          });
          if (retry.ok) {
            const rd = await retry.json();
            aiReply = rd.choices?.[0]?.message?.content || '';
          }
        } catch (e) { console.error('Empty-reply retry failed:', e); }

        if (!aiReply) {
          await logAIIncident(supabase, {
            tenant_id: tenantId,
            contact_id: contact.id,
            incident_type: 'failure',
            reason: 'AI produced empty reply (after retry)',
            user_message: messageText,
            model: AI_MODEL,
          });
          // Stay silent rather than sending a generic apology, but surface the
          // chat to the team so the customer is not left waiting unnoticed.
          if (!contact.needs_human) {
            const { error: emptyFlagErr } = await supabase
              .from('contacts')
              .update({ needs_human: true, human_requested_at: new Date().toISOString() })
              .eq('id', contact.id);
            if (emptyFlagErr) console.error('Auto-flag on empty reply failed:', emptyFlagErr);
          }
        }
      } else {
        const lowMatch = detectLowConfidence(aiReply);
        if (lowMatch) {
          await logAIIncident(supabase, {
            tenant_id: tenantId,
            contact_id: contact.id,
            incident_type: 'low_confidence',
            reason: `Matched phrase: "${lowMatch}"`,
            user_message: messageText,
            ai_reply: aiReply,
            model: AI_MODEL,
          });
          // Auto-flag contact for human — AI promised to check/follow up but can't.
          if (!contact.needs_human) {
            const { error: autoFlagErr } = await supabase
              .from('contacts')
              .update({
                needs_human: true,
                human_requested_at: new Date().toISOString(),
              })
              .eq('id', contact.id);
            if (autoFlagErr) console.error('Auto-flag on low confidence failed:', autoFlagErr);
            else console.log('Contact auto-flagged for human (low confidence):', contact.id);
          }
        }
      }

      // Safety net: the AI asked "which product/color?" without listing any option.
      // Append the concrete matching options so the customer can actually choose.
      try {
        const blankAsk = /(ay|ayya|anu|which|shu)\s+(product|item|model|lawn|color|colour|منتج|لون)/i.test(aiReply || '')
          || /أي\s*(منتج|لون)/.test(aiReply || '');
        const labels = Object.keys(availableImageGroups || {});
        if (!imageSent && blankAsk && labels.length > 0) {
          const stop = new Set(['the','a','and','of','for','baddi','baddak','bade','fi','pic','pics','photo','photos','image','images','soura','sourat','suwar','see','send','me','want','to']);
          const tokens = (messageText || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !stop.has(t));
          let matches = labels.filter((l) => tokens.some((t) => l.toLowerCase().includes(t)));
          // Only add a list if the reply doesn't already mention one of them
          const alreadyListed = matches.some((m) => (aiReply || '').toLowerCase().includes(m.toLowerCase()));
          if (matches.length > 1 && !alreadyListed) {
            matches = matches.slice(0, 6);
            aiReply = `${(aiReply || '').trim()}\n${matches.map((m) => `• ${m}`).join('\n')}`;
            console.log('Blank-clarification safety net: appended options', matches);
          }
        }
      } catch (err) {
        console.error('Blank-clarification safety net failed:', err);
      }

      // Safety net: if the AI didn't call send_image, force it when the user asked

      // OR when the AI text claims it is sending/showing a picture.
      // Covers English, Arabic script, and Lebanese Arabizi (suwar, soura, sura, warjine...).
      // Stricter intent: only photo-specific words. Removed generic "see/look/show/view/snap"
      // because they fire on normal speech ("I'll see you", "look forward to it").
      const imageIntentRegex = /\b(photo|photos|picture|pictures|pic|pics|image|images|suwar|sou?ra|sura|sora|swar|warjine|farjine)\b|صورة|صور/i;
      const refusalRegex = /(can'?t|cannot|unable to|don'?t have).*(send|share|provide).*(photo|picture|image|pic)|don'?t have (a )?(photo|picture|image|pic).*(send|share|right now)|\bma\s*(3and\w*|aand\w*|and\w*|fi)\b[^.]*\b(sou?ra|sura|sora|suwar|swar|photo|pic|image)|ما\s*(عندي|في)[^.]*صور/i;
      const userWantsImage = imageIntentRegex.test(messageText || '');
      const aiRefusedImage = refusalRegex.test(aiReply || '');
      // Only force-send if the user explicitly asked AND the AI refused. Do NOT auto-send
      // just because the AI text mentioned a picture — that caused random pics.
      if (!imageSent && userWantsImage && aiRefusedImage && Object.keys(availableImageGroups).length > 0) {
        console.log('Image safety net triggered — forcing send_image retry', { userWantsImage, aiRefusedImage });
        try {
          const retry = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-3.8-flash',
              messages: [
                { role: 'system', content: fullSystemPrompt },
                ...conversationHistory,
                { role: 'system', content: `The customer just asked to see a photo. You MUST call send_image now with the best-matching label from Available Images. Available labels: ${Object.keys(availableImageGroups).join(', ')}. Do not reply in text — call the tool.` },
              ],
              tools: [SEND_IMAGE_TOOL],
              tool_choice: { type: 'function', function: { name: 'send_image' } },
            }),
          });
          if (retry.ok) {
            const retryData = await retry.json();
            const retryMsg = retryData.choices?.[0]?.message;
            const tc = retryMsg?.tool_calls?.[0];
            if (tc?.function?.name === 'send_image') {
              const rArgs = JSON.parse(tc.function.arguments || '{}');
              const matchedLabel = findBestImageLabel(availableImageGroups, rArgs.image_label);
              if (!matchedLabel) {
                console.log('Safety net: no confident image match for label', rArgs.image_label, '— skipping to avoid random pic');
              }
              const group = matchedLabel ? getSendableImages(availableImageGroups[matchedLabel]) : [];
              if (group.length > 0) {
                const { data: sentImages } = await supabase
                  .from('messages').select('media_url')
                  .eq('contact_id', contact.id).eq('direction', 'outgoing').not('media_url', 'is', null);
                const sentUrls = (sentImages || []).map((m: any) => m.media_url);
                const sentCount = group.filter(img => sentUrls.includes(img.image_url)).length;
                const img = group[Math.min(sentCount, group.length - 1)];
                const ok = await sendWhatsAppImage(usedPhoneNumberId, usedAccessToken, phoneNumber, img.image_url, rArgs.caption || img.description);
                if (ok) {
                  imageSent = true;
                  aiReply = '';
                  await supabase.from('messages').insert({
                    contact_id: contact.id,
                    content: rArgs.caption || `📷 ${matchedLabel}`,
                    direction: 'outgoing', status: 'sent',
                    media_url: img.image_url,
                    media_type: img.image_url.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg',
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error('Image safety-net retry failed:', err);
        }

        if (!imageSent) {
          await logAIIncident(supabase, {
            tenant_id: tenantId,
            contact_id: contact.id,
            incident_type: 'failure',
            reason: 'Image requested but not sent (safety-net retry failed)',
            user_message: messageText,
            ai_reply: aiReply,
            model: AI_MODEL,
            metadata: {
              available_labels: Object.keys(availableImageGroups),
              user_intent: 'image_request',
            },
          });
        }
      } else if (userWantsImage && !imageSent && Object.keys(availableImageGroups).length === 0) {
        await logAIIncident(supabase, {
          tenant_id: tenantId,
          contact_id: contact.id,
          incident_type: 'failure',
          reason: 'Customer asked for image but no images configured',
          user_message: messageText,
          ai_reply: aiReply,
          model: AI_MODEL,
          metadata: { user_intent: 'image_request' },
        });
      }


      // Send text reply
      let messageSent = false;
      // Never leak internal price-redaction placeholders to the customer.
      aiReply = sanitizeOutgoingPrices(aiReply, buildCatalogPriceMap(knowledgeEntries || []));
      if (aiReply) {

        console.log('AI reply:', aiReply.substring(0, 100) + '...');
        messageSent = await sendWhatsAppMessage(usedPhoneNumberId, usedAccessToken, phoneNumber, aiReply);

        await supabase.from('messages').insert({
          contact_id: contact.id,
          content: aiReply,
          direction: 'outgoing',
          status: messageSent ? 'sent' : 'failed',
        });

        // Mobile app push: AI answered on the user's behalf.
        if (messageSent) {
          console.log('[app-push] call site: ai_reply_sent', {
            tenant: contact.tenant_id ?? tenantId ?? null,
            contact: contact.id,
          });
          await notifyTenantApp(supabase, contact.tenant_id ?? tenantId ?? null, {
            eventType: 'ai_reply_sent',
            title: 'Reply sent',
            body: `AI replied to ${contact.name || phoneNumber}`,
            url: `/app?contact=${contact.id}`,
          });
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });

    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
