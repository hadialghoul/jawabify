// Education vertical flow — isolated. Writes only to education_* tables.
import {
  getActiveEducationSession,
  handleEducationSessionMessage,
  startEducationFlow,
  START_EDUCATION_ENROLLMENT_TOOL,
  type EducationFlowDeps,
} from "./education-flow.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

async function sendText(phoneNumberId: string, accessToken: string, to: string, body: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    });
    return res.ok;
  } catch (e) { console.error("education sendText", e); return false; }
}

async function getSettings(supabase: any, tenantId: string) {
  const { data } = await supabase.from("education_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data ?? { bot_tone: "friendly", languages: ["en","ar","fr"], currency: "USD", payment_link_template: null, human_transfer_phone: null, calendly_url: null, crm_webhook_url: null, enrollment_confirmation_template: "" };
}

async function getOrCreateLead(supabase: any, tenantId: string, contactId: string) {
  const { data: existing } = await supabase.from("education_leads").select("*")
    .eq("tenant_id", tenantId).eq("contact_id", contactId)
    .not("status", "in", "(completed,lost)")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return existing;
  const { data } = await supabase.from("education_leads").insert({ tenant_id: tenantId, contact_id: contactId, status: "new", source: "ai" }).select().single();
  return data;
}

async function loadCourses(supabase: any, tenantId: string) {
  const { data } = await supabase.from("education_courses").select("*").eq("tenant_id", tenantId).eq("active", true);
  return data ?? [];
}

function buildSystemPrompt(s: any, courses: any[]) {
  const langs = (s.languages || ["en"]).join("/");
  const list = courses.map((c: any) => {
    const opts = (c.payment_options || []).join("/");
    return `- ${c.name}${c.age_group ? ` (age ${c.age_group})` : ""}${c.schedule ? ` · ${c.schedule}` : ""} · ${c.currency} ${c.price} · pay: ${opts}${c.trial_available ? " · trial available" : ""}`;
  }).join("\n") || "(no courses configured yet)";

  return `You are a friendly school/learning-center WhatsApp assistant. Reply in ${langs} matching the parent's language.
Tone: ${s.bot_tone}. One short sentence per reply (max 15 words) unless listing courses.

ABSOLUTE RULES:
- NEVER invent courses, prices, schedules, or slots. Only use what's listed.
- NEVER auto-fill student/parent info — always ask.
- Don't promise custom payment plans — say "a human will confirm".

COURSES:
${list}
${s.calendly_url ? `\nTRIAL BOOKING: ${s.calendly_url}` : ""}
${s.payment_link_template ? `\nPAYMENT LINK TEMPLATE: ${s.payment_link_template}` : ""}

==== 6-STEP FLOW ====
1. GREETING — Ask "Course info, schedule, or enrollment?" and route.
2. COURSE DISCOVERY — Ask age group, subject, level, schedule preference. Match courses and present matches.
3. PRICING & INFO — Share fees, payment options, start date, trial availability.
4. ENROLL INTENT (CRITICAL — programmatic, not you)
   As SOON as the parent says they want to enroll / sign up / book a trial, call the tool start_education_enrollment.
   If the parent already named a course, pass it as course_name so the flow can preselect it.
   The tool takes over: it picks the course, asks student name + age, parent name, plan, then confirms.
   You do NOT collect those fields yourself once you've called start_education_enrollment.
5. PAYMENT & CONFIRMATION — After the flow finishes, the system handles payment follow-up. For custom plans → handover_to_human.
6. REMINDERS — System sends class reminders & weekly progress messages automatically.

==== HANDOFF ====
Call handover_to_human(reason) when: complaint, custom payment plan, parent asks for human, off-topic, or other.
After handoff, do NOT continue — tell parent a staff member will reply.

Reply now.`;
}

const TOOLS = [
  { type: "function", function: { name: "save_lead_details", description: "Save student/parent details captured from chat (use only BEFORE enrollment flow starts).",
    parameters: { type: "object", properties: {
      student_name: { type: "string" }, student_age: { type: "string" },
      parent_name: { type: "string" }, parent_phone: { type: "string" },
      course_name: { type: "string" }, preferred_schedule: { type: "string" },
      status: { type: "string", enum: ["interested","trial_booked"] },
    }, additionalProperties: false } } },
  START_EDUCATION_ENROLLMENT_TOOL,
  { type: "function", function: { name: "handover_to_human", description: "Escalate to a human.",
    parameters: { type: "object", properties: {
      reason: { type: "string", enum: ["custom_payment","complaint","human_request","off_topic","other"] },
      summary: { type: "string" },
    }, required: ["reason","summary"], additionalProperties: false } } },
];

async function execTool(name: string, args: any, ctx: any): Promise<string> {
  const { supabase, tenantId, contact, phoneNumber, courses, settings, lead } = ctx;

  if (name === "start_education_enrollment") {
    const deps: EducationFlowDeps = {
      supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
      phoneNumberId: ctx.tenantPhoneNumberId, accessToken: ctx.tenantAccessToken,
      courses: courses.map((c: any) => ({
        id: c.id, name: c.name, price: c.price ?? null, currency: c.currency ?? settings.currency,
        age_group: c.age_group ?? null, schedule: c.schedule ?? null, start_date: c.start_date ?? null,
        payment_options: c.payment_options ?? [], trial_available: !!c.trial_available,
      })),
      currency: settings.currency || "USD",
      staffNotifyPhone: settings.human_transfer_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: ctx.conversationHistory,
      preferredCourseHint: args?.course_name || null,
    };
    const started = await startEducationFlow(deps);
    if (started) ctx.flowStarted = true;
    return started ? "__FLOW_STARTED__" : "Could not start enrollment flow.";
  }

  if (name === "save_lead_details") {
    const course = args.course_name ? courses.find((c: any) => c.name?.toLowerCase().includes(String(args.course_name).toLowerCase())) : null;
    await supabase.from("education_leads").update({
      student_name: args.student_name ?? lead.student_name,
      student_age: args.student_age ?? lead.student_age,
      parent_name: args.parent_name ?? lead.parent_name,
      parent_phone: args.parent_phone ?? lead.parent_phone ?? phoneNumber,
      preferred_schedule: args.preferred_schedule ?? lead.preferred_schedule,
      course_id: course?.id ?? lead.course_id,
      status: args.status ?? "interested",
    }).eq("id", lead.id);
    if (settings.crm_webhook_url) fetch(settings.crm_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead, args }) }).catch(() => {});
    return `Saved lead. Status=${args.status ?? "interested"}.`;
  }

  if (name === "handover_to_human") {
    const target = settings.human_transfer_phone;
    if (target) await sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, target,
      `🔔 Education handoff (${args.reason}) from ${contact.name || phoneNumber}: ${args.summary}`);
    await supabase.from("education_leads").update({ needs_human: true, handoff_reason: args.reason }).eq("id", lead.id);
    return `Handoff flagged. Tell parent a staff member will reply.`;
  }
  return "Unknown tool.";
}

export async function runEducationFlow(opts: {
  supabase: any; tenantId: string; contact: any; phoneNumber: string;
  tenantPhoneNumberId: string; tenantAccessToken: string;
  messageText?: string | null;
  interactiveReplyId?: string | null;
}) {
  const { supabase, tenantId, contact, phoneNumber, tenantPhoneNumberId, tenantAccessToken } = opts;
  if (!LOVABLE_API_KEY) { console.error("education: LOVABLE_API_KEY not set"); return; }

  const [settings, courses, lead] = await Promise.all([
    getSettings(supabase, tenantId),
    loadCourses(supabase, tenantId),
    getOrCreateLead(supabase, tenantId, contact.id),
  ]);

  // 1) Resume active programmatic enrollment if one exists.
  const activeSession = await getActiveEducationSession(supabase, tenantId, contact.id);
  if (activeSession) {
    const { data: recent } = await supabase
      .from("messages").select("content,direction").eq("contact_id", contact.id)
      .order("created_at", { ascending: false }).limit(10);
    const history = (recent || []).reverse().map((m: any) => ({
      role: m.direction === "incoming" ? "user" : "assistant", content: m.content,
    }));
    const deps: EducationFlowDeps = {
      supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
      phoneNumberId: tenantPhoneNumberId, accessToken: tenantAccessToken,
      courses: courses.map((c: any) => ({
        id: c.id, name: c.name, price: c.price ?? null, currency: c.currency ?? settings.currency,
        age_group: c.age_group ?? null, schedule: c.schedule ?? null, start_date: c.start_date ?? null,
        payment_options: c.payment_options ?? [], trial_available: !!c.trial_available,
      })),
      currency: settings.currency || "USD",
      staffNotifyPhone: settings.human_transfer_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: history,
    };
    await handleEducationSessionMessage(deps, activeSession as any, opts.messageText ?? null, opts.interactiveReplyId ?? null);
    return;
  }

  const systemPrompt = buildSystemPrompt(settings, courses);
  const { data: recent } = await supabase.from("messages").select("content,direction")
    .eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(10);
  const history = (recent || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" : "assistant", content: m.content,
  }));

  const ctx: any = {
    supabase, tenantId, contact, phoneNumber, courses, settings, lead,
    tenantPhoneNumberId, tenantAccessToken, conversationHistory: history, flowStarted: false,
  };
  let messages: any[] = [{ role: "system", content: systemPrompt }, ...history];
  let finalReply = "";

  for (let turn = 0; turn < 5; turn++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages, tools: TOOLS, tool_choice: "auto" }),
    });
    if (!res.ok) { console.error("education AI error", res.status, await res.text()); break; }
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
