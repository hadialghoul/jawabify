// Healthcare vertical flow — isolated from ecommerce/restaurant/real_estate/wellness.
// Invoked only when tenant.vertical === 'healthcare'. Writes only to healthcare_*
// tables (each guarded by guard_healthcare_only trigger).

import {
  getActiveHealthcareSession,
  handleHealthcareSessionMessage,
  startHealthcareFlow,
  START_HEALTHCARE_BOOKING_TOOL,
  type HealthcareFlowDeps,
} from "./healthcare-flow.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function sendText(phoneNumberId: string, accessToken: string, to: string, body: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return res.ok;
  } catch (e) { console.error("healthcare sendText", e); return false; }
}

async function getSettings(supabase: any, tenantId: string) {
  const { data } = await supabase.from("healthcare_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data ?? {
    currency: "USD", bot_tone: "professional", languages: ["en", "ar"],
    appointment_duration_min: 30, reminder_hours_before: 24, followup_hours_after: 48,
    lab_message_template: "Hello {name}, your lab results are ready. Your doctor will contact you shortly.",
    calendly_url: null, google_calendar_url: null, lab_webhook_url: null, crm_webhook_url: null,
    meta_ads_pixel: null, human_transfer_phone: null,
  };
}

async function getOrCreateLead(supabase: any, tenantId: string, contactId: string) {
  const { data: existing } = await supabase
    .from("healthcare_leads").select("*")
    .eq("tenant_id", tenantId).eq("contact_id", contactId)
    .not("status", "in", "(completed,cancelled)")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing;
  const { data } = await supabase.from("healthcare_leads").insert({
    tenant_id: tenantId, contact_id: contactId, status: "new", source: "ai",
  }).select().single();
  return data;
}

async function loadSpecialties(supabase: any, tenantId: string) {
  const { data } = await supabase.from("healthcare_specialties").select("*").eq("tenant_id", tenantId).eq("active", true);
  return data ?? [];
}
async function loadDoctors(supabase: any, tenantId: string) {
  const { data } = await supabase.from("healthcare_doctors").select("*").eq("tenant_id", tenantId).eq("active", true);
  return data ?? [];
}

function toneLine(tone: string) {
  switch (tone) {
    case "warm": return "Tone: warm, empathetic, reassuring.";
    case "concise": return "Tone: very short, factual, no fluff.";
    default: return "Tone: professional, calm, respectful.";
  }
}

function buildSystemPrompt(hs: any, specs: any[], doctors: any[]) {
  const langs = (hs.languages || ["en"]).join("/");
  const specList = specs.map((s: any) => {
    const tq = Array.isArray(s.triage_questions) ? s.triage_questions.slice(0, 4).join(" | ") : "";
    const uk = (s.urgency_keywords || []).join(", ");
    return `- ${s.name}${s.description ? ` — ${s.description}` : ""}${tq ? `\n   triage Qs: ${tq}` : ""}${uk ? `\n   urgency keywords: ${uk}` : ""}`;
  }).join("\n") || "(no specialties configured)";

  const docList = doctors.map((d: any) => {
    const sp = specs.find((s: any) => s.id === d.specialty_id);
    return `- Dr. ${d.name}${sp ? ` · ${sp.name}` : ""}`;
  }).join("\n") || "(none)";

  return `You are a healthcare clinic WhatsApp assistant. Reply in ${langs} matching the patient's language.
${toneLine(hs.bot_tone)}

⚖️ LEGAL & MEDICAL DISCLAIMERS (FIXED — Jawabify managed):
- NEVER diagnose. NEVER give medical advice. NEVER prescribe or suggest medication doses.
- If asked about a diagnosis or treatment, reply: "I can't advise on that — your doctor will." and offer to book.
- ALWAYS include a disclaimer like "this is not medical advice" if you discuss any health topic.

ABSOLUTE RULES:
- One short sentence per reply (max ~15 words) EXCEPT when listing specialties or doctors.
- NEVER invent doctors, slots, specialties, or lab results. Only use what tools return.
- NEVER auto-fill patient info — always ask.

SPECIALTIES:
${specList}

DOCTORS:
${docList}
${hs.calendly_url ? `\nBOOKING LINK: ${hs.calendly_url}` : ""}

==== FLOW ====

STEP 1 — GREETING + REASON FOR CONTACT
Greet briefly and ask "Appointment, lab results, or a question?". Route based on intent. Call set_lead_intent.

STEP 2 — APPOINTMENT BOOKING (CRITICAL — programmatic, not you)
As SOON as the patient says they want to book / schedule / make an appointment, call the tool start_healthcare_booking.
The tool takes over: it shows specialties, optional doctor, date, time, name and confirms — deterministically.
You do NOT take the booking yourself and do NOT call book_appointment once you've called start_healthcare_booking.
While the programmatic flow is active, any new messages from the patient are routed to that flow.

STEP 3 — URGENT CASE → IMMEDIATE HANDOFF
If urgency keywords appear (chest pain, bleeding, fainting, can't breathe, etc.) OR the patient
describes an emergency, IMMEDIATELY call handover_to_human(reason="urgent"). Tell the patient
to call emergency services or that a doctor will reach them now. Do NOT continue the flow.

STEP 4 — LAB RESULT LOOKUP
If patient asks about lab results, call lookup_lab_results. If ready, relay the configured message.
If pending, say "not ready yet — we'll message you when they are".

STEP 5 — FOLLOW-UP & PRESCRIPTION REMINDER (automatic)
The system sends post-visit follow-ups and medication-refill reminders. You don't need to send them.

==== HANDOFF ====
Call handover_to_human(reason) when:
- "urgent" → emergency symptoms detected
- "human_request" → patient asks for a real person / nurse / doctor
- "complaint" → complaint or anger
- "off_topic" → off-clinic / out of scope
- "other"
After handoff, do NOT continue. Tell the patient a human will reach out shortly.

Reply now.`;
}

const TOOLS = [
  { type: "function", function: { name: "set_lead_intent", description: "Save what the patient wants.",
    parameters: { type: "object", properties: {
      intent: { type: "string", enum: ["appointment", "lab_result", "question", "prescription", "other"] },
      specialty_name: { type: "string" },
    }, required: ["intent"], additionalProperties: false } } },
  { type: "function", function: { name: "set_triage", description: "Save urgency assessment from screening questions.",
    parameters: { type: "object", properties: {
      urgency_level: { type: "string", enum: ["low", "medium", "high", "emergency"] },
      triage_notes: { type: "string" },
    }, required: ["urgency_level"], additionalProperties: false } } },
  { type: "function", function: { name: "lookup_lab_results", description: "Look up a patient's lab results.",
    parameters: { type: "object", properties: { patient_name: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "handover_to_human", description: "Escalate to a human.",
    parameters: { type: "object", properties: {
      reason: { type: "string", enum: ["urgent", "human_request", "complaint", "off_topic", "other"] },
      summary: { type: "string" },
    }, required: ["reason", "summary"], additionalProperties: false } } },
  START_HEALTHCARE_BOOKING_TOOL,
];

function buildFlowDeps(ctx: any, history: Array<{ role: string; content: string }>): HealthcareFlowDeps {
  const { supabase, tenantId, contact, phoneNumber, specs, doctors, hs, lead } = ctx;
  return {
    supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
    phoneNumberId: ctx.tenantPhoneNumberId, accessToken: ctx.tenantAccessToken,
    specialties: specs.map((s: any) => ({ id: s.id, name: s.name, description: s.description ?? null })),
    doctors: doctors.map((d: any) => ({ id: d.id, name: d.name, specialty_id: d.specialty_id ?? null })),
    defaultDurationMin: hs.appointment_duration_min ?? 30,
    reminderHoursBefore: hs.reminder_hours_before ?? 24,
    followupHoursAfter: hs.followup_hours_after ?? 48,
    openHour: hs.open_hour ?? 9,
    closeHour: hs.close_hour ?? 18,
    slotStepMin: hs.slot_step_min ?? 30,
    staffNotifyPhone: hs.human_transfer_phone || null,
    lovableApiKey: LOVABLE_API_KEY,
    conversationHistory: history,
  };
}

async function execTool(name: string, args: any, ctx: any): Promise<string> {
  const { supabase, tenantId, contact, phoneNumber, specs, hs, lead } = ctx;

  if (name === "start_healthcare_booking") {
    const started = await startHealthcareFlow(buildFlowDeps(ctx, ctx.conversationHistory || []));
    if (started) ctx.flowStarted = true;
    return started ? "__FLOW_STARTED__" : "Could not start booking flow.";
  }

  if (name === "set_lead_intent") {
    const sp = args.specialty_name ? specs.find((s: any) => s.name?.toLowerCase().includes(String(args.specialty_name).toLowerCase())) : null;
    await supabase.from("healthcare_leads").update({ intent: args.intent, specialty_id: sp?.id ?? null, status: "triaged" }).eq("id", lead.id);
    return `Saved intent=${args.intent}${sp ? `, specialty=${sp.name}` : ""}.`;
  }

  if (name === "set_triage") {
    const newStatus = args.urgency_level === "emergency" || args.urgency_level === "high" ? "urgent" : "triaged";
    await supabase.from("healthcare_leads").update({
      urgency_level: args.urgency_level, notes: args.triage_notes ?? null, status: newStatus,
    }).eq("id", lead.id);
    ctx.lead.urgency_level = args.urgency_level;
    return `Triage saved: urgency=${args.urgency_level}.${newStatus === "urgent" ? " URGENT — handoff now." : ""}`;
  }

  if (name === "lookup_lab_results") {
    const { data } = await supabase.from("healthcare_lab_results").select("*")
      .eq("tenant_id", tenantId).eq("contact_id", contact.id)
      .order("created_at", { ascending: false }).limit(3);
    if (!data || data.length === 0) return "No lab results on file. Tell patient we'll message when ready.";
    const ready = data.find((r: any) => r.status === "ready" || r.status === "delivered");
    if (ready) {
      return `Ready: ${ready.patient_name || contact.name || "patient"} — ${ready.notes || "result available"}. Use template: ${hs.lab_message_template}`;
    }
    return "Lab results still pending. Tell patient we'll notify when ready.";
  }

  if (name === "handover_to_human") {
    const target = hs.human_transfer_phone;
    if (target) {
      const urgent = args.reason === "urgent";
      await sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, target,
        `${urgent ? "🚨 URGENT HEALTHCARE HANDOFF" : "🔔 Healthcare handoff"} (${args.reason}) from ${contact.name || phoneNumber}: ${args.summary}`);
    }
    await supabase.from("healthcare_leads").update({
      needs_human: true, handoff_reason: args.reason,
      status: args.reason === "urgent" ? "urgent" : lead.status,
    }).eq("id", lead.id);
    return `Handoff flagged${args.reason === "urgent" ? " — URGENT" : ""}. Tell patient a doctor/nurse will reply now. Do NOT continue.`;
  }

  return "Unknown tool.";
}

export async function runHealthcareFlow(opts: {
  supabase: any; tenantId: string; contact: any; phoneNumber: string;
  tenantPhoneNumberId: string; tenantAccessToken: string;
  messageText?: string | null;
  interactiveReplyId?: string | null;
}) {
  const { supabase, tenantId, contact, phoneNumber, tenantPhoneNumberId, tenantAccessToken } = opts;
  if (!LOVABLE_API_KEY) { console.error("healthcare: LOVABLE_API_KEY not set"); return; }

  const [hs, specs, doctors, lead] = await Promise.all([
    getSettings(supabase, tenantId),
    loadSpecialties(supabase, tenantId),
    loadDoctors(supabase, tenantId),
    getOrCreateLead(supabase, tenantId, contact.id),
  ]);

  // 1) Resume active programmatic booking flow if one exists.
  const activeSession = await getActiveHealthcareSession(supabase, tenantId, contact.id);
  if (activeSession) {
    const { data: recent } = await supabase
      .from("messages").select("content,direction").eq("contact_id", contact.id)
      .order("created_at", { ascending: false }).limit(10);
    const history = (recent || []).reverse().map((m: any) => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.content,
    }));
    const ctx: any = {
      supabase, tenantId, contact, phoneNumber, specs, doctors, hs, lead,
      tenantPhoneNumberId, tenantAccessToken,
    };
    const deps = buildFlowDeps(ctx, history);
    await handleHealthcareSessionMessage(deps, activeSession as any, opts.messageText ?? null, opts.interactiveReplyId ?? null);
    return;
  }

  const systemPrompt = buildSystemPrompt(hs, specs, doctors);

  const { data: recent } = await supabase
    .from("messages").select("content,direction").eq("contact_id", contact.id)
    .order("created_at", { ascending: false }).limit(10);
  const history = (recent || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" : "assistant",
    content: m.content,
  }));

  const ctx: any = {
    supabase, tenantId, contact, phoneNumber, specs, doctors, hs, lead,
    tenantPhoneNumberId, tenantAccessToken,
    conversationHistory: history,
    flowStarted: false,
  };
  let messages: any[] = [{ role: "system", content: systemPrompt }, ...history];
  let finalReply = "";

  for (let turn = 0; turn < 5; turn++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages, tools: TOOLS, tool_choice: "auto" }),
    });
    if (!res.ok) { console.error("healthcare AI error", res.status, await res.text()); break; }
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

  // If the AI started the deterministic flow, it already sent the first prompt.
  if (ctx.flowStarted) return;

  if (!finalReply) finalReply = "Sorry, can you say that again?";
  const ok = await sendText(tenantPhoneNumberId, tenantAccessToken, phoneNumber, finalReply);
  await supabase.from("messages").insert({
    contact_id: contact.id, content: finalReply, direction: "outgoing", status: ok ? "sent" : "failed",
  });
}
