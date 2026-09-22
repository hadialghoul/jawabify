// Restaurant vertical flow — isolated from the e-commerce path.
// Only invoked when tenant.vertical === 'restaurant'. Never touches `orders`
// or e-commerce tools. Writes go to `bills` / `reservations` only.

import {
  getActiveRestaurantSession,
  handleRestaurantSessionMessage,
  startRestaurantFlow,
  START_RESTAURANT_ORDER_TOOL,
  type RestaurantFlowDeps,
} from "./restaurant-flow.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function sendText(phoneNumberId: string, accessToken: string, to: string, body: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return res.ok;
  } catch (e) {
    console.error("restaurant sendText error", e);
    return false;
  }
}

async function loadMenu(supabase: any, tenantId: string) {
  const [{ data: cats }, { data: items }, { data: mods }] = await Promise.all([
    supabase.from("menu_categories").select("id,name,sort_order").eq("tenant_id", tenantId).order("sort_order"),
    supabase.from("menu_items").select("id,category_id,name,description,price,currency,is_available").eq("tenant_id", tenantId),
    supabase.from("menu_item_modifiers").select("id,menu_item_id,group_name,required,max_select,options").eq("tenant_id", tenantId),
  ]);
  return {
    categories: cats ?? [],
    items: (items ?? []).filter((i: any) => i.is_available !== false),
    modifiers: mods ?? [],
  };
}

function formatMenuForPrompt(menu: any) {
  if (!menu.items.length) return "(menu is empty — tell the customer the menu isn't ready yet)";
  const byCat: Record<string, any[]> = {};
  for (const it of menu.items) {
    const cat = menu.categories.find((c: any) => c.id === it.category_id);
    const key = cat?.name || "Other";
    (byCat[key] ||= []).push(it);
  }
  const lines: string[] = [];
  for (const [cat, its] of Object.entries(byCat)) {
    lines.push(`### ${cat}`);
    for (const it of its) {
      const itemMods = menu.modifiers.filter((m: any) => m.menu_item_id === it.id);
      const modStr = itemMods.length
        ? ` [modifiers: ${itemMods.map((m: any) => {
            const opts = (m.options || []).map((o: any) => `${o.name}${o.price_delta ? ` +${o.price_delta}` : ""}`).join("/");
            return `${m.group_name}(${opts})${m.required ? "*" : ""}`;
          }).join("; ")}]`
        : "";
      lines.push(`- ${it.name} — ${it.currency} ${Number(it.price).toFixed(2)}${it.description ? ` — ${it.description}` : ""}${modStr}`);
    }
  }
  return lines.join("\n");
}

async function getDeliveryFee(supabase: any, tenantId: string): Promise<number> {
  const { data } = await supabase.from("app_settings").select("value").eq("tenant_id", tenantId).eq("key", "default_delivery_fee").maybeSingle();
  const raw = data?.value;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "3"));
  return isNaN(n) ? 3 : n;
}

async function getUpsellEnabled(supabase: any, tenantId: string): Promise<boolean> {
  // Settings → AI Auto-Replies → "AI upselling & recommendations" is the source of
  // truth (`ai_upsell_enabled`); the legacy restaurant-only key is the fallback.
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .eq("tenant_id", tenantId)
    .in("key", ["ai_upsell_enabled", "restaurant_upsell_enabled"]);
  const pick = (k: string) => (data || []).find((r: any) => r.key === k)?.value;
  const primary = pick("ai_upsell_enabled");
  if (primary !== undefined && primary !== null) return primary === true || primary === "true";
  const legacy = pick("restaurant_upsell_enabled");
  if (legacy === false || legacy === "false") return false;
  return legacy === true || legacy === "true";
}


async function getRestaurantSettings(supabase: any, tenantId: string) {
  const { data } = await supabase.from("restaurant_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data ?? {
    eta_text: "30-45 min",
    daily_specials: null,
    opening_hours: {},
    max_party_size: 10,
    reminder_hours_before: 2,
    kitchen_notify_phone: null,
    human_transfer_phone: null,
  };
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isWithinOpeningHours(hours: any, iso: string): { ok: boolean; reason?: string } {
  if (!hours || typeof hours !== "object") return { ok: true };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { ok: false, reason: "invalid_date" };
  const key = DAY_KEYS[d.getUTCDay()]; // best effort; tenants set tz-aware text anyway
  const h = hours[key];
  if (!h) return { ok: true };
  if (h.closed) return { ok: false, reason: "closed_that_day" };
  const [oh, om] = String(h.open || "00:00").split(":").map(Number);
  const [ch, cm] = String(h.close || "23:59").split(":").map(Number);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const openMins = oh * 60 + om;
  let closeMins = ch * 60 + cm;
  if (closeMins <= openMins) closeMins += 24 * 60;
  const adj = mins < openMins ? mins + 24 * 60 : mins;
  if (adj < openMins || adj > closeMins) return { ok: false, reason: "outside_hours" };
  return { ok: true };
}

function buildSystemPrompt(menuText: string, deliveryFee: number, currency: string, upsellEnabled: boolean, rs: any) {
  const hoursStr = rs.opening_hours && Object.keys(rs.opening_hours).length
    ? Object.entries(rs.opening_hours).map(([d, h]: any) => h?.closed ? `${d}: closed` : `${d}: ${h.open}-${h.close}`).join(", ")
    : "(not set)";
  return `You are a restaurant WhatsApp assistant. Speak Lebanese Arabic / Arabizi by default unless the customer writes in English/French.

ABSOLUTE RULES:
- Keep replies ONE short sentence (max ~15 words) EXCEPT when listing the menu or reading back an order summary.
- NEVER invent menu items, prices, or modifiers. ONLY use what's listed below.
- NEVER auto-fill customer info — always ask.
- When the customer asks to see menu, list items grouped by category.

DELIVERY FEE: ${currency} ${deliveryFee.toFixed(2)} (applies ONLY to delivery orders).
ESTIMATED DELIVERY TIME: ${rs.eta_text || "30-45 min"}.
OPENING HOURS: ${hoursStr}.
MAX PARTY SIZE (auto-handoff above this): ${rs.max_party_size}.
${rs.daily_specials ? `DAILY SPECIALS: ${rs.daily_specials}` : ""}

==== STEP-BY-STEP FLOW ====

STEP 1 — GREET + INTENT
First message of a new conversation: "Ahla! Table reservation, dine-in, delivery, aw pickup?"
Once intent is known, never re-ask.

STEP 2 — ORDER FLOW (CRITICAL — programmatic, not you)
As SOON as the customer says they want to order food (delivery / pickup / dine-in), call the tool start_restaurant_order.
The tool takes over: it shows the menu, takes the items, asks for quantity, address, name, and confirms the order — deterministically. You do NOT take the order yourself, do NOT call create_bill, and do NOT collect items / address / name once you've called start_restaurant_order.
While the programmatic flow is active, any new messages from the customer are routed to that flow (you will not see them).

STEP 3 — MENU QUESTIONS (before the flow starts)
If they ask "what's on the menu?" / "shu 3andkon" → list categories + items + prices from the menu below.
Answer ingredient / size / extra questions from the menu data only.

STEP 4 — UPSELL (no longer your job)
${upsellEnabled ? "Upsell happens inside the programmatic flow." : "Upsell is disabled."}

STEP 5 — RESERVATIONS (still your job)
For reservations: collect guest_name, party_size, starts_at (ISO timestamp), and ALWAYS ask once for special requests (birthday, high chair, allergies). Put those into notes.
If party_size > max party size above → call handover_to_human with reason "large_group" instead of create_reservation.

STEP 6 — HANDOFF
Call handover_to_human(reason) when:
- Customer requests something off-menu / custom catering
- Customer is complaining, angry, or asks for a manager
- Customer self-identifies as VIP / regular requesting special treatment
- Party size exceeds the limit above
Use reasons: "custom_request" | "complaint" | "vip" | "large_group".
After handoff, do not continue taking the order; tell the customer a human will reply shortly.

==== MENU ====
${menuText}
==== END MENU ====

Reply now in the customer's language.`;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_menu",
      description: "Returns the current menu (categories, items, modifiers). Call when the customer asks to see the menu or asks about an item you don't recognize.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_upsell",
      description: "Suggest one cross-category upsell item. Call ONCE per order, after at least one item is added.",
      parameters: {
        type: "object",
        properties: { current_item_names: { type: "array", items: { type: "string" } } },
        required: ["current_item_names"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description: "Book a table reservation. Validates opening hours and max party size.",
      parameters: {
        type: "object",
        properties: {
          guest_name: { type: "string" },
          guest_phone: { type: "string" },
          party_size: { type: "number" },
          starts_at: { type: "string", description: "ISO 8601 timestamp" },
          notes: { type: "string", description: "Special requests: birthday, high chair, allergies, etc." },
        },
        required: ["guest_name", "party_size", "starts_at"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_bill",
      description: "Finalize the order after the customer confirmed the summary.",
      parameters: {
        type: "object",
        properties: {
          order_type: { type: "string", enum: ["dine_in", "pickup", "delivery"] },
          customer_name: { type: "string" },
          customer_phone: { type: "string" },
          delivery_address: { type: "string", description: "Required if order_type=delivery" },
          payment_method: { type: "string", enum: ["cod", "link"] },
          notes: { type: "string" },
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                menu_item_name: { type: "string" },
                qty: { type: "number" },
                unit_price: { type: "number", description: "Final per-unit price including modifier deltas" },
                modifiers: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
              },
              required: ["menu_item_name", "qty", "unit_price"],
            },
          },
        },
        required: ["order_type", "customer_name", "items", "payment_method"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "handover_to_human",
      description: "Escalate the conversation to a human staff member. Use for custom requests, complaints, VIP customers, or oversized parties.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", enum: ["custom_request", "complaint", "vip", "large_group", "other"] },
          summary: { type: "string", description: "Short summary of what the customer wants." },
        },
        required: ["reason", "summary"],
        additionalProperties: false,
      },
    },
  },
  START_RESTAURANT_ORDER_TOOL,
];

async function execTool(name: string, args: any, ctx: any): Promise<string> {
  const { supabase, tenantId, contact, phoneNumber, menu, rs } = ctx;

  if (name === "start_restaurant_order") {
    const deps: RestaurantFlowDeps = {
      supabase,
      tenantId,
      contactId: contact.id,
      phoneNumber,
      phoneNumberId: ctx.tenantPhoneNumberId,
      accessToken: ctx.tenantAccessToken,
      menu: menu.items.map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price), description: m.description })),
      currency: ctx.currency,
      deliveryFee: ctx.deliveryFee,
      etaText: rs.eta_text || "30-45 min",
      kitchenNotifyPhone: rs.kitchen_notify_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: ctx.conversationHistory,
    };
    const started = await startRestaurantFlow(deps);
    if (started) ctx.flowStarted = true;
    return started ? "__FLOW_STARTED__" : "Could not start order flow.";
  }

  if (name === "get_menu") return formatMenuForPrompt(menu);

  if (name === "suggest_upsell") {
    const have = new Set((args.current_item_names || []).map((s: string) => s.toLowerCase()));
    const candidate = menu.items.find((i: any) => !have.has(i.name.toLowerCase()));
    if (!candidate) return "No upsell candidate available — skip.";
    return `Suggest: ${candidate.name} (${candidate.currency} ${Number(candidate.price).toFixed(2)}). Mark upsell as used.`;
  }

  if (name === "handover_to_human") {
    const target = rs.human_transfer_phone;
    if (target) {
      await sendText(
        ctx.tenantPhoneNumberId,
        ctx.tenantAccessToken,
        target,
        `🔔 Handoff (${args.reason}) from ${contact.name || phoneNumber}: ${args.summary}`,
      );
    }
    ctx.handoff = { reason: args.reason, summary: args.summary };
    return `Handoff flagged (${args.reason}). Tell the customer a human will reply shortly. Do NOT continue order taking.`;
  }

  if (name === "create_reservation") {
    if (args.party_size > (rs.max_party_size ?? 10)) {
      return `Party of ${args.party_size} exceeds the max (${rs.max_party_size}). Call handover_to_human with reason "large_group" instead.`;
    }
    const hoursCheck = isWithinOpeningHours(rs.opening_hours, args.starts_at);
    if (!hoursCheck.ok) {
      return `Requested time is outside opening hours (${hoursCheck.reason}). Politely propose another time within hours, do not create.`;
    }
    const startsAt = new Date(args.starts_at);
    const reminderAt = new Date(startsAt.getTime() - (rs.reminder_hours_before ?? 2) * 60 * 60 * 1000);
    const { data, error } = await supabase.from("reservations").insert({
      tenant_id: tenantId,
      contact_id: contact.id,
      guest_name: args.guest_name,
      guest_phone: args.guest_phone || phoneNumber,
      party_size: args.party_size,
      starts_at: args.starts_at,
      notes: args.notes ?? null,
      reminder_at: reminderAt.toISOString(),
      status: "confirmed",
      source: "ai",
    }).select().single();
    if (error) return `Failed: ${error.message}`;
    return `Reservation booked for ${args.guest_name}, party of ${args.party_size}, at ${args.starts_at}.`;
  }

  if (name === "create_bill") {
    const itemsResolved = (args.items || []).map((it: any) => {
      const m = menu.items.find((mi: any) => mi.name.toLowerCase() === String(it.menu_item_name).toLowerCase());
      return {
        menu_item_id: m?.id ?? null,
        name: it.menu_item_name,
        qty: it.qty,
        unit_price: it.unit_price,
        modifiers: it.modifiers ?? [],
        notes: it.notes ?? null,
      };
    });
    const subtotal = itemsResolved.reduce((s: number, i: any) => s + i.qty * i.unit_price, 0);
    const deliveryFee = args.order_type === "delivery" ? ctx.deliveryFee : 0;
    const total = subtotal + deliveryFee;
    const currency = menu.items[0]?.currency || "USD";

    const { data: recent } = await supabase
      .from("bills").select("id,created_at,total,display_id")
      .eq("tenant_id", tenantId).eq("contact_id", contact.id)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(5);
    const dup = (recent || []).find((b: any) => Math.abs(Number(b.total) - total) < 0.01);
    if (dup) return `Order already created (#${dup.display_id ?? dup.id.slice(0, 4)}). Don't create again.`;

    const { data: bill, error } = await supabase.from("bills").insert({
      tenant_id: tenantId,
      contact_id: contact.id,
      customer_name: args.customer_name,
      customer_phone: args.customer_phone || phoneNumber,
      order_type: args.order_type,
      delivery_address: args.delivery_address ?? null,
      delivery_fee: deliveryFee,
      payment_method: args.payment_method,
      notes: args.notes ?? null,
      total,
      currency,
      status: "new",
      source: "ai",
    }).select().single();
    if (error) return `Failed: ${error.message}`;
    await supabase.from("bill_items").insert(itemsResolved.map((i: any) => ({
      bill_id: bill.id,
      menu_item_id: i.menu_item_id,
      name: i.name + (i.modifiers?.length ? ` (${i.modifiers.join(", ")})` : ""),
      qty: i.qty,
      unit_price: i.unit_price,
    })));

    // Notify kitchen if configured
    if (rs.kitchen_notify_phone) {
      const ticket = `🍽 New order #${bill.display_id ?? bill.id.slice(0, 4)} (${args.order_type})\n` +
        itemsResolved.map((i: any) => `• ${i.qty}× ${i.name}`).join("\n") +
        `\nTotal: ${currency} ${total.toFixed(2)}` +
        (args.delivery_address ? `\nAddress: ${args.delivery_address}` : "");
      sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, rs.kitchen_notify_phone, ticket).catch(() => {});
    }

    const orderRef = bill.display_id ? `#${bill.display_id}` : `#${bill.id.slice(0, 4)}`;
    const etaLine = args.order_type === "delivery" ? ` ETA: ${rs.eta_text || "30-45 min"}.` : "";
    return `Order placed (${orderRef}). Subtotal ${currency} ${subtotal.toFixed(2)}${deliveryFee ? ` + delivery ${currency} ${deliveryFee.toFixed(2)}` : ""}. Total ${currency} ${total.toFixed(2)}.${etaLine} Tell the customer the order number and ETA.`;
  }

  return "Unknown tool.";
}

export async function runRestaurantFlow(opts: {
  supabase: any;
  tenantId: string;
  contact: any;
  phoneNumber: string;
  tenantPhoneNumberId: string;
  tenantAccessToken: string;
  messageText?: string | null;
  interactiveReplyId?: string | null;
}) {
  const { supabase, tenantId, contact, phoneNumber, tenantPhoneNumberId, tenantAccessToken } = opts;
  if (!LOVABLE_API_KEY) {
    console.error("restaurant: LOVABLE_API_KEY not set");
    return;
  }

  const [menu, deliveryFee, upsellEnabled, rs] = await Promise.all([
    loadMenu(supabase, tenantId),
    getDeliveryFee(supabase, tenantId),
    getUpsellEnabled(supabase, tenantId),
    getRestaurantSettings(supabase, tenantId),
  ]);
  const currency = menu.items[0]?.currency || "USD";

  // 1) Resume active programmatic order flow if one exists.
  const activeSession = await getActiveRestaurantSession(supabase, tenantId, contact.id);
  if (activeSession) {
    const { data: recent } = await supabase
      .from("messages").select("content,direction").eq("contact_id", contact.id)
      .order("created_at", { ascending: false }).limit(10);
    const history = (recent || []).reverse().map((m: any) => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.content,
    }));
    const deps: RestaurantFlowDeps = {
      supabase, tenantId, contactId: contact.id, phoneNumber,
      phoneNumberId: tenantPhoneNumberId, accessToken: tenantAccessToken,
      menu: menu.items.map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price), description: m.description })),
      currency, deliveryFee, etaText: rs.eta_text || "30-45 min",
      kitchenNotifyPhone: rs.kitchen_notify_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: history,
    };
    await handleRestaurantSessionMessage(deps, activeSession as any, opts.messageText ?? null, opts.interactiveReplyId ?? null);
    return;
  }

  const systemPrompt = buildSystemPrompt(formatMenuForPrompt(menu), deliveryFee, currency, upsellEnabled, rs);

  const { data: recent } = await supabase
    .from("messages").select("content,direction").eq("contact_id", contact.id)
    .order("created_at", { ascending: false }).limit(10);
  const history = (recent || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" : "assistant",
    content: m.content,
  }));

  const ctx: any = {
    supabase, tenantId, contact, phoneNumber, menu, deliveryFee, currency, rs,
    tenantPhoneNumberId, tenantAccessToken, conversationHistory: history,
    handoff: null, flowStarted: false,
  };

  let messages: any[] = [{ role: "system", content: systemPrompt }, ...history];
  let finalReply = "";

  for (let turn = 0; turn < 4; turn++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });
    if (!res.ok) {
      console.error("restaurant AI error", res.status, await res.text());
      break;
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) break;

    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch {}
        const out = await execTool(tc.function.name, args, ctx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: out });
      }
      continue;
    }

    finalReply = msg.content || "";
    break;
  }

  // If the AI started the deterministic flow, it already sent the first prompt.
  if (ctx.flowStarted) return;

  if (!finalReply) finalReply = "Lahza, ma fhemet — jarrib taani.";



  const ok = await sendText(tenantPhoneNumberId, tenantAccessToken, phoneNumber, finalReply);
  await supabase.from("messages").insert({
    contact_id: contact.id,
    content: finalReply,
    direction: "outgoing",
    status: ok ? "sent" : "failed",
  });
}
