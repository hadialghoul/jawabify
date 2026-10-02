import { getOnlinePaymentLink, onlinePaymentPrompt } from "./online-payment.ts";
// Service business flow (agencies, consultants, trainers, travel…).
// Invoked only when tenant.vertical === 'service'. Shares the booking tables with
// wellness (guard_wellness_only allows 'service') but has its own wording:
// services + calls/meetings/appointments, no staff selection, no package upsell.

import {
  getActiveWellnessSession,
  handleWellnessSessionMessage,
  startWellnessFlow,
  START_WELLNESS_BOOKING_TOOL,
  type WellnessFlowDeps,
} from "./wellness-flow.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function sendText(phoneNumberId: string, accessToken: string, to: string, body: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return res.ok;
  } catch (e) { console.error("service sendText", e); return false; }
}

async function getSettings(supabase: any, tenantId: string) {
  const { data } = await supabase.from("wellness_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data ?? {
    currency: "USD", bot_tone: "calm", languages: ["en", "ar", "fr"],
    session_duration_min: 60, reminder_hours_before: 24, second_reminder_hours_before: 2, followup_hours_after: 24,
    calendly_url: null, payment_link: null, google_sheet_url: null, crm_webhook_url: null, human_transfer_phone: null,
  };
}

async function getOrCreateLead(supabase: any, tenantId: string, contactId: string) {
  const { data: existing } = await supabase
    .from("wellness_leads").select("*")
    .eq("tenant_id", tenantId).eq("contact_id", contactId)
    .not("status", "in", "(closed_won,closed_lost)")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing;
  const { data } = await supabase.from("wellness_leads").insert({
    tenant_id: tenantId, contact_id: contactId, status: "new", source: "ai",
  }).select().single();
  return data;
}

async function loadServices(supabase: any, tenantId: string) {
  const { data } = await supabase.from("wellness_services").select("*").eq("tenant_id", tenantId).eq("active", true).limit(200);
  return data ?? [];
}

// Knowledge the owner imported (website services, about paragraph, files, text).
async function loadKnowledge(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("ai_knowledge").select("title,content")
    .eq("tenant_id", tenantId).eq("is_active", true)
    .limit(60);
  const parts = (data || [])
    .map((k: any) => `${k.title ? `${k.title}: ` : ""}${k.content || ""}`.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.join("\n---\n").slice(0, 12000);
}


const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_NAMES: Record<string,string> = {mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat",sun:"Sun"};
function hoursText(h: any): string {
  if (!h || typeof h !== "object") return "";
  return DAYS.filter((d) => h[d]).map((d) => {
    const x = h[d];
    return `- ${DAY_NAMES[d]}: ${x.closed ? "Closed" : `${x.open || "?"}–${x.close || "?"}`}`;
  }).join("\n");
}

function toneLine(tone: string) {
  switch (tone) {
    case "energetic": return "Tone: friendly, warm, approachable.";
    case "luxury": return "Tone: premium, polished, concierge-level.";
    default: return "Tone: professional, clear, helpful.";
  }
}

function buildSystemPrompt(ws: any, services: any[], knowledge = "") {
  const langs = (ws.languages || ["en"]).join("/");
  const svcList = services.slice(0, 40).map((s: any) =>
    `- ${s.name}${s.duration_min ? ` · ${s.duration_min}min` : ""}${s.price != null ? ` · ${s.currency} ${s.price}` : ""}${s.category ? ` · ${s.category}` : ""}`
  ).join("\n") || "(none configured)";

  return `You are the WhatsApp assistant for a service business. Reply in ${langs} matching the customer's language.
${toneLine(ws.bot_tone)}

ABSOLUTE RULES:
- One short sentence per reply (max ~15 words) EXCEPT when listing services or confirming a booking.
- NEVER invent services, prices, durations, or availability. Only use the services list, the business info below, or what the tools return.
- NEVER auto-fill customer info — always ask.
- Never offer products, shipping, or delivery: this business sells services, not goods.
- Talk ONLY about this business's services and booking them. For anything else (products, unrelated topics, chit-chat beyond a greeting), politely steer back to the services or hand off to a human.

SERVICES OFFERED:
${svcList}
${knowledge ? `BUSINESS INFO & SERVICE DETAILS (owner-provided, may include services imported from the website):\n${knowledge}\n` : ""}
${ws.address ? `LOCATION: ${ws.address}` : ""}
${ws.maps_url ? `MAP LINK: ${ws.maps_url}` : ""}
${hoursText(ws.opening_hours) ? `OPENING HOURS (${ws.timezone || "Asia/Beirut"} time):\n${hoursText(ws.opening_hours)}` : ""}
If asked about location or hours and they are not listed above, say you'll check and hand off — never guess.
${ws.calendly_url ? `BOOKING LINK: ${ws.calendly_url}` : ""}
${ws.payment_link ? `PAYMENT LINK: ${ws.payment_link}` : ""}


==== FLOW ====

STEP 1 — GREETING + WHAT THEY NEED
Greet briefly and ask which service they're interested in. Save it via set_lead_interest.

STEP 2 — DETAILS + PRICE
Give what it covers, how long it takes and the price. Call match_services when unsure.

STEP 3 — BOOK THE CALL / MEETING / APPOINTMENT (programmatic, not you)
As SOON as the customer wants to book, schedule, or arrange a call or meeting, call start_wellness_booking.
The tool takes over: it lists services, picks a date, picks a time, asks for their name and confirms.
Do NOT collect date, time or name yourself after calling it, and do NOT call book_session.
While that flow is active, the customer's messages go to it (you will not see them).

STEP 4 — REMINDERS (automatic)
The system sends reminders before the appointment. You do NOT need to send them.

STEP 5 — REBOOKING
If they want another call or meeting, call start_wellness_booking again.

==== HANDOFF ====
Call handover_to_human(reason) when:
- Customer asks for a real person / manager
- Complaint or angry tone
- Custom quote, large project, or anything not in the service list
- Anything off-topic / out of scope
Reasons: "human_request" | "complaint" | "vip" | "off_topic" | "other".
After handoff, do NOT continue. Tell the customer a human will reach out shortly.

Reply now.`;
}

const TOOLS = [
  { type: "function", function: { name: "set_lead_interest", description: "Save which service the customer is interested in.",
    parameters: { type: "object", properties: { interest: { type: "string" } }, required: ["interest"], additionalProperties: false } } },
  { type: "function", function: { name: "match_services", description: "Find services matching a query (name/category).",
    parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "handover_to_human", description: "Escalate to a human.",
    parameters: { type: "object", properties: {
      reason: { type: "string", enum: ["human_request", "complaint", "vip", "off_topic", "other"] },
      summary: { type: "string" },
    }, required: ["reason", "summary"], additionalProperties: false } } },
  START_WELLNESS_BOOKING_TOOL,
];

function buildDeps(ctx: any, history: any[]): WellnessFlowDeps {
  const { supabase, tenantId, contact, phoneNumber, services, ws, lead } = ctx;
  return {
    supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
    phoneNumberId: ctx.tenantPhoneNumberId, accessToken: ctx.tenantAccessToken,
    services: services.map((s: any) => ({
      id: s.id, name: s.name, price: s.price ?? null,
      currency: s.currency ?? ws.currency, duration_min: s.duration_min ?? null, category: s.category ?? null,
    })),
    staff: [],
    currency: ws.currency || "USD",
    defaultDurationMin: ws.session_duration_min ?? 60,
    reminderHoursBefore: ws.reminder_hours_before ?? 24,
    followupHoursAfter: ws.followup_hours_after ?? 24,
    openHour: ws.open_hour ?? 9,
    closeHour: ws.close_hour ?? 19,
    slotStepMin: ws.slot_step_min ?? 60,
    staffNotifyPhone: ws.human_transfer_phone || null,
    lovableApiKey: LOVABLE_API_KEY,
    conversationHistory: history,
  };
}

async function execTool(name: string, args: any, ctx: any): Promise<string> {
  const { supabase, contact, phoneNumber, services, ws, lead } = ctx;

  if (name === "start_wellness_booking") {
    const started = await startWellnessFlow(buildDeps(ctx, ctx.conversationHistory));
    if (started) ctx.flowStarted = true;
    return started ? "__FLOW_STARTED__" : "Could not start booking flow.";
  }

  if (name === "set_lead_interest") {
    await supabase.from("wellness_leads").update({ interest: args.interest, status: "qualified" }).eq("id", lead.id);
    ctx.lead.interest = args.interest;
    return `Saved interest=${args.interest}.`;
  }

  if (name === "match_services") {
    const q = String(args.query || "").toLowerCase();
    const hits = services.filter((s: any) =>
      !q || s.name?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q)
    ).slice(0, 5);
    if (!hits.length) return "No matching services. Offer alternatives or handoff.";
    return hits.map((s: any) => `• ${s.name}${s.duration_min ? ` · ${s.duration_min}min` : ""}${s.price != null ? ` · ${s.currency} ${s.price}` : ""}`).join("\n");
  }

  if (name === "handover_to_human") {
    const target = ws.human_transfer_phone;
    if (target) {
      await sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, target,
        `🔔 Handoff (${args.reason}) from ${contact.name || phoneNumber}: ${args.summary}`);
    }
    await supabase.from("wellness_leads").update({ needs_human: true, handoff_reason: args.reason }).eq("id", lead.id);
    return `Handoff flagged. Tell customer a human will reply shortly. Do NOT continue.`;
  }

  return "Unknown tool.";
}

export async function runServiceFlow(opts: {
  supabase: any; tenantId: string; contact: any; phoneNumber: string;
  tenantPhoneNumberId: string; tenantAccessToken: string;
  messageText?: string | null;
  interactiveReplyId?: string | null;
}) {
  const { supabase, tenantId, contact, phoneNumber, tenantPhoneNumberId, tenantAccessToken } = opts;
  if (!LOVABLE_API_KEY) { console.error("service: LOVABLE_API_KEY not set"); return; }

  const [ws, services, lead, knowledge] = await Promise.all([
    getSettings(supabase, tenantId),
    loadServices(supabase, tenantId),
    getOrCreateLead(supabase, tenantId, contact.id),
    loadKnowledge(supabase, tenantId),
  ]);

  const { data: recent } = await supabase
    .from("messages").select("content,direction").eq("contact_id", contact.id)
    .order("created_at", { ascending: false }).limit(10);
  const history = (recent || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" : "assistant",
    content: m.content,
  }));

  const ctx: any = {
    supabase, tenantId, contact, phoneNumber, services, ws, lead,
    tenantPhoneNumberId, tenantAccessToken, conversationHistory: history,
    flowStarted: false,
  };

  // 1) Resume an active programmatic booking flow if one exists.
  const activeSession = await getActiveWellnessSession(supabase, tenantId, contact.id);
  if (activeSession) {
    await handleWellnessSessionMessage(
      buildDeps(ctx, history), activeSession as any,
      opts.messageText ?? null, opts.interactiveReplyId ?? null,
    );
    return;
  }

  const systemPrompt = buildSystemPrompt(ws, services, knowledge);
  const __payLink = await getOnlinePaymentLink(supabase, tenantId).catch(() => null);
  let messages: any[] = [{ role: "system", content: systemPrompt + onlinePaymentPrompt(__payLink) }, ...history];
  let finalReply = "";

  for (let turn = 0; turn < 5; turn++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages, tools: TOOLS, tool_choice: "auto" }),
    });
    if (!res.ok) { console.error("service AI error", res.status, await res.text()); break; }
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) break;
    if (msg.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
        const out = await execTool(tc.function.name, args, ctx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: out });
      }
      continue;
    }
    finalReply = msg.content || "";
    break;
  }

  // If the AI started the deterministic booking flow, it already replied.
  if (ctx.flowStarted) return;

  if (!finalReply) finalReply = "Sorry, can you say that again?";
  const ok = await sendText(tenantPhoneNumberId, tenantAccessToken, phoneNumber, finalReply);
  await supabase.from("messages").insert({
    contact_id: contact.id, content: finalReply, direction: "outgoing", status: ok ? "sent" : "failed",
  });
}
