// Real estate vertical flow — isolated from e-commerce and restaurant.
// Only invoked when tenant.vertical === 'real_estate'. Writes go ONLY to
// listings/leads/viewings/agents (all guarded by guard_real_estate_only trigger).

import {
  getActiveRealEstateSession,
  handleRealEstateSessionMessage,
  startRealEstateFlow,
  START_REAL_ESTATE_VIEWING_TOOL,
  type RealEstateFlowDeps,
} from "./real-estate-flow.ts";

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
    console.error("real_estate sendText", e);
    return false;
  }
}

async function getSettings(supabase: any, tenantId: string) {
  const { data } = await supabase.from("real_estate_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  return data ?? {
    currency: "USD",
    budget_brackets: [],
    areas_covered: [],
    viewing_duration_min: 30,
    followup_hours_after: 24,
    reminder_hours_before: 2,
    languages: ["en", "ar", "fr"],
    google_sheet_url: null,
    calendly_url: null,
    crm_webhook_url: null,
    human_transfer_phone: null,
  };
}

async function getOrCreateLead(supabase: any, tenantId: string, contactId: string) {
  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .not("status", "in", "(closed_won,closed_lost)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;
  const { data } = await supabase.from("leads").insert({
    tenant_id: tenantId, contact_id: contactId, status: "new", source: "ai",
  }).select().single();
  return data;
}

async function loadListingsSummary(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("listings")
    .select("id,kind,property_type,title,price,currency,bedrooms,bathrooms,area_sqm,area_name,region,images,agent_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .limit(200);
  return data ?? [];
}

function formatListing(l: any, currency: string) {
  const parts = [
    `${l.title}`,
    l.price ? `${l.currency || currency} ${Number(l.price).toLocaleString()}` : "",
    l.bedrooms ? `${l.bedrooms}BR` : "",
    l.bathrooms ? `${l.bathrooms}BA` : "",
    l.area_sqm ? `${l.area_sqm}m²` : "",
    l.area_name || "",
  ].filter(Boolean);
  return `• ${parts.join(" · ")}`;
}

function buildSystemPrompt(rs: any, listingsCount: number) {
  const areas = (rs.areas_covered || []).join(", ") || "(any)";
  const brackets = (rs.budget_brackets || []).map((b: any) =>
    typeof b === "string" ? b : `${b.min ?? "?"}-${b.max ?? "?"} ${rs.currency}`
  ).join(", ") || "(open)";
  const langs = (rs.languages || ["en"]).join("/");
  return `You are a real estate WhatsApp assistant. Reply in ${langs} matching the customer's language.

ABSOLUTE RULES:
- One short sentence per reply (max ~15 words), EXCEPT when listing matched properties or reading back a viewing.
- NEVER invent listings, prices, agents, or details. Only use what tools return.
- NEVER auto-fill customer info — always ask.

AREAS COVERED: ${areas}
BUDGET BRACKETS: ${brackets}
ACTIVE LISTINGS AVAILABLE: ${listingsCount}
${rs.calendly_url ? `CALENDLY: ${rs.calendly_url}` : ""}

==== 6-STEP FLOW ====

STEP 1 — GREETING + INTENT
First message: greet briefly and ask "Buying or renting?". Save intent via set_lead_intent.

STEP 2 — QUALIFY (max 3 questions)
Ask budget range, preferred area(s), property type (apartment/villa/office/land). Save via update_lead.
Validate areas against AREAS COVERED. If the area is not covered, say so politely and offer the closest match or handover.

STEP 3 — MATCHING LISTINGS
Call match_listings with the lead's criteria. Present 2–3 results MAX in one message, each as a short bullet.
For each listing the customer wants to see photos of, call send_image with the listing title.

STEP 4 — VIEWING APPOINTMENT (CRITICAL — programmatic, not you)
As SOON as the customer says they want to view / visit / schedule a viewing for a property, call the tool start_real_estate_viewing.
If the customer already picked a specific listing, pass its exact title via listing_title so it pre-selects.
The tool takes over: it picks the listing (if needed), date, time, asks for name, and confirms — deterministically.
You do NOT take the booking yourself, do NOT call book_viewing, and do NOT collect date/time/name once you've called start_real_estate_viewing.
While the programmatic flow is active, any new messages from the customer are routed to that flow (you will not see them).

STEP 5 — ROUTE TO AGENT
Right after a viewing is booked, call route_lead to assign the best-matching agent.
The agent is notified automatically — confirm to the customer that the agent will be in touch.

STEP 6 — POST-VIEWING (handled automatically by cron, not your job)
The system sends a 24h follow-up. You do NOT need to send it.

==== HANDOFF ====
Call handover_to_human(reason) when:
- Customer asks for a human / manager
- Complaint or angry tone
- VIP / luxury request beyond catalog
- Anything off-topic / out of scope
Reasons: "human_request" | "complaint" | "vip" | "off_topic" | "other".
After handoff, do NOT continue qualifying. Tell the customer a human will reach out shortly.

Reply now.`;
}

const TOOLS = [
  { type: "function", function: { name: "set_lead_intent", description: "Save buy or rent intent.",
    parameters: { type: "object", properties: { intent: { type: "string", enum: ["buy", "rent"] } }, required: ["intent"], additionalProperties: false } } },
  { type: "function", function: { name: "update_lead", description: "Update qualification fields on the lead.",
    parameters: { type: "object", properties: {
      budget_min: { type: "number" }, budget_max: { type: "number" },
      preferred_areas: { type: "array", items: { type: "string" } },
      property_type: { type: "string" }, bedrooms_min: { type: "number" }, notes: { type: "string" },
    }, additionalProperties: false } } },
  { type: "function", function: { name: "match_listings", description: "Find 2-3 matching active listings using the lead's criteria.",
    parameters: { type: "object", properties: {
      kind: { type: "string", enum: ["buy", "rent"] },
      property_type: { type: "string" },
      budget_min: { type: "number" }, budget_max: { type: "number" },
      area: { type: "string" }, bedrooms_min: { type: "number" },
    }, additionalProperties: false } } },
  { type: "function", function: { name: "send_image", description: "Send a listing photo by listing title.",
    parameters: { type: "object", properties: { listing_title: { type: "string" }, caption: { type: "string" } }, required: ["listing_title"], additionalProperties: false } } },
  { type: "function", function: { name: "book_viewing", description: "Schedule a property viewing.",
    parameters: { type: "object", properties: {
      listing_title: { type: "string" }, guest_name: { type: "string" },
      scheduled_at: { type: "string", description: "ISO 8601 timestamp" }, notes: { type: "string" },
    }, required: ["listing_title", "guest_name", "scheduled_at"], additionalProperties: false } } },
  { type: "function", function: { name: "route_lead", description: "Assign the best-matching agent and notify them.",
    parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "handover_to_human", description: "Escalate to a human.",
    parameters: { type: "object", properties: {
      reason: { type: "string", enum: ["human_request", "complaint", "vip", "off_topic", "other"] },
      summary: { type: "string" },
    }, required: ["reason", "summary"], additionalProperties: false } } },
  START_REAL_ESTATE_VIEWING_TOOL,
];

async function execTool(name: string, args: any, ctx: any): Promise<string> {
  const { supabase, tenantId, contact, phoneNumber, listings, rs, lead } = ctx;

  if (name === "start_real_estate_viewing") {
    let preselectedListingId: string | null = null;
    if (args.listing_title) {
      const t = String(args.listing_title).toLowerCase();
      const hit = listings.find((x: any) => x.title?.toLowerCase() === t)
        || listings.find((x: any) => x.title?.toLowerCase().includes(t));
      if (hit) preselectedListingId = hit.id;
    }
    const deps: RealEstateFlowDeps = {
      supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
      phoneNumberId: ctx.tenantPhoneNumberId, accessToken: ctx.tenantAccessToken,
      listings: listings.map((l: any) => ({
        id: l.id, title: l.title, kind: l.kind ?? null, property_type: l.property_type ?? null,
        price: l.price ?? null, currency: l.currency ?? rs.currency,
        bedrooms: l.bedrooms ?? null, bathrooms: l.bathrooms ?? null,
        area_sqm: l.area_sqm ?? null, area_name: l.area_name ?? null,
        region: l.region ?? null, agent_id: l.agent_id ?? null,
      })),
      currency: rs.currency || "USD",
      viewingDurationMin: rs.viewing_duration_min ?? 30,
      reminderHoursBefore: rs.reminder_hours_before ?? 2,
      followupHoursAfter: rs.followup_hours_after ?? 24,
      openHour: rs.open_hour ?? 9,
      closeHour: rs.close_hour ?? 19,
      slotStepMin: rs.slot_step_min ?? 60,
      agentNotifyPhone: rs.human_transfer_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: ctx.conversationHistory,
      preselectedListingId,
    };
    const started = await startRealEstateFlow(deps);
    if (started) ctx.flowStarted = true;
    return started ? "__FLOW_STARTED__" : "Could not start viewing flow.";
  }


  if (name === "set_lead_intent") {
    await supabase.from("leads").update({ intent: args.intent, status: "qualified" }).eq("id", lead.id);
    ctx.lead.intent = args.intent;
    return `Saved intent=${args.intent}.`;
  }

  if (name === "update_lead") {
    const patch: any = {};
    for (const k of ["budget_min", "budget_max", "preferred_areas", "property_type", "bedrooms_min", "notes"]) {
      if (args[k] !== undefined) patch[k] = args[k];
    }
    if (Object.keys(patch).length) {
      patch.status = lead.status === "new" ? "qualified" : lead.status;
      await supabase.from("leads").update(patch).eq("id", lead.id);
      Object.assign(ctx.lead, patch);
    }
    return "Lead updated.";
  }

  if (name === "match_listings") {
    const kind = args.kind || lead.intent;
    let pool = listings;
    if (kind) pool = pool.filter((l: any) => l.kind === kind);
    if (args.property_type) pool = pool.filter((l: any) => l.property_type?.toLowerCase() === args.property_type.toLowerCase());
    if (args.budget_min) pool = pool.filter((l: any) => !l.price || l.price >= args.budget_min);
    if (args.budget_max) pool = pool.filter((l: any) => !l.price || l.price <= args.budget_max);
    if (args.area) {
      const a = String(args.area).toLowerCase();
      pool = pool.filter((l: any) => `${l.area_name || ""} ${l.region || ""}`.toLowerCase().includes(a));
    }
    if (args.bedrooms_min) pool = pool.filter((l: any) => (l.bedrooms ?? 0) >= args.bedrooms_min);
    const top = pool.slice(0, 3);
    if (top.length === 0) return "No matching active listings. Offer to widen criteria or handover.";
    ctx.matchedListings = top;
    return top.map((l: any) => formatListing(l, rs.currency)).join("\n");
  }

  if (name === "send_image") {
    const l = listings.find((x: any) => x.title?.toLowerCase() === args.listing_title.toLowerCase());
    if (!l) return "Listing not found.";
    const imgs = Array.isArray(l.images) ? l.images : [];
    const url = imgs[0]?.url || imgs[0];
    if (!url) return "No image available for that listing.";
    try {
      await fetch(`https://graph.facebook.com/v21.0/${ctx.tenantPhoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.tenantAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: phoneNumber, type: "image", image: { link: url, caption: args.caption || l.title } }),
      });
    } catch (e) { console.error("send_image", e); }
    return "Image sent.";
  }

  if (name === "book_viewing") {
    const l = listings.find((x: any) => x.title?.toLowerCase() === args.listing_title.toLowerCase());
    const scheduled = new Date(args.scheduled_at);
    if (isNaN(scheduled.getTime())) return "Invalid date. Ask again.";
    const reminderAt = new Date(scheduled.getTime() - (rs.reminder_hours_before ?? 2) * 3600_000);
    const followupAt = new Date(scheduled.getTime() + (rs.followup_hours_after ?? 24) * 3600_000);
    const { data: v, error } = await supabase.from("viewings").insert({
      tenant_id: tenantId,
      listing_id: l?.id ?? null,
      lead_id: lead.id,
      contact_id: contact.id,
      agent_id: l?.agent_id ?? null,
      guest_name: args.guest_name,
      guest_phone: phoneNumber,
      scheduled_at: scheduled.toISOString(),
      duration_min: rs.viewing_duration_min ?? 30,
      notes: args.notes ?? null,
      reminder_at: reminderAt.toISOString(),
      followup_at: followupAt.toISOString(),
      status: "booked",
      source: "ai",
    }).select().single();
    if (error) return `Failed: ${error.message}`;
    await supabase.from("leads").update({ status: "viewing_booked" }).eq("id", lead.id);
    ctx.lastViewing = v;
    return `Viewing booked for ${args.guest_name} at ${scheduled.toLocaleString()}. Now call route_lead.`;
  }

  if (name === "route_lead") {
    const { data: agents } = await supabase.from("agents").select("*").eq("tenant_id", tenantId).eq("active", true);
    const list = agents ?? [];
    if (list.length === 0) return "No agents configured. Tell the customer the team will reach out.";
    const area = (lead.preferred_areas || [])[0]?.toLowerCase() || "";
    const ptype = (lead.property_type || "").toLowerCase();
    let best = list.find((a: any) =>
      (a.areas || []).map((s: string) => s.toLowerCase()).includes(area) &&
      (a.property_types || []).map((s: string) => s.toLowerCase()).includes(ptype)
    ) || list.find((a: any) => (a.areas || []).map((s: string) => s.toLowerCase()).includes(area)) || list[0];

    await supabase.from("leads").update({ assigned_agent_id: best.id }).eq("id", lead.id);

    if (best.phone) {
      const ctxLines = [
        `🏠 New lead from ${contact.name || phoneNumber}`,
        `Intent: ${lead.intent || "?"}`,
        `Budget: ${lead.budget_min ?? "?"}-${lead.budget_max ?? "?"} ${rs.currency}`,
        `Area: ${(lead.preferred_areas || []).join(", ") || "?"}`,
        `Type: ${lead.property_type || "?"}`,
        ctx.lastViewing ? `Viewing: ${new Date(ctx.lastViewing.scheduled_at).toLocaleString()}` : "",
        lead.notes ? `Notes: ${lead.notes}` : "",
      ].filter(Boolean).join("\n");
      sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, best.phone, ctxLines).catch(() => {});
    }

    if (rs.crm_webhook_url) {
      fetch(rs.crm_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, agent: best, viewing: ctx.lastViewing }),
      }).catch(() => {});
    }

    return `Assigned ${best.name}. Tell the customer their agent will be in touch.`;
  }

  if (name === "handover_to_human") {
    const target = rs.human_transfer_phone;
    if (target) {
      await sendText(ctx.tenantPhoneNumberId, ctx.tenantAccessToken, target,
        `🔔 Handoff (${args.reason}) from ${contact.name || phoneNumber}: ${args.summary}`);
    }
    await supabase.from("leads").update({ needs_human: true, handoff_reason: args.reason }).eq("id", lead.id);
    return `Handoff flagged. Tell customer a human will reply shortly. Do NOT continue.`;
  }

  return "Unknown tool.";
}

export async function runRealEstateFlow(opts: {
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
    console.error("real_estate: LOVABLE_API_KEY not set");
    return;
  }

  const [rs, listings, lead] = await Promise.all([
    getSettings(supabase, tenantId),
    loadListingsSummary(supabase, tenantId),
    getOrCreateLead(supabase, tenantId, contact.id),
  ]);

  // 1) Resume active programmatic viewing flow if one exists.
  const activeSession = await getActiveRealEstateSession(supabase, tenantId, contact.id);
  if (activeSession) {
    const { data: recent } = await supabase
      .from("messages").select("content,direction").eq("contact_id", contact.id)
      .order("created_at", { ascending: false }).limit(10);
    const history = (recent || []).reverse().map((m: any) => ({
      role: m.direction === "incoming" ? "user" : "assistant",
      content: m.content,
    }));
    const deps: RealEstateFlowDeps = {
      supabase, tenantId, contactId: contact.id, leadId: lead.id, phoneNumber,
      phoneNumberId: tenantPhoneNumberId, accessToken: tenantAccessToken,
      listings: listings.map((l: any) => ({
        id: l.id, title: l.title, kind: l.kind ?? null, property_type: l.property_type ?? null,
        price: l.price ?? null, currency: l.currency ?? rs.currency,
        bedrooms: l.bedrooms ?? null, bathrooms: l.bathrooms ?? null,
        area_sqm: l.area_sqm ?? null, area_name: l.area_name ?? null,
        region: l.region ?? null, agent_id: l.agent_id ?? null,
      })),
      currency: rs.currency || "USD",
      viewingDurationMin: rs.viewing_duration_min ?? 30,
      reminderHoursBefore: rs.reminder_hours_before ?? 2,
      followupHoursAfter: rs.followup_hours_after ?? 24,
      openHour: rs.open_hour ?? 9,
      closeHour: rs.close_hour ?? 19,
      slotStepMin: rs.slot_step_min ?? 60,
      agentNotifyPhone: rs.human_transfer_phone || null,
      lovableApiKey: LOVABLE_API_KEY,
      conversationHistory: history,
    };
    await handleRealEstateSessionMessage(deps, activeSession as any, opts.messageText ?? null, opts.interactiveReplyId ?? null);
    return;
  }

  const systemPrompt = buildSystemPrompt(rs, listings.length);

  const { data: recent } = await supabase
    .from("messages").select("content,direction").eq("contact_id", contact.id)
    .order("created_at", { ascending: false }).limit(10);
  const history = (recent || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" : "assistant",
    content: m.content,
  }));

  const ctx: any = {
    supabase, tenantId, contact, phoneNumber, listings, rs, lead,
    tenantPhoneNumberId, tenantAccessToken, conversationHistory: history,
    matchedListings: [], lastViewing: null, flowStarted: false,
  };
  let messages: any[] = [{ role: "system", content: systemPrompt }, ...history];
  let finalReply = "";

  for (let turn = 0; turn < 5; turn++) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3.8-flash", messages, tools: TOOLS, tool_choice: "auto" }),
    });
    if (!res.ok) { console.error("real_estate AI error", res.status, await res.text()); break; }
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
    contact_id: contact.id,
    content: finalReply,
    direction: "outgoing",
    status: ok ? "sent" : "failed",
  });
}

