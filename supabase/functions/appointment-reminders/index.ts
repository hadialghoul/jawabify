// Day-before WhatsApp appointment reminders for wellness, healthcare, real estate.
// Uses the tenant's approved UTILITY template. Idempotent via reminder_sent_at.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Vertical = "wellness" | "healthcare" | "real_estate" | "education";

const TEMPLATE_NAME: Record<Vertical, string> = {
  wellness: "appointment_reminder",
  healthcare: "appointment_reminder",
  real_estate: "viewing_reminder",
  education: "class_reminder",
};

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

async function sendTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  vars: string[],
): Promise<{ ok: boolean; error?: string }> {
  const cleaned = String(to).replace("whatsapp:", "").replace(/\D/g, "");
  if (!cleaned) return { ok: false, error: "no phone" };
  const body = {
    messaging_product: "whatsapp",
    to: cleaned,
    type: "template",
    template: {
      name: templateName,
      language: { code: "en_US" },
      components: [
        { type: "body", parameters: vars.map((v) => ({ type: "text", text: v })) },
      ],
    },
  };
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => ({}));
  return { ok: false, error: j?.error?.message || `HTTP ${res.status}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Day-before window: 23h to 25h from now.
  const from = new Date(Date.now() + 23 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 25 * 3600 * 1000).toISOString();

  const results: Record<string, { checked: number; sent: number; failed: number }> = {
    wellness: { checked: 0, sent: 0, failed: 0 },
    healthcare: { checked: 0, sent: 0, failed: 0 },
    real_estate: { checked: 0, sent: 0, failed: 0 },
    education: { checked: 0, sent: 0, failed: 0 },
  };

  // Cache creds per tenant.
  const credCache = new Map<string, { phoneNumberId: string; accessToken: string } | null>();
  async function creds(tenantId: string) {
    if (credCache.has(tenantId)) return credCache.get(tenantId)!;
    const { data } = await supabase
      .from("tenant_credentials")
      .select("phone_number_id, access_token")
      .eq("tenant_id", tenantId)
      .eq("provider", "whatsapp_cloud")
      .eq("is_active", true)
      .maybeSingle();
    const c = data?.phone_number_id && data?.access_token
      ? { phoneNumberId: data.phone_number_id, accessToken: data.access_token }
      : null;
    credCache.set(tenantId, c);
    return c;
  }

  // ---------- WELLNESS ----------
  const { data: wSess } = await supabase
    .from("wellness_sessions")
    .select("id, tenant_id, guest_name, guest_phone, scheduled_at, service_id, contact_id")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .in("status", ["scheduled", "confirmed", "booked"])
    .is("reminder_sent_at", null)
    .limit(500);

  for (const r of wSess ?? []) {
    results.wellness.checked++;
    const c = await creds(r.tenant_id);
    if (!c) { results.wellness.failed++; continue; }
    let name = r.guest_name || "";
    let phone = r.guest_phone || "";
    if ((!name || !phone) && r.contact_id) {
      const { data: ct } = await supabase.from("contacts")
        .select("name, phone_number").eq("id", r.contact_id).maybeSingle();
      name = name || ct?.name || "there";
      phone = phone || ct?.phone_number || "";
    }
    let service = "your";
    if (r.service_id) {
      const { data: s } = await supabase.from("wellness_services")
        .select("name").eq("id", r.service_id).maybeSingle();
      if (s?.name) service = s.name;
    }
    if (!phone) { results.wellness.failed++; continue; }
    const out = await sendTemplate(c.phoneNumberId, c.accessToken, phone,
      TEMPLATE_NAME.wellness, [name || "there", service, fmtTime(r.scheduled_at)]);
    if (out.ok) {
      await supabase.from("wellness_sessions")
        .update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      results.wellness.sent++;
    } else {
      console.error("wellness reminder failed", r.id, out.error);
      results.wellness.failed++;
    }
  }

  // ---------- HEALTHCARE ----------
  const { data: hAppt } = await supabase
    .from("healthcare_appointments")
    .select("id, tenant_id, patient_name, patient_phone, scheduled_at, doctor_id, contact_id")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .in("status", ["scheduled", "confirmed", "booked"])
    .is("reminder_sent_at", null)
    .limit(500);

  for (const r of hAppt ?? []) {
    results.healthcare.checked++;
    const c = await creds(r.tenant_id);
    if (!c) { results.healthcare.failed++; continue; }
    let name = r.patient_name || "";
    let phone = r.patient_phone || "";
    if ((!name || !phone) && r.contact_id) {
      const { data: ct } = await supabase.from("contacts")
        .select("name, phone_number").eq("id", r.contact_id).maybeSingle();
      name = name || ct?.name || "there";
      phone = phone || ct?.phone_number || "";
    }
    let doctor = "your doctor";
    if (r.doctor_id) {
      const { data: d } = await supabase.from("healthcare_doctors")
        .select("name").eq("id", r.doctor_id).maybeSingle();
      if (d?.name) doctor = d.name.replace(/^Dr\.?\s*/i, "");
    }
    if (!phone) { results.healthcare.failed++; continue; }
    const out = await sendTemplate(c.phoneNumberId, c.accessToken, phone,
      TEMPLATE_NAME.healthcare, [name || "there", doctor, fmtTime(r.scheduled_at)]);
    if (out.ok) {
      await supabase.from("healthcare_appointments")
        .update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      results.healthcare.sent++;
    } else {
      console.error("healthcare reminder failed", r.id, out.error);
      results.healthcare.failed++;
    }
  }

  // ---------- REAL ESTATE ----------
  const { data: viewings } = await supabase
    .from("viewings")
    .select("id, tenant_id, guest_name, guest_phone, scheduled_at, listing_id, contact_id")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .in("status", ["scheduled", "confirmed", "booked"])
    .is("reminder_sent_at", null)
    .limit(500);

  for (const r of viewings ?? []) {
    results.real_estate.checked++;
    const c = await creds(r.tenant_id);
    if (!c) { results.real_estate.failed++; continue; }
    let name = r.guest_name || "";
    let phone = r.guest_phone || "";
    if ((!name || !phone) && r.contact_id) {
      const { data: ct } = await supabase.from("contacts")
        .select("name, phone_number").eq("id", r.contact_id).maybeSingle();
      name = name || ct?.name || "there";
      phone = phone || ct?.phone_number || "";
    }
    let where = "the property";
    if (r.listing_id) {
      const { data: l } = await supabase.from("listings")
        .select("title, area_name").eq("id", r.listing_id).maybeSingle();
      where = l?.title || l?.area_name || where;
    }
    if (!phone) { results.real_estate.failed++; continue; }
    const out = await sendTemplate(c.phoneNumberId, c.accessToken, phone,
      TEMPLATE_NAME.real_estate, [name || "there", where, fmtTime(r.scheduled_at)]);
    if (out.ok) {
      await supabase.from("viewings")
        .update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      results.real_estate.sent++;
    } else {
      console.error("viewing reminder failed", r.id, out.error);
      results.real_estate.failed++;
    }
  }

  // ---------- EDUCATION ----------
  // Enrollments whose course start_date is tomorrow (UTC day).
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const { data: enrolls } = await supabase
    .from("education_enrollments")
    .select("id, tenant_id, parent_name, parent_phone, student_name, course_id, contact_id, start_date")
    .eq("start_date", tomorrowStr)
    .eq("status", "active")
    .is("reminder_sent_at", null)
    .limit(500);

  for (const r of enrolls ?? []) {
    results.education.checked++;
    const c = await creds(r.tenant_id);
    if (!c) { results.education.failed++; continue; }
    let name = r.parent_name || r.student_name || "";
    let phone = r.parent_phone || "";
    if ((!name || !phone) && r.contact_id) {
      const { data: ct } = await supabase.from("contacts")
        .select("name, phone_number").eq("id", r.contact_id).maybeSingle();
      name = name || ct?.name || "there";
      phone = phone || ct?.phone_number || "";
    }
    let course = "your";
    let schedule = "the scheduled time";
    if (r.course_id) {
      const { data: co } = await supabase.from("education_courses")
        .select("name, schedule").eq("id", r.course_id).maybeSingle();
      if (co?.name) course = co.name;
      if (co?.schedule) schedule = co.schedule;
    }
    if (!phone) { results.education.failed++; continue; }
    const out = await sendTemplate(c.phoneNumberId, c.accessToken, phone,
      TEMPLATE_NAME.education, [name || "there", course, schedule]);
    if (out.ok) {
      await supabase.from("education_enrollments")
        .update({ reminder_sent_at: new Date().toISOString() }).eq("id", r.id);
      results.education.sent++;
    } else {
      console.error("class reminder failed", r.id, out.error);
      results.education.failed++;
    }
  }



  return new Response(JSON.stringify({ ok: true, window: { from, to }, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
