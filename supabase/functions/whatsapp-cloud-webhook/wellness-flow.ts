// Deterministic wellness booking state machine.
// States: picking_service → picking_date → picking_time → name → confirm → done|cancelled
//         (+ editing_service, editing_date, editing_time, editing_name)
//
// Writes to `wellness_sessions` (+ updates `wellness_leads`).
// Same shape as restaurant-flow.ts so future verticals (healthcare, real-estate, education)
// can reuse the slot-picker helpers.

export interface WellnessService {
  id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  duration_min?: number | null;
  category?: string | null;
}

export interface WellnessStaff {
  id: string;
  name: string;
}

export interface WellnessFlowDeps {
  supabase: any;
  tenantId: string;
  contactId: string;
  leadId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  services: WellnessService[];
  staff: WellnessStaff[];
  currency: string;
  defaultDurationMin: number;
  reminderHoursBefore: number;
  followupHoursAfter: number;
  studioTimezoneOffsetMin?: number; // optional, defaults to UTC
  openHour?: number;  // e.g. 9
  closeHour?: number; // e.g. 19
  slotStepMin?: number; // e.g. 60
  staffNotifyPhone?: string | null;
  lovableApiKey?: string | null;
  conversationHistory?: Array<{ role: string; content: string }>;
  knowledgeEntries?: Array<{ title: string; content: string }>;
}

interface Draft {
  service_id?: string;
  service_name?: string;
  service_price?: number | null;
  service_duration_min?: number;
  staff_id?: string | null;
  staff_name?: string | null;
  scheduled_date?: string; // YYYY-MM-DD
  scheduled_time?: string; // HH:MM (24h)
  scheduled_at?: string;   // ISO
  customer_name?: string;
  notes?: string;
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

const FLOW_KIND = "wellness_booking";

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
  return /\b(price|cost|duration|how long|hours|open|close|cancel policy|سعر|مدة|كم|مفتوح)\b/i.test(t);
}

function pad2(n: number): string { return n < 10 ? `0${n}` : String(n); }

function todayISODate(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// Build N upcoming dates (today + N-1 days) as { id, label, value }
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

function buildTimeOptions(openHour = 9, closeHour = 19, stepMin = 60): Array<{ id: string; label: string; value: string }> {
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

// Parse free-text dates like "tomorrow", "next monday", "2025-12-30", "30/12"
function parseFreeTextDate(input: string): string | null {
  const t = normalizeDigits(input).trim().toLowerCase();
  if (!t) return null;
  if (/\b(today|اليوم)\b/.test(t)) return todayISODate();
  if (/\b(tomorrow|بكرا|بكرة|غدا|غداً)\b/.test(t)) {
    const d = new Date(Date.now() + 86400_000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  // YYYY-MM-DD
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  // DD/MM or DD/MM/YYYY
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
  if (m) {
    const d = +m[1], mo = +m[2];
    let y = m[3] ? +m[3] : new Date().getUTCFullYear();
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  // weekday name
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

// Parse "3pm", "15:00", "3:30 pm", "١٥:٠٠"
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

function matchService(hint: string, services: WellnessService[]): WellnessService | null {
  const h = hint.toLowerCase().trim();
  if (!h) return null;
  let best = services.find((s) => s.name.toLowerCase() === h);
  if (best) return best;
  best = services.find((s) => s.name.toLowerCase().includes(h));
  if (best) return best;
  best = services.find((s) => h.includes(s.name.toLowerCase()));
  if (best) return best;
  return null;
}

function combineDateTime(date: string, time: string): string {
  // Interpret as UTC. Studios can adjust later via offset.
  return new Date(`${date}T${time}:00Z`).toISOString();
}

// ---------- whatsapp send helpers ----------
async function sendText(deps: WellnessFlowDeps, body: string) {
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

async function sendButtons(deps: WellnessFlowDeps, body: string, buttons: Array<{ id: string; title: string }>) {
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
  deps: WellnessFlowDeps,
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
async function maybeAnswerQuestion(deps: WellnessFlowDeps, text: string, session: Session): Promise<boolean> {
  if (!deps.lovableApiKey || !text || !looksLikeQuestion(text)) return false;
  try {
    const svcLines = deps.services.slice(0, 20).map((s) =>
      `- ${s.name}${s.duration_min ? ` · ${s.duration_min}min` : ""}${s.price != null ? ` · ${s.currency || deps.currency} ${s.price}` : ""}${s.category ? ` · ${s.category}` : ""}`
    ).join("\n");
    const kb = (deps.knowledgeEntries || []).slice(0, 6).map((e) => `### ${e.title}\n${e.content.slice(0, 500)}`).join("\n\n");
    const draftLine = [
      session.draft.service_name && `Service: ${session.draft.service_name}`,
      session.draft.scheduled_date && `Date: ${session.draft.scheduled_date}`,
      session.draft.scheduled_time && `Time: ${session.draft.scheduled_time}`,
    ].filter(Boolean).join(" · ") || "(nothing chosen yet)";
    const ctx = [
      `Current step: ${session.state}`,
      `Draft: ${draftLine}`,
      `Services:\n${svcLines}`,
      kb ? `Knowledge:\n${kb}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "You are answering a side-question during a WhatsApp wellness booking. ONE short sentence (≤20 words), mirror the customer's language. Use services + knowledge facts only. If unknown, say 'Let me check with the team and get back to you' in their language. Do NOT confirm or modify the booking." },
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
    console.error("wellness maybeAnswerQuestion failed", e);
    return false;
  }
}

// ---------- session ----------
export async function getActiveWellnessSession(supabase: any, tenantId: string, contactId: string): Promise<Session | null> {
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
export async function startWellnessFlow(deps: WellnessFlowDeps): Promise<boolean> {
  const existing = await getActiveWellnessSession(deps.supabase, deps.tenantId, deps.contactId);
  if (existing) {
    await sendText(deps, "You already have a booking in progress. Type 'cancel' to start over.");
    return false;
  }
  if (deps.services.length === 0) {
    await sendText(deps, "Sorry, no services are available right now.");
    return false;
  }
  const { data: session, error } = await deps.supabase.from("order_sessions").insert({
    tenant_id: deps.tenantId,
    contact_id: deps.contactId,
    state: "picking_service",
    draft: {} as Draft,
    pending_hints: [],
    flow_kind: FLOW_KIND,
  }).select().single();
  if (error || !session) {
    console.error("startWellnessFlow: failed to create session", error);
    await sendText(deps, "Sorry, couldn't start the booking. Try again in a moment.");
    return false;
  }
  await advance(deps, session as Session, null);
  return true;
}

export async function handleWellnessSessionMessage(
  deps: WellnessFlowDeps,
  session: Session,
  text: string | null,
  interactiveId: string | null,
): Promise<void> {
  const lower = (text || "").trim().toLowerCase();
  if (lower === "cancel" || lower === "إلغاء" || lower === "الغاء") {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, "Booking cancelled. Let us know when you'd like to reschedule.");
    return;
  }
  await advance(deps, session, interactiveId ? { type: "interactive", id: interactiveId } : { type: "text", text: text || "" });
}

interface Incoming { type: "text" | "interactive"; text?: string; id?: string; }

async function advance(deps: WellnessFlowDeps, session: Session, incoming: Incoming | null): Promise<void> {
  switch (session.state) {
    case "picking_service": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("svc_")) {
          const id = incoming.id.slice("svc_".length);
          const s = deps.services.find((x) => x.id === id);
          if (s) {
            session.draft.service_id = s.id;
            session.draft.service_name = s.name;
            session.draft.service_price = s.price ?? null;
            session.draft.service_duration_min = s.duration_min ?? deps.defaultDurationMin;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Which service would you like to book?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const direct = matchService(incoming.text, deps.services);
          if (direct) {
            session.draft.service_id = direct.id;
            session.draft.service_name = direct.name;
            session.draft.service_price = direct.price ?? null;
            session.draft.service_duration_min = direct.duration_min ?? deps.defaultDurationMin;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, `I couldn't find "${incoming.text}". Please pick from the list:`);
        }
      }
      const rows = deps.services.slice(0, 10).map((s) => ({
        id: `svc_${s.id}`,
        title: s.name,
        description: [
          s.duration_min ? `${s.duration_min}min` : null,
          s.price != null ? `${s.currency || deps.currency} ${s.price}` : null,
        ].filter(Boolean).join(" · "),
      }));
      await sendList(deps, "Which service would you like to book?", "View services", "Services", rows);
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
      const times = buildTimeOptions(deps.openHour ?? 9, deps.closeHour ?? 19, deps.slotStepMin ?? 60);
      await sendList(deps, `Pick a time for ${session.draft.scheduled_date}:`, "Pick a time", "Available times",
        times.slice(0, 10).map((t) => ({ id: t.id, title: t.label })));
      return;
    }

    case "name": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "And your full name please?");
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
      await sendText(deps, "What name should we put on the booking?");
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
            { id: "edit_back_service", title: "Service" },
            { id: "edit_back_date", title: "Date / time" },
            { id: "edit_back_name", title: "Name" },
          ]);
          return;
        }
        if (incoming.id === "edit_back_service") {
          session.state = "picking_service";
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
          await sendText(deps, "What name should we put on the booking?");
          return;
        }
        if (incoming.id === "confirm_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, "Booking cancelled.");
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        if (await maybeAnswerQuestion(deps, incoming.text, session)) { /* redisplay */ }
      }
      const d = session.draft;
      const priceLine = d.service_price != null ? `\nPrice: ${deps.currency} ${d.service_price}` : "";
      const durLine = d.service_duration_min ? `\nDuration: ${d.service_duration_min} min` : "";
      const body =
        `Please confirm your booking:\n\n` +
        `💆 ${d.service_name}${priceLine}${durLine}\n` +
        `📅 ${d.scheduled_date} at ${d.scheduled_time}\n` +
        `👤 ${d.customer_name}`;
      await sendButtons(deps, body, [
        { id: "confirm_yes", title: "✅ Confirm" },
        { id: "confirm_edit", title: "Edit" },
        { id: "confirm_cancel", title: "Cancel" },
      ]);
      return;
    }
  }
}

async function finalizeBooking(deps: WellnessFlowDeps, session: Session): Promise<void> {
  const d = session.draft;
  if (!d.service_id || !d.scheduled_date || !d.scheduled_time || !d.customer_name) {
    await sendText(deps, "Something's missing from your booking. Let's try again.");
    await cancelSession(deps.supabase, session.id);
    return;
  }
  const scheduledAt = combineDateTime(d.scheduled_date, d.scheduled_time);

  // Dedup: same service + same scheduled_at within last 5 minutes
  const { data: recent } = await deps.supabase
    .from("wellness_sessions").select("id,scheduled_at,service_id,created_at")
    .eq("tenant_id", deps.tenantId).eq("contact_id", deps.contactId)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(5);
  const dup = (recent || []).find((b: any) =>
    b.service_id === d.service_id && new Date(b.scheduled_at).toISOString() === scheduledAt
  );
  if (dup) {
    session.state = "done";
    await saveSession(deps.supabase, session);
    await sendText(deps, `You're already booked for that slot. See you soon, ${d.customer_name}!`);
    return;
  }

  const duration = d.service_duration_min ?? deps.defaultDurationMin;
  const reminderAt = new Date(new Date(scheduledAt).getTime() - deps.reminderHoursBefore * 3600_000).toISOString();
  const followupAt = new Date(new Date(scheduledAt).getTime() + deps.followupHoursAfter * 3600_000).toISOString();

  const { data: row, error } = await deps.supabase.from("wellness_sessions").insert({
    tenant_id: deps.tenantId,
    service_id: d.service_id,
    staff_id: d.staff_id ?? null,
    lead_id: deps.leadId,
    contact_id: deps.contactId,
    guest_name: d.customer_name,
    guest_phone: deps.phoneNumber,
    scheduled_at: scheduledAt,
    duration_min: duration,
    notes: d.notes ?? null,
    reminder_at: reminderAt,
    followup_at: followupAt,
    status: "booked",
    source: "ai_flow",
  }).select().single();

  if (error || !row) {
    console.error("wellness finalizeBooking failed", error);
    await sendText(deps, "Sorry, something went wrong saving your booking. Please try again.");
    return;
  }

  await deps.supabase.from("wellness_leads").update({
    status: "booked",
    service_id: d.service_id,
  }).eq("id", deps.leadId);

  if (deps.staffNotifyPhone) {
    const ticket =
      `🗓 New booking\n` +
      `Service: ${d.service_name}\n` +
      `When: ${d.scheduled_date} ${d.scheduled_time}\n` +
      `Customer: ${d.customer_name} (${deps.phoneNumber})`;
    fetch(`https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: deps.staffNotifyPhone, type: "text", text: { body: ticket } }),
    }).catch(() => {});
  }

  session.state = "done";
  await saveSession(deps.supabase, session);

  await sendText(deps,
    `✅ Booking confirmed!\n💆 ${d.service_name}\n📅 ${d.scheduled_date} at ${d.scheduled_time}\n\nWe'll send you a reminder before your session. See you soon, ${d.customer_name}!`
  );
}

// Tool definition for the AI
export const START_WELLNESS_BOOKING_TOOL = {
  type: "function",
  function: {
    name: "start_wellness_booking",
    description: "Start the deterministic booking flow. Call this AS SOON AS the customer indicates they want to book a session/service. Do NOT call for general info or package questions.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};
