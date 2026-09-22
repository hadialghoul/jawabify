// Viewing reminders cron — runs every 15 min; sends WhatsApp reminders for
// booked viewings whose reminder_at has passed and reminder_sent_at is null.
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
    .from("viewings")
    .select("id,tenant_id,guest_name,guest_phone,scheduled_at,listing_id")
    .lte("reminder_at", now)
    .is("reminder_sent_at", null)
    .eq("status", "booked")
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const v of due ?? []) {
    const { data: creds } = await supabase
      .from("tenant_credentials")
      .select("phone_number_id,access_token")
      .eq("tenant_id", v.tenant_id)
      .eq("provider", "whatsapp_cloud")
      .eq("is_active", true)
      .maybeSingle();
    if (!creds?.phone_number_id || !creds?.access_token || !v.guest_phone) continue;

    let listingTitle = "your viewing";
    if (v.listing_id) {
      const { data: l } = await supabase.from("listings").select("title").eq("id", v.listing_id).maybeSingle();
      if (l?.title) listingTitle = l.title;
    }

    const when = new Date(v.scheduled_at);
    const body = `Reminder: viewing for "${listingTitle}" at ${when.toLocaleString()}. Reply to cancel or reschedule.`;
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: v.guest_phone, type: "text", text: { body } }),
      });
      if (res.ok) {
        await supabase.from("viewings").update({ reminder_sent_at: now }).eq("id", v.id);
        sent++;
      } else console.error("viewing reminder failed", v.id, await res.text());
    } catch (e) { console.error("viewing reminder exception", v.id, e); }
  }

  return new Response(JSON.stringify({ checked: due?.length ?? 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
