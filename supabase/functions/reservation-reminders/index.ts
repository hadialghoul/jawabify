// Reservation reminders cron — runs every 15 min, sends WhatsApp reminders
// to confirmed reservations whose reminder_at has passed and reminder_sent_at is null.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("reservations")
    .select("id,tenant_id,guest_name,guest_phone,party_size,starts_at")
    .lte("reminder_at", now)
    .is("reminder_sent_at", null)
    .eq("status", "confirmed")
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const r of due ?? []) {
    const { data: creds } = await supabase
      .from("tenant_credentials")
      .select("phone_number_id,access_token")
      .eq("tenant_id", r.tenant_id)
      .eq("provider", "whatsapp_cloud")
      .eq("is_active", true)
      .maybeSingle();
    if (!creds?.phone_number_id || !creds?.access_token || !r.guest_phone) continue;

    const when = new Date(r.starts_at);
    const body = `Reminder: your reservation for ${r.party_size} at ${when.toLocaleString()} — see you soon! Reply to cancel or adjust.`;
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: r.guest_phone, type: "text", text: { body } }),
      });
      if (res.ok) {
        await supabase.from("reservations").update({ reminder_sent_at: now }).eq("id", r.id);
        sent++;
      } else {
        console.error("reminder send failed", r.id, await res.text());
      }
    } catch (e) {
      console.error("reminder exception", r.id, e);
    }
  }

  return new Response(JSON.stringify({ checked: due?.length ?? 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
