// Deterministic restaurant ordering state machine.
// States: picking_item → qty → reviewing_cart → mode → address → name → confirm → done|cancelled
//         (+ editing_items, editing_qty, editing_address, editing_name)
//
// Same shape as order-flow.ts but writes to `bills` + `bill_items`.

export interface RestaurantFlowDeps {
  supabase: any;
  tenantId: string;
  contactId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  menu: MenuItem[];
  currency: string;
  deliveryFee: number;
  etaText: string;
  kitchenNotifyPhone?: string | null;
  lovableApiKey?: string | null;
  conversationHistory?: Array<{ role: string; content: string }>;
  knowledgeEntries?: Array<{ title: string; content: string }>;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface DraftItem {
  menu_item_id: string;
  name: string;
  qty: number;
  unit_price: number;
}

interface Draft {
  items: DraftItem[];
  order_type?: "delivery" | "pickup" | "dine_in";
  delivery_address?: string;
  customer_name?: string;
  edit_mode?: "change_qty" | "remove";
  edit_item_index?: number;
  delivery_fee: number;
  subtotal: number;
  total: number;
}

interface Session {
  id: string;
  tenant_id: string;
  contact_id: string;
  state: string;
  draft: Draft;
  pending_hints: any[];
  flow_kind: string;
}

const MAX_QTY = 30;
const FLOW_KIND = "restaurant";

// ---------- digit + question helpers ----------
function normalizeDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

function looksLikeQuestion(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/[?؟]/.test(t)) return true;
  if (/^(what|when|where|why|who|how|is|are|do|does|can|could|would|will|fi|fih|shu|wen|emta|eimta|kam|adeish|adeysh|qaddesh|كيف|متى|أين|اين|لماذا|ما|هل|كم|شو|ليش|وين|امتى|في)\b/i.test(t)) return true;
  return /\b(price|cost|menu|halal|vegan|gluten|spicy|delivery|fee|hours|open|close|سعر|توصيل|سعرها|قديش|قدّيش|كم|مفتوح|حلال)\b/i.test(t);
}

function recomputeTotals(d: Draft): Draft {
  d.subtotal = d.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const deliveryFee = d.order_type === "delivery" ? d.delivery_fee : 0;
  d.total = d.subtotal + deliveryFee;
  return d;
}

function clearEdit(d: Draft) {
  delete d.edit_mode;
  delete d.edit_item_index;
}

function matchMenuItem(hint: string | undefined, menu: MenuItem[]): MenuItem | null {
  if (!hint) return null;
  const h = hint.toLowerCase().trim();
  if (!h) return null;
  let best = menu.find((c) => c.name.toLowerCase() === h);
  if (best) return best;
  best = menu.find((c) => c.name.toLowerCase().includes(h));
  if (best) return best;
  best = menu.find((c) => h.includes(c.name.toLowerCase()));
  if (best) return best;
  const hTokens = new Set(h.split(/\s+/).filter((t) => t.length > 2));
  let bestScore = 0;
  let bestItem: MenuItem | null = null;
  for (const c of menu) {
    const cTokens = c.name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const overlap = cTokens.filter((t) => hTokens.has(t)).length;
    if (overlap > bestScore) { bestScore = overlap; bestItem = c; }
  }
  return bestScore >= 2 ? bestItem : null;
}

function findDraftIndex(input: string | undefined, session: Session): number | null {
  if (!input) return null;
  const normalized = normalizeDigits(input).trim().toLowerCase();
  const m = normalized.match(/\d+/);
  if (m) {
    const idx = parseInt(m[0], 10) - 1;
    if (idx >= 0 && idx < session.draft.items.length) return idx;
  }
  const fake = session.draft.items.map((item, i) => ({ id: String(i), name: item.name, price: item.unit_price }));
  const matched = matchMenuItem(normalized, fake);
  if (!matched) return null;
  return Number(matched.id);
}

// ---------- whatsapp send helpers ----------
async function sendText(deps: RestaurantFlowDeps, body: string) {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: deps.phoneNumber, type: "text", text: { body } }),
  });
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId, content: body, direction: "outgoing", status: "sent",
  });
}

async function sendButtons(deps: RestaurantFlowDeps, body: string, buttons: Array<{ id: string; title: string }>) {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp", to: deps.phoneNumber, type: "interactive",
    interactive: {
      type: "button", body: { text: body },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await sendText(deps, `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n")}`);
    return;
  }
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId,
    content: `${body}\n[${buttons.map((b) => b.title).join(" • ")}]`,
    direction: "outgoing", status: "sent",
  });
}

async function sendList(deps: RestaurantFlowDeps, body: string, buttonText: string, rows: Array<{ id: string; title: string; description?: string }>) {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp", to: deps.phoneNumber, type: "interactive",
    interactive: {
      type: "list", body: { text: body },
      action: {
        button: buttonText.slice(0, 20),
        sections: [{
          title: "Menu",
          rows: rows.slice(0, 10).map((r) => ({
            id: r.id, title: r.title.slice(0, 24), description: (r.description || "").slice(0, 72),
          })),
        }],
      },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await sendText(deps, `${body}\n\n${rows.map((r, i) => `${i + 1}. ${r.title}`).join("\n")}\n\nReply with the number or item name.`);
    return;
  }
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId,
    content: `${body}\n[List: ${rows.map((r) => r.title).join(" • ")}]`,
    direction: "outgoing", status: "sent",
  });
}

// ---------- AI side-question ----------
async function maybeAnswerQuestion(deps: RestaurantFlowDeps, text: string, session: Session): Promise<boolean> {
  if (!deps.lovableApiKey || !text || !looksLikeQuestion(text)) return false;
  try {
    const cart = session.draft.items.map((i, idx) => `${idx + 1}. ${i.qty}× ${i.name} — ${deps.currency} ${(i.qty * i.unit_price).toFixed(2)}`).join("\n") || "Cart is empty.";
    const menuLines = deps.menu.slice(0, 30).map((m) => `- ${m.name}: ${deps.currency} ${m.price.toFixed(2)}${m.description ? ` — ${m.description.slice(0, 200)}` : ""}`).join("\n");
    const kb = (deps.knowledgeEntries || []).slice(0, 6).map((e) => `### ${e.title}\n${e.content.slice(0, 500)}`).join("\n\n");
    const ctx = [
      `Current step: ${session.state}`,
      `Cart:\n${cart}`,
      `Delivery fee (when delivery): ${deps.currency} ${deps.deliveryFee.toFixed(2)}`,
      `ETA: ${deps.etaText}`,
      `Menu:\n${menuLines}`,
      kb ? `Knowledge:\n${kb}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "You are answering a side-question during a WhatsApp restaurant order flow. ONE short sentence (≤20 words), mirror the customer's language (Arabic/English/Arabizi). Use menu + knowledge facts only. If unknown, reply 'Let me check with the team and get back to you' (in their language). Do NOT modify, confirm, or summarize the order." },
          { role: "system", content: ctx },
          ...(deps.conversationHistory || []).slice(-6),
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return false;
    const j = await res.json();
    const answer = j?.choices?.[0]?.message?.content?.trim();
    if (!answer) return false;
    await sendText(deps, answer);
    return true;
  } catch (e) {
    console.error("restaurant maybeAnswerQuestion failed", e);
    return false;
  }
}

// ---------- session ----------
export async function getActiveRestaurantSession(supabase: any, tenantId: string, contactId: string): Promise<Session | null> {
  const { data } = await supabase
    .from("order_sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .eq("flow_kind", FLOW_KIND)
    .not("state", "in", "(done,cancelled)")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

async function saveSession(supabase: any, s: Session) {
  await supabase.from("order_sessions").update({
    state: s.state,
    draft: s.draft,
    pending_hints: s.pending_hints,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }).eq("id", s.id);
}

async function cancelSession(supabase: any, id: string) {
  await supabase.from("order_sessions").update({ state: "cancelled" }).eq("id", id);
}

// ---------- public entry points ----------
export async function startRestaurantFlow(deps: RestaurantFlowDeps): Promise<boolean> {
  const existing = await getActiveRestaurantSession(deps.supabase, deps.tenantId, deps.contactId);
  if (existing) {
    await sendText(deps, "You already have an order in progress. Type 'cancel' to start over.");
    return false;
  }
  if (deps.menu.length === 0) {
    await sendText(deps, "Sorry, no menu items are available right now.");
    return false;
  }
  const draft: Draft = { items: [], delivery_fee: deps.deliveryFee, subtotal: 0, total: 0 };
  const { data: session, error } = await deps.supabase.from("order_sessions").insert({
    tenant_id: deps.tenantId,
    contact_id: deps.contactId,
    state: "picking_item",
    draft,
    pending_hints: [],
    flow_kind: FLOW_KIND,
  }).select().single();
  if (error || !session) {
    console.error("startRestaurantFlow: failed to create session", error);
    await sendText(deps, "Sorry, couldn't start the order. Try again in a moment.");
    return false;
  }
  await advance(deps, session as Session, null);
  return true;
}

export async function handleRestaurantSessionMessage(
  deps: RestaurantFlowDeps,
  session: Session,
  text: string | null,
  interactiveId: string | null,
): Promise<void> {
  const lower = (text || "").trim().toLowerCase();
  if (lower === "cancel" || lower === "إلغاء" || lower === "الغاء") {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, "Order cancelled. Let us know if you'd like to start again.");
    return;
  }
  await advance(deps, session, interactiveId ? { type: "interactive", id: interactiveId } : { type: "text", text: text || "" });
}

interface Incoming { type: "text" | "interactive"; text?: string; id?: string; }

async function advance(deps: RestaurantFlowDeps, session: Session, incoming: Incoming | null): Promise<void> {
  switch (session.state) {
    case "picking_item": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("item_")) {
          const id = incoming.id.slice("item_".length);
          const m = deps.menu.find((x) => x.id === id);
          if (m) {
            session.draft.items.push({ menu_item_id: m.id, name: m.name, qty: 1, unit_price: m.price });
            session.state = "qty";
            await saveSession(deps.supabase, session);
            await sendText(deps, `How many ${m.name}? Please reply with a number.`);
            return;
          }
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Which item would you like? Reply with its name.");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const direct = matchMenuItem(incoming.text, deps.menu);
          if (direct) {
            session.draft.items.push({ menu_item_id: direct.id, name: direct.name, qty: 1, unit_price: direct.price });
            session.state = "qty";
            await saveSession(deps.supabase, session);
            await sendText(deps, `How many ${direct.name}? Please reply with a number.`);
            return;
          }
          await sendText(deps, `I couldn't find "${incoming.text}" on the menu. Please pick from the list:`);
        }
      }
      const rows = deps.menu.slice(0, 10).map((m) => ({
        id: `item_${m.id}`, title: m.name, description: `${deps.currency} ${m.price.toFixed(2)}`,
      }));
      await sendList(deps, "What would you like to order?", "View menu", rows);
      return;
    }

    case "qty": {
      const last = session.draft.items[session.draft.items.length - 1];
      if (!last) { session.state = "picking_item"; await saveSession(deps.supabase, session); await advance(deps, session, null); return; }
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, `How many ${last.name}? Please reply with a number.`);
          return;
        }
        const n = parseInt(normalizeDigits(incoming.text).match(/\d+/)?.[0] || "", 10);
        if (n > 0 && n <= MAX_QTY) {
          last.qty = n;
          recomputeTotals(session.draft);
          session.state = "reviewing_cart";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, `How many ${last.name}? Please reply with a number (1-${MAX_QTY}).`);
      return;
    }

    case "reviewing_cart": {
      // Handle button replies
      if (incoming?.type === "interactive") {
        if (incoming.id === "cart_add") {
          session.state = "picking_item";
          await saveSession(deps.supabase, session);
          await sendText(deps, "What else would you like? Reply with the item name.");
          return;
        }
        if (incoming.id === "cart_done") {
          session.state = "mode";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.id === "cart_edit") {
          await sendButtons(deps, "What would you like to do?", [
            { id: "edit_qty", title: "Change qty" },
            { id: "edit_remove", title: "Remove item" },
          ]);
          return;
        }
        if (incoming.id === "edit_qty") {
          session.draft.edit_mode = "change_qty";
          session.state = "editing_items";
          await saveSession(deps.supabase, session);
          const list = session.draft.items.map((i, idx) => `${idx + 1}. ${i.qty}× ${i.name}`).join("\n");
          await sendText(deps, `Which item to change?\n${list}\n\nReply with the number or name.`);
          return;
        }
        if (incoming.id === "edit_remove") {
          session.draft.edit_mode = "remove";
          session.state = "editing_items";
          await saveSession(deps.supabase, session);
          const list = session.draft.items.map((i, idx) => `${idx + 1}. ${i.qty}× ${i.name}`).join("\n");
          await sendText(deps, `Which item to remove?\n${list}\n\nReply with the number or name.`);
          return;
        }
        if (incoming.id === "cart_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, "Order cancelled.");
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        if (await maybeAnswerQuestion(deps, incoming.text, session)) {
          // fall through to redisplay cart
        }
      }
      // Display cart
      const lines = session.draft.items.map((i, idx) =>
        `${idx + 1}. ${i.qty}× ${i.name} — ${deps.currency} ${(i.qty * i.unit_price).toFixed(2)}`,
      ).join("\n");
      const body = `🧾 Your cart:\n${lines}\n\nSubtotal: ${deps.currency} ${session.draft.subtotal.toFixed(2)}\n\nDelivery fee will be added if you choose delivery.`;
      await sendButtons(deps, body, [
        { id: "cart_add", title: "+ Add item" },
        { id: "cart_edit", title: "Edit" },
        { id: "cart_done", title: "Done" },
      ]);
      await sendButtons(deps, "Or:", [{ id: "cart_cancel", title: "Cancel order" }]);
      return;
    }

    case "editing_items": {
      if (incoming?.type === "text" && incoming.text) {
        const idx = findDraftIndex(incoming.text, session);
        if (idx == null) {
          await sendText(deps, "I didn't recognize that item. Reply with the line number.");
          return;
        }
        if (session.draft.edit_mode === "remove") {
          const removed = session.draft.items.splice(idx, 1)[0];
          recomputeTotals(session.draft);
          clearEdit(session.draft);
          session.state = session.draft.items.length === 0 ? "picking_item" : "reviewing_cart";
          await saveSession(deps.supabase, session);
          await sendText(deps, `Removed ${removed.name}.`);
          await advance(deps, session, null);
          return;
        }
        if (session.draft.edit_mode === "change_qty") {
          session.draft.edit_item_index = idx;
          session.state = "editing_qty";
          await saveSession(deps.supabase, session);
          await sendText(deps, `New quantity for ${session.draft.items[idx].name}?`);
          return;
        }
      }
      await sendText(deps, "Reply with the line number of the item.");
      return;
    }

    case "editing_qty": {
      const idx = session.draft.edit_item_index;
      if (idx == null || !session.draft.items[idx]) {
        clearEdit(session.draft);
        session.state = "reviewing_cart";
        await saveSession(deps.supabase, session);
        await advance(deps, session, null);
        return;
      }
      if (incoming?.type === "text" && incoming.text) {
        const n = parseInt(normalizeDigits(incoming.text).match(/\d+/)?.[0] || "", 10);
        if (n > 0 && n <= MAX_QTY) {
          session.draft.items[idx].qty = n;
          recomputeTotals(session.draft);
          clearEdit(session.draft);
          session.state = "reviewing_cart";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, `Please reply with a number (1-${MAX_QTY}).`);
      return;
    }

    case "mode": {
      if (incoming?.type === "interactive") {
        const map: Record<string, "delivery" | "pickup" | "dine_in"> = {
          mode_delivery: "delivery", mode_pickup: "pickup", mode_dinein: "dine_in",
        };
        const m = map[incoming.id || ""];
        if (m) {
          session.draft.order_type = m;
          recomputeTotals(session.draft);
          session.state = m === "delivery" ? "address" : "name";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        if (await maybeAnswerQuestion(deps, incoming.text, session)) { /* redisplay */ }
      }
      await sendButtons(deps, "How would you like to receive your order?", [
        { id: "mode_delivery", title: "Delivery" },
        { id: "mode_pickup", title: "Pickup" },
        { id: "mode_dinein", title: "Dine-in" },
      ]);
      return;
    }

    case "address": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "What's your delivery address? Please include building, street, area.");
          return;
        }
        if (incoming.text.trim().length >= 8) {
          session.draft.delivery_address = incoming.text.trim();
          session.state = "name";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        await sendText(deps, "I need a bit more detail — building, street, area please.");
        return;
      }
      await sendText(deps, "What's your delivery address? Please include building, street, area.");
      return;
    }

    case "name": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "And your name please?");
          return;
        }
        const name = incoming.text.trim();
        if (name.length >= 2) {
          session.draft.customer_name = name;
          session.state = "confirm";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, "What name should we put on the order?");
      return;
    }

    case "confirm": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "confirm_yes") {
          await finalizeBill(deps, session);
          return;
        }
        if (incoming.id === "confirm_edit") {
          await sendButtons(deps, "What do you want to edit?", [
            { id: "edit_back_items", title: "Items" },
            { id: "edit_back_address", title: "Address" },
            { id: "edit_back_name", title: "Name" },
          ]);
          return;
        }
        if (incoming.id === "edit_back_items") {
          session.state = "reviewing_cart";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.id === "edit_back_address") {
          if (session.draft.order_type !== "delivery") {
            await sendText(deps, "This is a pickup/dine-in order — no address needed.");
            return;
          }
          session.state = "address";
          await saveSession(deps.supabase, session);
          await sendText(deps, "What's the new delivery address?");
          return;
        }
        if (incoming.id === "edit_back_name") {
          session.state = "name";
          await saveSession(deps.supabase, session);
          await sendText(deps, "What's the name for the order?");
          return;
        }
        if (incoming.id === "confirm_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, "Order cancelled.");
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        if (await maybeAnswerQuestion(deps, incoming.text, session)) { /* redisplay */ }
      }
      // Show summary
      const d = session.draft;
      const lines = d.items.map((i) => `• ${i.qty}× ${i.name} — ${deps.currency} ${(i.qty * i.unit_price).toFixed(2)}`).join("\n");
      const modeLabel = d.order_type === "delivery" ? "Delivery" : d.order_type === "pickup" ? "Pickup" : "Dine-in";
      const deliveryLine = d.order_type === "delivery" ? `\nDelivery: ${deps.currency} ${deps.deliveryFee.toFixed(2)}` : "";
      const addrLine = d.order_type === "delivery" ? `\n📍 ${d.delivery_address}` : "";
      const body =
        `Please confirm your order:\n\n${lines}\n\nSubtotal: ${deps.currency} ${d.subtotal.toFixed(2)}${deliveryLine}\nTotal: ${deps.currency} ${d.total.toFixed(2)}\n\n${modeLabel}${addrLine}\n👤 ${d.customer_name}\n\nPayment: Cash on delivery`;
      await sendButtons(deps, body, [
        { id: "confirm_yes", title: "✅ Confirm" },
        { id: "confirm_edit", title: "Edit" },
        { id: "confirm_cancel", title: "Cancel" },
      ]);
      return;
    }
  }
}

async function finalizeBill(deps: RestaurantFlowDeps, session: Session): Promise<void> {
  const d = session.draft;
  // Dedup: same total in last 5 minutes
  const { data: recent } = await deps.supabase
    .from("bills").select("id,display_id,total,created_at")
    .eq("tenant_id", deps.tenantId).eq("contact_id", deps.contactId)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(5);
  const dup = (recent || []).find((b: any) => Math.abs(Number(b.total) - d.total) < 0.01);
  if (dup) {
    session.state = "done";
    await saveSession(deps.supabase, session);
    const ref = dup.display_id ? `#${dup.display_id}` : `#${dup.id.slice(0, 4)}`;
    await sendText(deps, `Your order is already placed (${ref}). We'll be in touch soon.`);
    return;
  }

  const { data: bill, error } = await deps.supabase.from("bills").insert({
    tenant_id: deps.tenantId,
    contact_id: deps.contactId,
    customer_name: d.customer_name,
    customer_phone: deps.phoneNumber,
    order_type: d.order_type,
    delivery_address: d.delivery_address ?? null,
    delivery_fee: d.order_type === "delivery" ? deps.deliveryFee : 0,
    payment_method: "cod",
    total: d.total,
    currency: deps.currency,
    status: "new",
    source: "ai",
  }).select().single();

  if (error || !bill) {
    console.error("finalizeBill failed", error);
    await sendText(deps, "Sorry, something went wrong saving your order. Please try again.");
    return;
  }

  await deps.supabase.from("bill_items").insert(d.items.map((i) => ({
    bill_id: bill.id,
    menu_item_id: i.menu_item_id,
    name: i.name,
    qty: i.qty,
    unit_price: i.unit_price,
  })));

  // Notify kitchen
  if (deps.kitchenNotifyPhone) {
    const orderRef = bill.display_id ? `#${bill.display_id}` : `#${bill.id.slice(0, 4)}`;
    const ticket =
      `🍽 New order ${orderRef} (${d.order_type})\n` +
      d.items.map((i) => `• ${i.qty}× ${i.name}`).join("\n") +
      `\nTotal: ${deps.currency} ${d.total.toFixed(2)}` +
      (d.delivery_address ? `\nAddress: ${d.delivery_address}` : "") +
      `\nCustomer: ${d.customer_name} (${deps.phoneNumber})`;
    fetch(`https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: deps.kitchenNotifyPhone, type: "text", text: { body: ticket } }),
    }).catch(() => {});
  }

  session.state = "done";
  await saveSession(deps.supabase, session);

  const orderRef = bill.display_id ? `#${bill.display_id}` : `#${bill.id.slice(0, 4)}`;
  const etaLine = d.order_type === "delivery" ? ` ETA: ${deps.etaText}.` : d.order_type === "pickup" ? " Ready for pickup soon." : "";
  await sendText(deps, `✅ Order confirmed (${orderRef})!\nTotal: ${deps.currency} ${d.total.toFixed(2)}.${etaLine}`);
}

// Tool definition for the AI
export const START_RESTAURANT_ORDER_TOOL = {
  type: "function",
  function: {
    name: "start_restaurant_order",
    description: "Start the deterministic order flow. Call this AS SOON AS the customer indicates they want to order food (delivery/pickup/dine-in). Do NOT call for reservations or general menu questions.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};
