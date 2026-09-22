// Deterministic real-estate viewing booking state machine.
// States: picking_listing → picking_date → picking_time → name → confirm → done|cancelled
//
// Writes to `viewings` (+ updates `leads`).

export interface RealEstateListing {
  id: string;
  title: string;
  kind?: string | null;
  property_type?: string | null;
  price?: number | null;
  currency?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area_sqm?: number | null;
  area_name?: string | null;
  region?: string | null;
  agent_id?: string | null;
}

export interface RealEstateFlowDeps {
  supabase: any;
  tenantId: string;
  contactId: string;
  leadId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  listings: RealEstateListing[];
  currency: string;
  viewingDurationMin: number;
  reminderHoursBefore: number;
  followupHoursAfter: number;
  openHour?: number;
  closeHour?: number;
  slotStepMin?: number;
  agentNotifyPhone?: string | null;
  lovableApiKey?: string | null;
  conversationHistory?: Array<{ role: string; content: string }>;
  knowledgeEntries?: Array<{ title: string; content: string }>;
  preselectedListingId?: string | null; // from AI tool args
}

interface Draft {
  listing_id?: string;
  listing_title?: string;
  listing_price?: number | null;
  listing_agent_id?: string | null;
  scheduled_date?: string;
  scheduled_time?: string;
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

const FLOW_KIND = "real_estate_viewing";

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
  return /\b(price|cost|bedrooms|bathrooms|area|sqm|sq m|floor|parking|view|سعر|غرف|حمام|مساحة)\b/i.test(t);
}

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

function matchListing(hint: string, listings: RealEstateListing[]): RealEstateListing | null {
  const h = hint.toLowerCase().trim();
  if (!h) return null;
  let best = listings.find((l) => l.title.toLowerCase() === h);
  if (best) return best;
  best = listings.find((l) => l.title.toLowerCase().includes(h));
  if (best) return best;
  best = listings.find((l) => h.includes(l.title.toLowerCase()));
  return best ?? null;
}

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00Z`).toISOString();
}

function listingSummary(l: RealEstateListing, fallbackCurrency: string): string {
  const parts: string[] = [];
  if (l.bedrooms) parts.push(`${l.bedrooms}BR`);
  if (l.bathrooms) parts.push(`${l.bathrooms}BA`);
  if (l.area_sqm) parts.push(`${l.area_sqm}m²`);
  if (l.area_name) parts.push(l.area_name);
  if (l.price != null) parts.push(`${l.currency || fallbackCurrency} ${Number(l.price).toLocaleString()}`);
  return parts.join(" · ");
}

// ---------- whatsapp send helpers ----------
async function sendText(deps: RealEstateFlowDeps, body: string) {
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

async function sendButtons(deps: RealEstateFlowDeps, body: string, buttons: Array<{ id: string; title: string }>) {
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
  deps: RealEstateFlowDeps,
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
async function maybeAnswerQuestion(deps: RealEstateFlowDeps, text: string, session: Session): Promise<boolean> {
  if (!deps.lovableApiKey || !text || !looksLikeQuestion(text)) return false;
  try {
    const lstLines = deps.listings.slice(0, 20).map((l) =>
      `- ${l.title}${l.property_type ? ` · ${l.property_type}` : ""} · ${listingSummary(l, deps.currency)}`
    ).join("\n");
    const kb = (deps.knowledgeEntries || []).slice(0, 6).map((e) => `### ${e.title}\n${e.content.slice(0, 500)}`).join("\n\n");
    const draftLine = [
      session.draft.listing_title && `Listing: ${session.draft.listing_title}`,
      session.draft.scheduled_date && `Date: ${session.draft.scheduled_date}`,
      session.draft.scheduled_time && `Time: ${session.draft.scheduled_time}`,
    ].filter(Boolean).join(" · ") || "(nothing chosen yet)";
    const ctx = [
      `Current step: ${session.state}`,
      `Draft: ${draftLine}`,
      `Listings:\n${lstLines}`,
      kb ? `Knowledge:\n${kb}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "You are answering a side-question during a WhatsApp property viewing booking. ONE short sentence (≤20 words), mirror the customer's language. Use listings + knowledge facts only. If unknown, say 'Let me check with the agent and get back to you' in their language. Do NOT confirm or modify the booking." },
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
    console.error("real-estate maybeAnswerQuestion failed", e);
    return false;
  }
}

// ---------- session ----------
export async function getActiveRealEstateSession(supabase: any, tenantId: string, contactId: string): Promise<Session | null> {
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
export async function startRealEstateFlow(deps: RealEstateFlowDeps): Promise<boolean> {
  const existing = await getActiveRealEstateSession(deps.supabase, deps.tenantId, deps.contactId);
  if (existing) {
    await sendText(deps, "You already have a viewing in progress. Type 'cancel' to start over.");
    return false;
  }
  if (deps.listings.length === 0) {
    await sendText(deps, "Sorry, no listings are available right now.");
    return false;
  }
  const initialDraft: Draft = {};
  let initialState = "picking_listing";
  if (deps.preselectedListingId) {
    const l = deps.listings.find((x) => x.id === deps.preselectedListingId);
    if (l) {
      initialDraft.listing_id = l.id;
      initialDraft.listing_title = l.title;
      initialDraft.listing_price = l.price ?? null;
      initialDraft.listing_agent_id = l.agent_id ?? null;
      initialState = "picking_date";
    }
  }
  const { data: session, error } = await deps.supabase.from("order_sessions").insert({
    tenant_id: deps.tenantId,
    contact_id: deps.contactId,
    state: initialState,
    draft: initialDraft,
    pending_hints: [],
    flow_kind: FLOW_KIND,
  }).select().single();
  if (error || !session) {
    console.error("startRealEstateFlow: failed to create session", error);
    await sendText(deps, "Sorry, couldn't start the booking. Try again in a moment.");
    return false;
  }
  await advance(deps, session as Session, null);
  return true;
}

export async function handleRealEstateSessionMessage(
  deps: RealEstateFlowDeps,
  session: Session,
  text: string | null,
  interactiveId: string | null,
): Promise<void> {
  const lower = (text || "").trim().toLowerCase();
  if (lower === "cancel" || lower === "إلغاء" || lower === "الغاء") {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, "Viewing cancelled. Let us know when you'd like to reschedule.");
    return;
  }
  await advance(deps, session, interactiveId ? { type: "interactive", id: interactiveId } : { type: "text", text: text || "" });
}

interface Incoming { type: "text" | "interactive"; text?: string; id?: string; }

async function advance(deps: RealEstateFlowDeps, session: Session, incoming: Incoming | null): Promise<void> {
  switch (session.state) {
    case "picking_listing": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("lst_")) {
          const id = incoming.id.slice("lst_".length);
          const l = deps.listings.find((x) => x.id === id);
          if (l) {
            session.draft.listing_id = l.id;
            session.draft.listing_title = l.title;
            session.draft.listing_price = l.price ?? null;
            session.draft.listing_agent_id = l.agent_id ?? null;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Which property would you like to view?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const direct = matchListing(incoming.text, deps.listings);
          if (direct) {
            session.draft.listing_id = direct.id;
            session.draft.listing_title = direct.title;
            session.draft.listing_price = direct.price ?? null;
            session.draft.listing_agent_id = direct.agent_id ?? null;
            session.state = "picking_date";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, `I couldn't find "${incoming.text}". Please pick from the list:`);
        }
      }
      const rows = deps.listings.slice(0, 10).map((l) => ({
        id: `lst_${l.id}`,
        title: l.title,
        description: listingSummary(l, deps.currency),
      }));
      await sendList(deps, "Which property would you like to view?", "View listings", "Listings", rows);
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
      await sendText(deps, "What name should we put on the viewing?");
      return;
    }

    case "confirm": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "confirm_yes") {
          await finalizeViewing(deps, session);
          return;
        }
        if (incoming.id === "confirm_edit") {
          await sendButtons(deps, "What do you want to edit?", [
            { id: "edit_back_listing", title: "Property" },
            { id: "edit_back_date", title: "Date / time" },
            { id: "edit_back_name", title: "Name" },
          ]);
          return;
        }
        if (incoming.id === "edit_back_listing") {
          session.state = "picking_listing";
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
          await sendText(deps, "What name should we put on the viewing?");
          return;
        }
        if (incoming.id === "confirm_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, "Viewing cancelled.");
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        if (await maybeAnswerQuestion(deps, incoming.text, session)) { /* redisplay */ }
      }
      const d = session.draft;
      const priceLine = d.listing_price != null ? `\nPrice: ${deps.currency} ${Number(d.listing_price).toLocaleString()}` : "";
      const body =
        `Please confirm your viewing:\n\n` +
        `🏠 ${d.listing_title}${priceLine}\n` +
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

async function finalizeViewing(deps: RealEstateFlowDeps, session: Session): Promise<void> {
  const d = session.draft;
  if (!d.listing_id || !d.scheduled_date || !d.scheduled_time || !d.customer_name) {
    await sendText(deps, "Something's missing from your viewing. Let's try again.");
    await cancelSession(deps.supabase, session.id);
    return;
  }
  const scheduledAt = combineDateTime(d.scheduled_date, d.scheduled_time);

  // Dedup: same listing + same scheduled_at within last 5 minutes
  const { data: recent } = await deps.supabase
    .from("viewings").select("id,scheduled_at,listing_id,created_at")
    .eq("tenant_id", deps.tenantId).eq("contact_id", deps.contactId)
    .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()).limit(5);
  const dup = (recent || []).find((v: any) =>
    v.listing_id === d.listing_id && new Date(v.scheduled_at).toISOString() === scheduledAt
  );
  if (dup) {
    session.state = "done";
    await saveSession(deps.supabase, session);
    await sendText(deps, `You're already booked for that viewing. See you soon, ${d.customer_name}!`);
    return;
  }

  const duration = deps.viewingDurationMin ?? 30;
  const reminderAt = new Date(new Date(scheduledAt).getTime() - deps.reminderHoursBefore * 3600_000).toISOString();
  const followupAt = new Date(new Date(scheduledAt).getTime() + deps.followupHoursAfter * 3600_000).toISOString();

  const { data: row, error } = await deps.supabase.from("viewings").insert({
    tenant_id: deps.tenantId,
    listing_id: d.listing_id,
    lead_id: deps.leadId,
    contact_id: deps.contactId,
    agent_id: d.listing_agent_id ?? null,
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
    console.error("real-estate finalizeViewing failed", error);
    await sendText(deps, "Sorry, something went wrong saving your viewing. Please try again.");
    return;
  }

  await deps.supabase.from("leads").update({
    status: "viewing_booked",
  }).eq("id", deps.leadId);

  if (deps.agentNotifyPhone) {
    const ticket =
      `🗓 New viewing\n` +
      `Property: ${d.listing_title}\n` +
      `When: ${d.scheduled_date} ${d.scheduled_time}\n` +
      `Customer: ${d.customer_name} (${deps.phoneNumber})`;
    fetch(`https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: deps.agentNotifyPhone, type: "text", text: { body: ticket } }),
    }).catch(() => {});
  }

  session.state = "done";
  await saveSession(deps.supabase, session);

  await sendText(deps,
    `✅ Viewing confirmed!\n🏠 ${d.listing_title}\n📅 ${d.scheduled_date} at ${d.scheduled_time}\n\nWe'll send you a reminder before the visit. See you soon, ${d.customer_name}!`
  );
}

// Tool definition for the AI
export const START_REAL_ESTATE_VIEWING_TOOL = {
  type: "function",
  function: {
    name: "start_real_estate_viewing",
    description: "Start the deterministic viewing booking flow. Call AS SOON AS the customer indicates they want to schedule/book a viewing or visit a specific property. Pass listing_title if the customer already picked one — it will be pre-selected. Do NOT call for general qualification or info.",
    parameters: {
      type: "object",
      properties: {
        listing_title: { type: "string", description: "Optional. Title of the listing they want to view (must match an active listing)." },
      },
      additionalProperties: false,
    },
  },
};
