// Wellness vertical flow — isolated from ecommerce/restaurant/real_estate.
// Invoked only when tenant.vertical === 'wellness'. Writes only to wellness_*
// tables (each guarded by guard_wellness_only trigger).

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
  } catch (e) { console.error("wellness sendText", e); return false; }
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
async function loadStaff(supabase: any, tenantId: string) {
  const { data } = await supabase.from("wellness_staff").select("*").eq("tenant_id", tenantId).eq("active", true);
  return data ?? [];
}
async function loadPackages(supabase: any, tenantId: string) {
  const { data } = await supabase.from("wellness_packages").select("*").eq("tenant_id", tenantId).eq("active", true);
  return data ?? [];
}

function toneLine(tone: string) {
  switch (tone) {
    case "energetic": return "Tone: upbeat, motivating, uses light exclamation marks.";
    case "luxury": return "Tone: refined, polished, premium spa concierge.";
    default: return "Tone: calm, warm, reassuring.";
  }
}

function buildSystemPrompt(ws: any, services: any[], packages: any[]) {
  const langs = (ws.languages || ["en"]).join("/");
  const svcList = services.slice(0, 30).map((s: any) =>
    `- ${s.name} · ${s.duration_min}min${s.price != null ? ` · ${s.currency} ${s.price}` : ""}${s.category ? ` · ${s.category}` : ""}`
  ).join("\n") || "(none configured)";
  const pkgList = packages.slice(0, 20).map((p: any) => {
    const ids: string[] = (p.service_ids && p.service_ids.length) ? p.service_ids : (p.service_id ? [p.service_id] : []);
    const svcNames = ids.map((id) => services.find((s: any) => s.id === id)?.name).filter(Boolean).join(" + ");
    return `- ${p.name} · ${p.sessions_count} sessions${p.price != null ? ` · ${p.currency} ${p.price}` : ""}${svcNames ? ` · includes: ${svcNames}` : ""}`;
  }).join("\n") || "(none)";

  return `You are a wellness studio WhatsApp assistant. Reply in ${langs} matching the customer's language.
${toneLine(ws.bot_tone)}

ABSOLUTE RULES:
- One short sentence per reply (max ~15 words) EXCEPT when listing services or confirming a booking.
- NEVER invent services, prices, staff, or slots. Only use what tools return.
- NEVER auto-fill customer info — always ask.

SERVICES OFFERED:
${svcList}

PACKAGES:
${pkgList}
${ws.calendly_url ? `CALENDLY: ${ws.calendly_url}` : ""}
${ws.payment_link ? `PAYMENT LINK: ${ws.payment_link}` : ""}

==== 6-STEP FLOW ====

STEP 1 — GREETING + SERVICE QUALIFIER
Greet briefly and ask what service they want (e.g. "Massage, facial, or yoga?"). Save via set_lead_interest.

STEP 2 — SERVICE DETAILS + PRICING
Share duration, price, and any therapist/instructor options when relevant. Call match_services if needed.

==== 6-STEP FLOW ====

STEP 1 — GREETING + SERVICE QUALIFIER
Greet briefly and ask what service they want (e.g. "Massage, facial, or yoga?"). Save via set_lead_interest.

STEP 2 — SERVICE DETAILS + PRICING
Share duration, price, and any therapist/instructor options when relevant. Call match_services if needed.

STEP 3 — BOOK SESSION (CRITICAL — programmatic, not you)
As SOON as the customer says they want to book / reserve / schedule, call the tool start_wellness_booking.
The tool takes over: it shows services, picks a date, picks a time, asks for name, and confirms — deterministically.
You do NOT take the booking yourself, do NOT call book_session, and do NOT collect date/time/name once you've called start_wellness_booking.
While the programmatic flow is active, any new messages from the customer are routed to that flow (you will not see them).

STEP 4 — PACKAGE UPSELL (after the flow finishes)
After a booking is confirmed (the user comes back asking about more sessions), briefly offer the best matching package — one short upsell sentence. Call propose_package then await reply.

STEP 5 — REMINDERS (automatic)
The system sends a 24h and 2h reminder. You do NOT need to send them.

STEP 6 — RENEWAL / REBOOKING
If the customer wants to rebook, call start_wellness_booking again.

==== HANDOFF ====
Call handover_to_human(reason) when:
- Customer asks for a real person / manager
- Complaint or angry tone
- VIP / out-of-catalog request
- Anything off-topic / out of scope
Reasons: "human_request" | "complaint" | "vip" | "off_topic" | "other".
After handoff, do NOT continue. Tell the customer a human will reach out shortly.

Reply now.`;
}

const TOOLS = [
  { type: "function", function: { name: "set_lead_interest", description: "Save what service the customer is interested in.",
    parameters: { type: "object", properties: { interest: { type: "string" } }, required: ["interest"], additionalProperties: false } } },
  { type: "function", function: { name: "match_services", description: "Find services matching a query (name/category).",
    parameters: { type: "object", properties: { query: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "book_session", description: "Book a session.",
    parameters: { type: "object", properties: {
      service_name: { type: "string" }, staff_name: { type: "string" }, guest_name: { type: "string" },
      scheduled_at: { type: "string", description: "ISO 8601 timestamp" }, notes: { type: "string" },
    }, required: ["service_name", "guest_name", "scheduled_at"], additionalProperties: false } } },
  { type: "function", function: { name: "propose_package", description: "Mention an upsell package by name (after a booking).",
    parameters: { type: "object", properties: { package_name: { type: "string" } }, required: ["package_name"], additionalProperties: false } } },
  { type: "function", function: { name: "handover_to_human", description: "Escalate to a human.",
    parameters: { type: "object", properties: {
      reason: { type: "string", enum: ["human_request", "complaint", "vip", "off_topic", "other"] },
      summary: { type: "string" },
    }, required: ["reason", "summary"], additionalProperties: false } } },
  START_WELLNESS_BOOKING_TOOL,
];

async function execTool(name: string, args: any, ctx: any): Promise<string> {
  const { supabase, tenantId, contact, phoneNumber, services, packages, staff, ws, lead } = ctx;

  if (name === "start_wellness_booking") {
    const deps: WellnessFlowDeps = {
      supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
      phoneNumberId: ctx.tenantPhoneNumberId, accessToken: ctx.tenantAccessToken,
      services: services.map((s: any) => ({
        id: s.id, name: s.name, price: s.price ?? null,
        currency: s.currency ?? ws.currency, duration_min: s.duration_min ?? null, category: s.category ?? null,
      })),
      staff: staff.map((a: any) => ({ id: a.id, name: a.name })),
      currency: ws.currency || "USD",
      defaultDurationMin: ws.session_duration_min ?? 60,
      reminderHoursBefore: ws.reminder_hours_before ?? 24,
      followupHoursAfter: ws.followup_hours_after ?? 24,
      openHour: ws.open_hour ?? 9,
      closeHour: ws.close_hour ?? 19,
      slotStepMin: ws.slot_step_min ?? 60,
      staffNotifyPhone: ws.human_transfer_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: ctx.conversationHistory,
    };
    const started = await startWellnessFlow(deps);
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
    return hits.map((s: any) => `• ${s.name} · ${s.duration_min}min${s.price != null ? ` · ${s.currency} ${s.price}` : ""}`).join("\n");
  }

  if (name === "book_session") {
    const svc = services.find((s: any) => s.name?.toLowerCase() === args.service_name.toLowerCase())
      || services.find((s: any) => s.name?.toLowerCase().includes(args.service_name.toLowerCase()));
    const member = args.staff_name ? staff.find((a: any) => a.name?.toLowerCase().includes(args.staff_name.toLowerCase())) : null;
    const scheduled = new Date(args.scheduled_at);
    if (isNaN(scheduled.getTime())) return "Invalid date. Ask again.";
    const duration = svc?.duration_min ?? ws.session_duration_min ?? 60;
    const remH = ws.reminder_hours_before ?? 24;
    const reminderAt = new Date(scheduled.getTime() - remH * 3600_000);
    const followupAt = new Date(scheduled.getTime() + (ws.followup_hours_after ?? 24) * 3600_000);
    const { data: sess, error } = await supabase.from("wellness_sessions").insert({
      tenant_id: tenantId,
      service_id: svc?.id ?? null,
      staff_id: member?.id ?? null,
      lead_id: lead.id,
      contact_id: contact.id,
      guest_name: args.guest_name,
      guest_phone: phoneNumber,
      scheduled_at: scheduled.toISOString(),
      duration_min: duration,
      notes: args.notes ?? null,
      reminder_at: reminderAt.toISOString(),
      followup_at: followupAt.toISOString(),
      status: "booked",
      source: "ai",
    }).select().single();
    if (error) return `Failed: ${error.message}`;
    await supabase.from("wellness_leads").update({ status: "booked", service_id: svc?.id ?? null, assigned_staff_id: member?.id ?? null }).eq("id", lead.id);
    ctx.lastSession = sess;

    if (ws.crm_webhook_url) {
      fetch(ws.crm_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, session: sess, service: svc, staff: member }) }).catch(() => {});
    }
    return `Booked ${args.guest_name} for ${svc?.name || args.service_name} at ${scheduled.toLocaleString()}. Now propose a relevant package if any.`;
  }

  if (name === "propose_package") {
    const p = packages.find((x: any) => x.name?.toLowerCase() === args.package_name.toLowerCase())
      || packages.find((x: any) => x.name?.toLowerCase().includes(args.package_name.toLowerCase()));
    if (!p) return "No matching package.";
    return `Package: ${p.name} — ${p.sessions_count} sessions${p.price != null ? ` for ${p.currency} ${p.price}` : ""}.`;
  }

  if (name === "handover_to_human") {
    const target = ws.human_transfer_phone;
    if (target) {
      await sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, target,
        `🔔 Wellness handoff (${args.reason}) from ${contact.name || phoneNumber}: ${args.summary}`);
    }
    await supabase.from("wellness_leads").update({ needs_human: true, handoff_reason: args.reason }).eq("id", lead.id);
    return `Handoff flagged. Tell customer a human will reply shortly. Do NOT continue.`;
  }

  return "Unknown tool.";
}

export async function runWellnessFlow(opts: {
  supabase: any; tenantId: string; contact: any; phoneNumber: string;
  tenantPhoneNumberId: string; tenantAccessToken: string;
  messageText?: string | null;
  interactiveReplyId?: string | null;
}) {
  const { supabase, tenantId, contact, phoneNumber, tenantPhoneNumberId, tenantAccessToken } = opts;
  if (!LOVABLE_API_KEY) { console.error("wellness: LOVABLE_API_KEY not set"); return; }

  const [ws, services, packages, staff, lead] = await Promise.all([
    getSettings(supabase, tenantId),
    loadServices(supabase, tenantId),
    loadPackages(supabase, tenantId),
    loadStaff(supabase, tenantId),
    getOrCreateLead(supabase, tenantId, contact.id),
  ]);

  // 1) Resume active programmatic booking flow if one exists.
  const activeSession = await getActiveWellnessSession(supabase, tenantId, contact.id);
  if (activeSession) {
    const { data: recent } = await supabase
      .from("messages").select("content,direction").eq("contact_id", contact.id)
      .order("created_at", { ascending: false }).limit(10);
    const history = (recent || []).reverse().map((m: any) => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.content,
    }));
    const deps: WellnessFlowDeps = {
      supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
      phoneNumberId: tenantPhoneNumberId, accessToken: tenantAccessToken,
      services: services.map((s: any) => ({
        id: s.id, name: s.name, price: s.price ?? null,
        currency: s.currency ?? ws.currency, duration_min: s.duration_min ?? null, category: s.category ?? null,
      })),
      staff: staff.map((a: any) => ({ id: a.id, name: a.name })),
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
    await handleWellnessSessionMessage(deps, activeSession as any, opts.messageText ?? null, opts.interactiveReplyId ?? null);
    return;
  }

  // Settings → AI Auto-Replies → "AI upselling & recommendations" gates the package upsell.
  let upsellEnabled = false;
  try {
    const { data: upsellRow } = await supabase
      .from("app_settings").select("value")
      .eq("tenant_id", tenantId).eq("key", "ai_upsell_enabled").maybeSingle();
    upsellEnabled = upsellRow?.value === true || upsellRow?.value === "true";
  } catch (_e) { /* default off */ }

  const systemPrompt = buildSystemPrompt(ws, services, packages)
    + (upsellEnabled
      ? `\n\n## UPSELL ENABLED\nPackage upselling is ON: after a booking is confirmed, offer ONE matching package in one short sentence (call propose_package). Never invent packages or prices.`
      : `\n\n## UPSELL DISABLED\nPackage upselling is OFF. Do NOT offer packages, bundles, or extra sessions, and do NOT call propose_package.`);


  const { data: recent } = await supabase
    .from("messages").select("content,direction").eq("contact_id", contact.id)
    .order("created_at", { ascending: false }).limit(10);
  const history = (recent || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" : "assistant",
    content: m.content,
  }));

  const ctx: any = {
    supabase, tenantId, contact, phoneNumber, services, packages, staff, ws, lead,
    tenantPhoneNumberId, tenantAccessToken, conversationHistory: history,
    lastSession: null, flowStarted: false,
  };
  let messages: any[] = [{ role: "system", content: systemPrompt }, ...history];
  let finalReply = "";

  for (let turn = 0; turn < 5; turn++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages, tools: TOOLS, tool_choice: "auto" }),
    });
    if (!res.ok) { console.error("wellness AI error", res.status, await res.text()); break; }
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

  if (!finalReply) finalReply = "Sorry, can you say that again?";
  const ok = await sendText(tenantPhoneNumberId, tenantAccessToken, phoneNumber, finalReply);
  await supabase.from("messages").insert({
    contact_id: contact.id, content: finalReply, direction: "outgoing", status: ok ? "sent" : "failed",
  });
}
