// Deterministic healthcare appointment booking state machine.
// States: picking_specialty → picking_doctor → picking_date → picking_time → name → confirm → done|cancelled
// Writes to `healthcare_appointments` (+ updates `healthcare_leads`).
// Shares the same shape as wellness-flow.ts.

export interface HCSpecialty {
  id: string;
  name: string;
  description?: string | null;
}

export interface HCDoctor {
  id: string;
  name: string;
  specialty_id?: string | null;
}

export interface HealthcareFlowDeps {
  supabase: any;
  tenantId: string;
  contactId: string;
  leadId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  specialties: HCSpecialty[];
  doctors: HCDoctor[];
  defaultDurationMin: number;
  reminderHoursBefore: number;
  followupHoursAfter: number;
  openHour?: number;
  closeHour?: number;
  slotStepMin?: number;
  staffNotifyPhone?: string | null;
  lovableApiKey?: string | null;
  conversationHistory?: Array<{ role: string; content: string }>;
  knowledgeEntries?: Array<{ title: string; content: string }>;
}

interface Draft {
  specialty_id?: string | null;
  specialty_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  scheduled_date?: string;
  scheduled_time?: string;
  patient_name?: string;
  reason?: string | null;
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

const FLOW_KIND = "healthcare_booking";

// ---------- helpers ----------
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
  return /\b(price|cost|insurance|how long|hours|open|close|fee|سعر|تأمين|كم|مفتوح)\b/i.test(t);
}

const URGENT_RE = /\b(chest pain|can'?t breathe|cannot breathe|fainting|fainted|bleeding heavily|stroke|seizure|unconscious|suicid|overdose|أسعفوني|ألم في الصدر|نزيف|إغماء|ما فيني تنفس|سكتة)\b/i;

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }
function todayISODate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function buildDateOptions(count = 7): Array<{ id: string; label: string; value: string }> {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const out: Array<{ id: string; label: string; value: string }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.now() + i * 86400_000);
    const value = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${dayNames[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
    out.push({ id: `date_${value}`, label, value });
  }
  return out;
}

function buildTimeOptions(openHour = 9, closeHour = 18, stepMin = 30): Array<{ id: string; label: string; value: string }> {
  const out: Array<{ id: string; label: string; value: string }> = [];
  for (let h = openHour; h < closeHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const value = `${pad2(h)}:${pad2(m)}`;
      const ampm = h < 12 ? "AM" : "PM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${h12}:${pad2(m)} ${ampm}`;
      out.push({ id: `time_${value}`, label, value });
    }
  }
  return out;
}

function parseFreeTextDate(input: string): string | null {
  const t = normalizeDigits(input).trim().toLowerCase();
  if (!t) return null;
  if (/\b(today|اليوم)\b/.test(t)) return todayISODate();
  if (/\b(tomorrow|بكرا|بكرة|غدا|غداً)\b/.test(t)) {
    const d = new Date(Date.now() + 86400_000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? +m[3] : new Date().getUTCFullYear();
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < days.length; i++) {
    if (t.includes(days[i])) {
      const today = new Date();
      const diff = (i - today.getUTCDay() + 7) % 7 || 7;
      const d = new Date(Date.now() + diff * 86400_000);
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
    }
  }
  return null;
}

function parseFreeTextTime(input: string): string | null {
  const t = normalizeDigits(input).trim().toLowerCase().replace(/\s+/g, "");
  let m = t.match(/^(\d{1,2}):(\d{2})(am|pm)?$/);
  if (m) {
    let h = +m[1], mm = +m[2];
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23 && mm >= 0 && mm <= 59) return `${pad2(h)}:${pad2(mm)}`;
  }
  m = t.match(/^(\d{1,2})(am|pm)$/);
  if (m) {
    let h = +m[1];
    if (m[2] === "pm" && h < 12) h += 12;
    if (m[2] === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23) return `${pad2(h)}:00`;
  }
  return null;
}

function matchSpecialty(hint: string, specs: HCSpecialty[]): HCSpecialty | null {
  const h = hint.toLowerCase().trim();
  if (!h) return null;
  return specs.find((s) => s.name.toLowerCase() === h)
    || specs.find((s) => s.name.toLowerCase().includes(h))
    || specs.find((s) => h.includes(s.name.toLowerCase()))
    || null;
}

function matchDoctor(hint: string, docs: HCDoctor[]): HCDoctor | null {
  const h = hint.toLowerCase().trim().replace(/^dr\.?\s+/, "");
  if (!h) return null;
  return docs.find((d) => d.name.toLowerCase() === h)
    || docs.find((d) => d.name.toLowerCase().includes(h))
    || null;
}

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00Z`).toISOString();
}

// ---------- whatsapp ----------
async function sendText(deps: HealthcareFlowDeps, body: string) {
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

async function sendButtons(deps: HealthcareFlowDeps, body: string, buttons: Array<{ id: string; title: string }>) {
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

async function sendList(
  deps: HealthcareFlowDeps,
  body: string,
  buttonText: string,
  sectionTitle: string,
  rows: Array<{ id: string; title: string; description?: string }>,
) {
  const url = `https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp", to: deps.phoneNumber, type: "interactive",
    interactive: {
      type: "list", body: { text: body },
      action: {
        button: buttonText.slice(0, 20),
        sections: [{
          title: sectionTitle.slice(0, 24),
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
    await sendText(deps, `${body}\n\n${rows.map((r, i) => `${i + 1}. ${r.title}`).join("\n")}\n\nReply with the number or name.`);
    return;
  }
  await deps.supabase.from("messages").insert({
    contact_id: deps.contactId,
    content: `${body}\n[List: ${rows.map((r) => r.title).join(" • ")}]`,
    direction: "outgoing", status: "sent",
  });
}

// ---------- AI side-question ----------
async function maybeAnswerQuestion(deps: HealthcareFlowDeps, text: string, session: Session): Promise<boolean> {
  if (!deps.lovableApiKey || !text || !looksLikeQuestion(text)) return false;
  try {
    const specLines = deps.specialties.slice(0, 20).map((s) =>
      `- ${s.name}${s.description ? ` — ${s.description}` : ""}`
    ).join("\n");
    const docLines = deps.doctors.slice(0, 20).map((d) => {
      const sp = deps.specialties.find((s) => s.id === d.specialty_id);
      return `- Dr. ${d.name}${sp ? ` · ${sp.name}` : ""}`;
    }).join("\n");
    const kb = (deps.knowledgeEntries || []).slice(0, 6).map((e) => `### ${e.title}\n${e.content.slice(0, 500)}`).join("\n\n");
    const draftLine = [
      session.draft.specialty_name && `Specialty: ${session.draft.specialty_name}`,
      session.draft.doctor_name && `Doctor: ${session.draft.doctor_name}`,
      session.draft.scheduled_date && `Date: ${session.draft.scheduled_date}`,
      session.draft.scheduled_time && `Time: ${session.draft.scheduled_time}`,
    ].filter(Boolean).join(" · ") || "(nothing chosen yet)";
    const ctx = [
      `Current step: ${session.state}`,
      `Draft: ${draftLine}`,
      `Specialties:\n${specLines}`,
      `Doctors:\n${docLines}`,
      kb ? `Knowledge:\n${kb}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "You are answering a side-question during a WhatsApp healthcare appointment booking. ONE short sentence (≤20 words), mirror the patient's language. NEVER diagnose, prescribe, or give medical advice — if asked, say 'I can't advise on that — your doctor will' in their language. Use specialties/doctors/knowledge only. If unknown, say 'Let me check with the clinic and get back to you'. Do NOT confirm or modify the booking." },
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
    console.error("healthcare maybeAnswerQuestion failed", e);
    return false;
  }
}

// ---------- session ----------
export async function getActiveHealthcareSession(supabase: any, tenantId: string, contactId: string): Promise<Session | null> {
  const { data } = await supabase
    .from("order_sessions").select("*")
    .eq("tenant_id", tenantId).eq("contact_id", contactId)
    .eq("flow_kind", FLOW_KIND)
    .not("state", "in", "(done,cancelled)")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data;
}

async function saveSession(supabase: any, s: Session) {
  await supabase.from("order_sessions").update({
    state: s.state, draft: s.draft, pending_hints: s.pending_hints,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }).eq("id", s.id);
}

async function cancelSession(supabase: any, id: string) {
  await supabase.from("order_sessions").update({ state: "cancelled" }).eq("id", id);
}

// ---------- public entry points ----------
export async function startHealthcareFlow(deps: HealthcareFlowDeps): Promise<boolean> {
  const existing = await getActiveHealthcareSession(deps.supabase, deps.tenantId, deps.contactId);
  if (existing) {
    await sendText(deps, "You already have an appointment in progress. Type 'cancel' to start over.");
    return false;
  }
  if (deps.specialties.length === 0) {
    await sendText(deps, "Sorry, no specialties are configured yet. A human will reach out shortly.");
    return false;
  }
  const { data: session, error } = await deps.supabase.from("order_sessions").insert({
    tenant_id: deps.tenantId,
    contact_id: deps.contactId,
    state: "picking_specialty",
    draft: {} as Draft,
    pending_hints: [],
    flow_kind: FLOW_KIND,
  }).select().single();
  if (error || !session) {
    console.error("startHealthcareFlow: failed to create session", error);
    await sendText(deps, "Sorry, couldn't start the booking. Try again in a moment.");
    return false;
  }
  await advance(deps, session as Session, null);
  return true;
}

export async function handleHealthcareSessionMessage(
  deps: HealthcareFlowDeps,
  session: Session,
  text: string | null,
  interactiveId: string | null,
): Promise<void> {
  const lower = (text || "").trim().toLowerCase();
  if (lower === "cancel" || lower === "إلغاء" || lower === "الغاء") {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, "Appointment cancelled. Let us know when you'd like to reschedule.");
    return;
  }
  // Emergency interjection at any point.
  if (text && URGENT_RE.test(text)) {
    await cancelSession(deps.supabase, session.id);
    await deps.supabase.from("healthcare_leads").update({
      needs_human: true, handoff_reason: "urgent", status: "urgent", urgency_level: "emergency",
    }).eq("id", deps.leadId);
    if (deps.staffNotifyPhone) {
      fetch(`https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: deps.staffNotifyPhone, type: "text",
          text: { body: `🚨 URGENT HEALTHCARE HANDOFF from ${deps.phoneNumber}: ${text}` } }),
      }).catch(() => {});
    }
    await sendText(deps, "This sounds urgent — please call emergency services now. A clinician will also contact you immediately.");
    return;
  }
  await advance(deps, session, interactiveId ? { type: "interactive", id: interactiveId } : { type: "text", text: text || "" });
}

interface Incoming { type: "text" | "interactive"; text?: string; id?: string; }

async function advance(deps: HealthcareFlowDeps, session: Session, incoming: Incoming | null): Promise<void> {
  switch (session.state) {
    case "picking_specialty": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("spec_")) {
          const id = incoming.id.slice("spec_".length);
          const s = deps.specialties.find((x) => x.id === id);
          if (s) {
            session.draft.specialty_id = s.id;
            session.draft.specialty_name = s.name;
            session.state = "picking_doctor";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Which specialty do you need?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const direct = matchSpecialty(incoming.text, deps.specialties);
          if (direct) {
            session.draft.specialty_id = direct.id;
            session.draft.specialty_name = direct.name;
            session.state = "picking_doctor";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, `I couldn't find "${incoming.text}". Please pick from the list:`);
        }
      }
      const rows = deps.specialties.slice(0, 10).map((s) => ({
        id: `spec_${s.id}`,
        title: s.name,
        description: (s.description || "").slice(0, 72),
      }));
      await sendList(deps, "Which specialty do you need?", "View specialties", "Specialties", rows);
      return;
    }

    case "picking_doctor": {
      const eligible = deps.doctors.filter((d) =>
        !session.draft.specialty_id || !d.specialty_id || d.specialty_id === session.draft.specialty_id
      );
      // Auto-skip if no doctors configured for the specialty
      if (eligible.length === 0) {
        session.draft.doctor_id = null;
        session.draft.doctor_name = null;
        session.state = "picking_date";
        await saveSession(deps.supabase, session);
        await advance(deps, session, null);
        return;
      }
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id === "doc_any") {
          session.draft.doctor_id = null;
          session.draft.doctor_name = null;
          session.state = "picking_date";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.type === "interactive" && incoming.id?.startsWith("doc_")) {
          const id = incoming.id.slice("doc_".length);
          const d = eligible.find((x) => x.id === id);
          if (d) {
            session.draft.doctor_id = d.id;
            session.draft.doctor_name = d.name;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Any preferred doctor, or any available?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const direct = matchDoctor(incoming.text, eligible);
          if (direct) {
            session.draft.doctor_id = direct.id;
            session.draft.doctor_name = direct.name;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          if (/\b(any|whoever|no preference|أي|اي)\b/i.test(incoming.text)) {
            session.draft.doctor_id = null;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, `I didn't find that doctor. Pick from the list or tap "Any":`);
        }
      }
      const rows = [
        { id: "doc_any", title: "Any available", description: "First doctor available" },
        ...eligible.slice(0, 9).map((d) => ({ id: `doc_${d.id}`, title: `Dr. ${d.name}` })),
      ];
      await sendList(deps, "Any preferred doctor?", "Pick doctor", "Doctors", rows);
      return;
    }

    case "picking_date": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("date_")) {
          const value = incoming.id.slice("date_".length);
          session.draft.scheduled_date = value;
          session.state = "picking_time";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Which day works best for you?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const value = parseFreeTextDate(incoming.text);
          if (value) {
            session.draft.scheduled_date = value;
            session.state = "picking_time";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, "I didn't catch that date — try a day name like 'Monday' or a date like 30/12.");
        }
      }
      const dates = buildDateOptions(7);
      await sendList(deps, "Which day works best?", "Pick a day", "Available days",
        dates.map((d) => ({ id: d.id, title: d.label, description: d.value })));
      return;
    }

    case "picking_time": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("time_")) {
          const value = incoming.id.slice("time_".length);
          session.draft.scheduled_time = value;
          session.state = "name";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "What time would you like?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const value = parseFreeTextTime(incoming.text);
          if (value) {
            session.draft.scheduled_time = value;
            session.state = "name";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, "I didn't catch that time — try '3pm' or '15:00'.");
        }
      }
      const times = buildTimeOptions(deps.openHour ?? 9, deps.closeHour ?? 18, deps.slotStepMin ?? 30);
      await sendList(deps, `Pick a time for ${session.draft.scheduled_date}:`, "Pick a time", "Available times",
        times.slice(0, 10).map((t) => ({ id: t.id, title: t.label })));
      return;
    }

    case "name": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "And the patient's full name please?");
          return;
        }
        const name = incoming.text.trim();
        if (name.length >= 2) {
          session.draft.patient_name = name;
          session.state = "confirm";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, "What name should we put on the appointment?");
      return;
    }

    case "confirm": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "confirm_yes") {
          await finalizeBooking(deps, session);
          return;
        }
        if (incoming.id === "confirm_edit") {
          await sendButtons(deps, "What do you want to edit?", [
            { id: "edit_back_specialty", title: "Specialty" },
            { id: "edit_back_date", title: "Date / time" },
            { id: "edit_back_name", title: "Name" },
          ]);
          return;
        }
        if (incoming.id === "edit_back_specialty") {
          session.state = "picking_specialty";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.id === "edit_back_date") {
          session.state = "picking_date";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
        if (incoming.id === "edit_back_name") {
          session.state = "name";
          await saveSession(deps.supabase, session);
          await sendText(deps, "What name should we put on the appointment?");
          return;
        }
        if (incoming.id === "confirm_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, "Appointment cancelled.");
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        if (await maybeAnswerQuestion(deps, incoming.text, session)) { /* fall through and redisplay */ }
      }
      const d = session.draft;
      const docLine = d.doctor_name ? `\n👨‍⚕️ Dr. ${d.doctor_name}` : "\n👨‍⚕️ First available doctor";
      const body =
        `Please confirm your appointment:\n\n` +
        `🏥 ${d.specialty_name}${docLine}\n` +
        `📅 ${d.scheduled_date} at ${d.scheduled_time}\n` +
        `👤 ${d.patient_name}`;
      await sendButtons(deps, body, [
        { id: "confirm_yes", title: "✅ Confirm" },
        { id: "confirm_edit", title: "Edit" },
        { id: "confirm_cancel", title: "Cancel" },
      ]);
      return;
    }
  }
}

async function finalizeBooking(deps: HealthcareFlowDeps, session: Session): Promise<void> {
  const d = session.draft;
  if (!d.specialty_id || !d.scheduled_date || !d.scheduled_time || !d.patient_name) {
    await sendText(deps, "Something's missing from the appointment. Let's try again.");
    await cancelSession(deps.supabase, session.id);
    return;
  }
  const scheduledAt = combineDateTime(d.scheduled_date, d.scheduled_time);

  // Dedup: same specialty + same scheduled_at within last 5 minutes
  const { data: recent } = await deps.supabase
    .from("healthcare_appointments").select("id,scheduled_at,specialty_id,created_at")
    .eq("tenant_id", deps.tenantId).eq("contact_id", deps.contactId)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(5);
  const dup = (recent || []).find((b: any) =>
    b.specialty_id === d.specialty_id && new Date(b.scheduled_at).toISOString() === scheduledAt
  );
  if (dup) {
    session.state = "done";
    await saveSession(deps.supabase, session);
    await sendText(deps, `You're already booked for that slot. See you soon, ${d.patient_name}!`);
    return;
  }

  const duration = deps.defaultDurationMin;
  const reminderAt = new Date(new Date(scheduledAt).getTime() - deps.reminderHoursBefore * 3600_000).toISOString();
  const followupAt = new Date(new Date(scheduledAt).getTime() + deps.followupHoursAfter * 3600_000).toISOString();

  const { data: row, error } = await deps.supabase.from("healthcare_appointments").insert({
    tenant_id: deps.tenantId,
    doctor_id: d.doctor_id ?? null,
    specialty_id: d.specialty_id,
    lead_id: deps.leadId,
    contact_id: deps.contactId,
    patient_name: d.patient_name,
    patient_phone: deps.phoneNumber,
    scheduled_at: scheduledAt,
    duration_min: duration,
    reason: d.reason ?? null,
    urgency_level: "low",
    reminder_at: reminderAt,
    followup_at: followupAt,
    status: "booked",
    source: "ai_flow",
  }).select().single();

  if (error || !row) {
    console.error("healthcare finalizeBooking failed", error);
    await sendText(deps, "Sorry, something went wrong saving your appointment. Please try again.");
    return;
  }

  await deps.supabase.from("healthcare_leads").update({
    status: "booked",
    specialty_id: d.specialty_id,
    assigned_doctor_id: d.doctor_id ?? null,
  }).eq("id", deps.leadId);

  if (deps.staffNotifyPhone) {
    const ticket =
      `🗓 New healthcare appointment\n` +
      `Specialty: ${d.specialty_name}\n` +
      (d.doctor_name ? `Doctor: Dr. ${d.doctor_name}\n` : ``) +
      `When: ${d.scheduled_date} ${d.scheduled_time}\n` +
      `Patient: ${d.patient_name} (${deps.phoneNumber})`;
    fetch(`https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: deps.staffNotifyPhone, type: "text", text: { body: ticket } }),
    }).catch(() => {});
  }

  session.state = "done";
  await saveSession(deps.supabase, session);

  await sendText(deps,
    `✅ Appointment confirmed!\n🏥 ${d.specialty_name}${d.doctor_name ? `\n👨‍⚕️ Dr. ${d.doctor_name}` : ""}\n📅 ${d.scheduled_date} at ${d.scheduled_time}\n\nWe'll send you a reminder before your visit. See you, ${d.patient_name}!`
  );
}

export const START_HEALTHCARE_BOOKING_TOOL = {
  type: "function",
  function: {
    name: "start_healthcare_booking",
    description: "Start the deterministic appointment booking flow. Call AS SOON AS the patient indicates they want to book/schedule an appointment. Do NOT call for general info, lab results, or triage.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};
