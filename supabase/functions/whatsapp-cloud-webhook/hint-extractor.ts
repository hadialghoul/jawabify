// Narrow LLM wrapper that extracts structured order hints from natural language.
// No prose, no write tools — pure extraction.

export interface HintItem {
  raw_text?: string;
  product_hint?: string;
  variant_hint?: string;
  qty_hint?: number;
  needs?: "product" | "variant" | "qty";
}

const SYSTEM = `You extract order intent from WhatsApp messages. Read the customer's latest message in the context of recent conversation, and return any items they appear to want to order.

Return ONLY valid JSON of shape:
{"hint_items":[{"raw_text":"<verbatim slice>","product_hint":"<best guess of product name or null>","variant_hint":"<color/size or null>","qty_hint":<integer or null>}]}

Rules:
- If the message clearly is NOT about ordering (greeting, question, complaint), return {"hint_items":[]}.
- Use prior turns for product context (e.g. "i want one" after discussing X → product_hint = X).
- Never invent products that were never mentioned. Leave product_hint null if unsure.
- qty_hint must be a positive integer or null. Convert Arabic number words (wehde=1, tnen=2, tlete=3, etc.).
- Multiple items in one message → multiple hint_items.`;

export async function extractOrderHints(
  apiKey: string,
  conversationHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
): Promise<HintItem[]> {
  try {
    const recent = conversationHistory.slice(-10);
    const transcript = recent
      .map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${typeof m.content === "string" ? m.content : "[media]"}`)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Recent conversation:\n${transcript}\n\nLatest customer message: "${currentMessage}"\n\nReturn the JSON now.` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("extractOrderHints: API error", res.status);
      return [];
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.hint_items) ? parsed.hint_items : [];
    return items.filter((i: any) => i && (i.product_hint || i.qty_hint));
  } catch (e) {
    console.error("extractOrderHints failed:", e);
    return [];
  }
}

/**
 * Lightweight intent classifier: does the customer seem to be trying to order?
 * Returns true on clear ordering intent OR if hints were extracted.
 */
export async function classifyOrderIntent(
  apiKey: string,
  conversationHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
): Promise<boolean> {
  try {
    const recent = conversationHistory.slice(-6);
    const transcript = recent
      .map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${typeof m.content === "string" ? m.content : "[media]"}`)
      .join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              'You classify WhatsApp messages. Reply ONLY with {"order":true} or {"order":false}. order=true if the customer is trying to place, start, or add to a NEW order in this message — including vague intent like "i want one", "بدي اطلب", "give me 2", "can I buy this". order=false for greetings, browsing questions, complaints, tracking existing orders, or pure curiosity.',
          },
          { role: "user", content: `Recent conversation:\n${transcript}\n\nLatest message: "${currentMessage}"` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return parsed.order === true;
  } catch (e) {
    console.error("classifyOrderIntent failed:", e);
    return false;
  }
}
