// Deterministic education enrollment state machine.
// States: picking_course → student_name → student_age → parent_name → plan_type → confirm → done|cancelled
// Writes to `education_enrollments` (+ updates `education_leads`).

export interface EducationCourse {
  id: string;
  name: string;
  price?: number | null;
  currency?: string | null;
  age_group?: string | null;
  schedule?: string | null;
  start_date?: string | null;
  payment_options?: string[] | null;
  trial_available?: boolean | null;
}

export interface EducationFlowDeps {
  supabase: any;
  tenantId: string;
  contactId: string;
  leadId: string;
  phoneNumber: string;
  phoneNumberId: string;
  accessToken: string;
  courses: EducationCourse[];
  currency: string;
  staffNotifyPhone?: string | null;
  lovableApiKey?: string | null;
  conversationHistory?: Array<{ role: string; content: string }>;
  knowledgeEntries?: Array<{ title: string; content: string }>;
  preferredCourseHint?: string | null;
}

interface Draft {
  course_id?: string;
  course_name?: string;
  course_price?: number | null;
  course_currency?: string | null;
  course_payment_options?: string[];
  course_trial_available?: boolean;
  student_name?: string;
  student_age?: string;
  parent_name?: string;
  plan_type?: "full" | "installment" | "trial";
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

const FLOW_KIND = "education_enrollment";

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
  return /\b(price|cost|fee|tuition|how long|hours|schedule|start|trial|سعر|مدة|كم|يبدأ|تجريب)\b/i.test(t);
}

function matchCourse(hint: string, courses: EducationCourse[]): EducationCourse | null {
  const h = hint.toLowerCase().trim();
  if (!h) return null;
  let best = courses.find((c) => c.name.toLowerCase() === h);
  if (best) return best;
  best = courses.find((c) => c.name.toLowerCase().includes(h));
  if (best) return best;
  best = courses.find((c) => h.includes(c.name.toLowerCase()));
  if (best) return best;
  return null;
}

// ---------- whatsapp send ----------
async function sendText(deps: EducationFlowDeps, body: string) {
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

async function sendButtons(deps: EducationFlowDeps, body: string, buttons: Array<{ id: string; title: string }>) {
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
  deps: EducationFlowDeps, body: string, buttonText: string, sectionTitle: string,
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
async function maybeAnswerQuestion(deps: EducationFlowDeps, text: string, session: Session): Promise<boolean> {
  if (!deps.lovableApiKey || !text || !looksLikeQuestion(text)) return false;
  try {
    const lines = deps.courses.slice(0, 20).map((c) =>
      `- ${c.name}${c.age_group ? ` (age ${c.age_group})` : ""}${c.schedule ? ` · ${c.schedule}` : ""}${c.price != null ? ` · ${c.currency || deps.currency} ${c.price}` : ""}${c.trial_available ? ` · trial available` : ""}`
    ).join("\n");
    const kb = (deps.knowledgeEntries || []).slice(0, 6).map((e) => `### ${e.title}\n${e.content.slice(0, 500)}`).join("\n\n");
    const draftLine = [
      session.draft.course_name && `Course: ${session.draft.course_name}`,
      session.draft.student_name && `Student: ${session.draft.student_name}`,
      session.draft.plan_type && `Plan: ${session.draft.plan_type}`,
    ].filter(Boolean).join(" · ") || "(nothing chosen yet)";
    const ctx = [
      `Current step: ${session.state}`,
      `Draft: ${draftLine}`,
      `Courses:\n${lines}`,
      kb ? `Knowledge:\n${kb}` : "",
    ].filter(Boolean).join("\n\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          { role: "system", content: "You are answering a side-question from a parent during a WhatsApp school enrollment. ONE short sentence (≤20 words), mirror the parent's language. Use the courses + knowledge facts only. If unknown, say 'Let me check with the team and get back to you' in their language. Do NOT confirm or modify the enrollment." },
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
    console.error("education maybeAnswerQuestion failed", e);
    return false;
  }
}

// ---------- session ----------
export async function getActiveEducationSession(supabase: any, tenantId: string, contactId: string): Promise<Session | null> {
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

function applyPreselect(draft: Draft, courses: EducationCourse[], hint?: string | null) {
  if (!hint) return;
  const c = matchCourse(hint, courses);
  if (!c) return;
  draft.course_id = c.id;
  draft.course_name = c.name;
  draft.course_price = c.price ?? null;
  draft.course_currency = c.currency ?? null;
  draft.course_payment_options = c.payment_options ?? [];
  draft.course_trial_available = !!c.trial_available;
}

// ---------- public entry ----------
export async function startEducationFlow(deps: EducationFlowDeps): Promise<boolean> {
  const existing = await getActiveEducationSession(deps.supabase, deps.tenantId, deps.contactId);
  if (existing) {
    await sendText(deps, "You already have an enrollment in progress. Type 'cancel' to start over.");
    return false;
  }
  if (deps.courses.length === 0) {
    await sendText(deps, "Sorry, no courses are available right now.");
    return false;
  }
  const draft: Draft = {};
  applyPreselect(draft, deps.courses, deps.preferredCourseHint);
  const initialState = draft.course_id ? "student_name" : "picking_course";
  const { data: session, error } = await deps.supabase.from("order_sessions").insert({
    tenant_id: deps.tenantId, contact_id: deps.contactId,
    state: initialState, draft, pending_hints: [],
    flow_kind: FLOW_KIND,
  }).select().single();
  if (error || !session) {
    console.error("startEducationFlow: failed to create session", error);
    await sendText(deps, "Sorry, couldn't start the enrollment. Try again in a moment.");
    return false;
  }
  await advance(deps, session as Session, null);
  return true;
}

export async function handleEducationSessionMessage(
  deps: EducationFlowDeps,
  session: Session,
  text: string | null,
  interactiveId: string | null,
): Promise<void> {
  const lower = (text || "").trim().toLowerCase();
  if (lower === "cancel" || lower === "إلغاء" || lower === "الغاء") {
    await cancelSession(deps.supabase, session.id);
    await sendText(deps, "Enrollment cancelled. Reach out anytime to restart.");
    return;
  }
  await advance(deps, session, interactiveId ? { type: "interactive", id: interactiveId } : { type: "text", text: text || "" });
}

interface Incoming { type: "text" | "interactive"; text?: string; id?: string; }

function planChoicesFor(draft: Draft): Array<{ id: string; title: string }> {
  const opts = draft.course_payment_options ?? [];
  const out: Array<{ id: string; title: string }> = [];
  if (opts.includes("full") || opts.length === 0) out.push({ id: "plan_full", title: "Pay in full" });
  if (opts.includes("installment")) out.push({ id: "plan_installment", title: "Installments" });
  if (draft.course_trial_available) out.push({ id: "plan_trial", title: "Book a trial" });
  if (out.length === 0) out.push({ id: "plan_full", title: "Pay in full" });
  return out.slice(0, 3);
}

async function advance(deps: EducationFlowDeps, session: Session, incoming: Incoming | null): Promise<void> {
  switch (session.state) {
    case "picking_course": {
      if (incoming) {
        if (incoming.type === "interactive" && incoming.id?.startsWith("course_")) {
          const id = incoming.id.slice("course_".length);
          const c = deps.courses.find((x) => x.id === id);
          if (c) {
            session.draft.course_id = c.id;
            session.draft.course_name = c.name;
            session.draft.course_price = c.price ?? null;
            session.draft.course_currency = c.currency ?? null;
            session.draft.course_payment_options = c.payment_options ?? [];
            session.draft.course_trial_available = !!c.trial_available;
            session.state = "student_name";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
        }
        if (incoming.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
          if (await maybeAnswerQuestion(deps, incoming.text, session)) {
            await sendText(deps, "Which course would you like to enroll in?");
            return;
          }
        }
        if (incoming.type === "text" && incoming.text) {
          const direct = matchCourse(incoming.text, deps.courses);
          if (direct) {
            session.draft.course_id = direct.id;
            session.draft.course_name = direct.name;
            session.draft.course_price = direct.price ?? null;
            session.draft.course_currency = direct.currency ?? null;
            session.draft.course_payment_options = direct.payment_options ?? [];
            session.draft.course_trial_available = !!direct.trial_available;
            session.state = "student_name";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
          await sendText(deps, `I couldn't find "${incoming.text}". Please pick from the list:`);
        }
      }
      const rows = deps.courses.slice(0, 10).map((c) => ({
        id: `course_${c.id}`,
        title: c.name,
        description: [
          c.age_group ? `Age ${c.age_group}` : null,
          c.schedule || null,
          c.price != null ? `${c.currency || deps.currency} ${c.price}` : null,
        ].filter(Boolean).join(" · "),
      }));
      await sendList(deps, "Which course would you like to enroll in?", "View courses", "Courses", rows);
      return;
    }

    case "student_name": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "What's the student's full name?");
          return;
        }
        const name = incoming.text.trim();
        if (name.length >= 2) {
          session.draft.student_name = name;
          session.state = "student_age";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, "What's the student's full name?");
      return;
    }

    case "student_age": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "And the student's age?");
          return;
        }
        const age = normalizeDigits(incoming.text).trim();
        if (age.length >= 1 && age.length <= 30) {
          session.draft.student_age = age;
          session.state = "parent_name";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, "And the student's age?");
      return;
    }

    case "parent_name": {
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          await sendText(deps, "Parent or guardian's full name please?");
          return;
        }
        const name = incoming.text.trim();
        if (name.length >= 2) {
          session.draft.parent_name = name;
          session.state = "plan_type";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      await sendText(deps, "Parent or guardian's full name please?");
      return;
    }

    case "plan_type": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "plan_full") { session.draft.plan_type = "full"; }
        else if (incoming.id === "plan_installment") { session.draft.plan_type = "installment"; }
        else if (incoming.id === "plan_trial") { session.draft.plan_type = "trial"; }
        if (session.draft.plan_type) {
          session.state = "confirm";
          await saveSession(deps.supabase, session);
          await advance(deps, session, null);
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text) {
        if (looksLikeQuestion(incoming.text) && await maybeAnswerQuestion(deps, incoming.text, session)) {
          // re-prompt
        } else {
          const t = incoming.text.trim().toLowerCase();
          if (/full|كامل/.test(t)) session.draft.plan_type = "full";
          else if (/install|قسط|أقساط|اقساط/.test(t)) session.draft.plan_type = "installment";
          else if (/trial|تجرب|تجريب/.test(t)) session.draft.plan_type = "trial";
          if (session.draft.plan_type) {
            session.state = "confirm";
            await saveSession(deps.supabase, session);
            await advance(deps, session, null);
            return;
          }
        }
      }
      await sendButtons(deps, "How would you like to enroll?", planChoicesFor(session.draft));
      return;
    }

    case "confirm": {
      if (incoming?.type === "interactive") {
        if (incoming.id === "confirm_yes") { await finalizeEnrollment(deps, session); return; }
        if (incoming.id === "confirm_edit") {
          await sendButtons(deps, "What do you want to edit?", [
            { id: "edit_back_course", title: "Course" },
            { id: "edit_back_student", title: "Student" },
            { id: "edit_back_plan", title: "Plan" },
          ]);
          return;
        }
        if (incoming.id === "edit_back_course") {
          session.state = "picking_course"; await saveSession(deps.supabase, session); await advance(deps, session, null); return;
        }
        if (incoming.id === "edit_back_student") {
          session.state = "student_name"; await saveSession(deps.supabase, session); await sendText(deps, "What's the student's full name?"); return;
        }
        if (incoming.id === "edit_back_plan") {
          session.state = "plan_type"; await saveSession(deps.supabase, session); await advance(deps, session, null); return;
        }
        if (incoming.id === "confirm_cancel") {
          await cancelSession(deps.supabase, session.id);
          await sendText(deps, "Enrollment cancelled.");
          return;
        }
      }
      if (incoming?.type === "text" && incoming.text && looksLikeQuestion(incoming.text)) {
        await maybeAnswerQuestion(deps, incoming.text, session);
      }
      const d = session.draft;
      const planLabel = d.plan_type === "full" ? "Pay in full" : d.plan_type === "installment" ? "Installments" : "Trial class";
      const priceLine = d.course_price != null && d.plan_type !== "trial"
        ? `\n💰 ${d.course_currency || deps.currency} ${d.course_price}` : "";
      const body =
        `Please confirm the enrollment:\n\n` +
        `📚 ${d.course_name}${priceLine}\n` +
        `🎓 Student: ${d.student_name}${d.student_age ? ` (age ${d.student_age})` : ""}\n` +
        `👤 Parent: ${d.parent_name}\n` +
        `💳 ${planLabel}`;
      await sendButtons(deps, body, [
        { id: "confirm_yes", title: "✅ Confirm" },
        { id: "confirm_edit", title: "Edit" },
        { id: "confirm_cancel", title: "Cancel" },
      ]);
      return;
    }
  }
}

async function finalizeEnrollment(deps: EducationFlowDeps, session: Session): Promise<void> {
  const d = session.draft;
  if (!d.course_id || !d.student_name || !d.parent_name || !d.plan_type) {
    await sendText(deps, "Something's missing from your enrollment. Let's try again.");
    await cancelSession(deps.supabase, session.id);
    return;
  }

  // Dedup: same course + same student in last 10 minutes
  const { data: recent } = await deps.supabase
    .from("education_enrollments").select("id,course_id,student_name,created_at")
    .eq("tenant_id", deps.tenantId).eq("contact_id", deps.contactId)
    .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()).limit(5);
  const dup = (recent || []).find((b: any) =>
    b.course_id === d.course_id && (b.student_name || "").toLowerCase() === (d.student_name || "").toLowerCase()
  );
  if (dup) {
    session.state = "done";
    await saveSession(deps.supabase, session);
    await sendText(deps, `${d.student_name} is already enrolled in ${d.course_name}. We'll be in touch shortly.`);
    return;
  }

  const status = d.plan_type === "trial" ? "trial" : "active";
  const paymentStatus = d.plan_type === "trial" ? "pending" : "pending";

  const { data: row, error } = await deps.supabase.from("education_enrollments").insert({
    tenant_id: deps.tenantId,
    course_id: d.course_id,
    lead_id: deps.leadId,
    contact_id: deps.contactId,
    student_name: d.student_name,
    student_age: d.student_age ?? null,
    parent_name: d.parent_name,
    parent_phone: deps.phoneNumber,
    plan_type: d.plan_type,
    payment_status: paymentStatus,
    amount_paid: 0,
    status,
    source: "ai_flow",
  }).select().single();

  if (error || !row) {
    console.error("education finalizeEnrollment failed", error);
    await sendText(deps, "Sorry, something went wrong saving the enrollment. Please try again.");
    return;
  }

  await deps.supabase.from("education_leads").update({
    status: d.plan_type === "trial" ? "trial_booked" : "enrolled",
    course_id: d.course_id,
    student_name: d.student_name,
    student_age: d.student_age ?? null,
    parent_name: d.parent_name,
  }).eq("id", deps.leadId);

  if (deps.staffNotifyPhone) {
    const planLabel = d.plan_type === "full" ? "Pay in full" : d.plan_type === "installment" ? "Installments" : "Trial class";
    const ticket =
      `🎓 New enrollment\n` +
      `Course: ${d.course_name}\n` +
      `Student: ${d.student_name}${d.student_age ? ` (age ${d.student_age})` : ""}\n` +
      `Parent: ${d.parent_name} (${deps.phoneNumber})\n` +
      `Plan: ${planLabel}`;
    fetch(`https://graph.facebook.com/v21.0/${deps.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: deps.staffNotifyPhone, type: "text", text: { body: ticket } }),
    }).catch(() => {});
  }

  session.state = "done";
  await saveSession(deps.supabase, session);

  const closing = d.plan_type === "trial"
    ? `✅ Trial booked for ${d.student_name} in ${d.course_name}. A staff member will confirm the schedule shortly.`
    : `✅ Enrollment recorded for ${d.student_name} in ${d.course_name}. A staff member will follow up with payment details${d.plan_type === "installment" ? " and an installment plan" : ""}.`;
  await sendText(deps, closing);
}

// Tool definition for the AI
export const START_EDUCATION_ENROLLMENT_TOOL = {
  type: "function",
  function: {
    name: "start_education_enrollment",
    description: "Start the deterministic enrollment flow. Call this AS SOON AS the parent wants to enroll a student or book a trial. Do NOT call for general course-info questions.",
    parameters: {
      type: "object",
      properties: {
        course_name: { type: "string", description: "If the parent already named a course, pass it so the flow can preselect it." },
      },
      additionalProperties: false,
    },
  },
};
