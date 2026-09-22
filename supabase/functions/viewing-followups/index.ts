// Viewing post-followup cron — runs every 30 min; sends a follow-up message
// after each viewing's scheduled_at + followup_hours_after.
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
    .select("id,tenant_id,guest_name,guest_phone,listing_id,lead_id")
    .lte("followup_at", now)
    .is("followup_sent_at", null)
    .in("status", ["booked", "completed"])
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

    let title = "the property";
    if (v.listing_id) {
      const { data: l } = await supabase.from("listings").select("title").eq("id", v.listing_id).maybeSingle();
      if (l?.title) title = l.title;
    }

    const body = `Hi ${v.guest_name?.split(" ")[0] || ""}, how did you find ${title}? Interested in moving forward, or would you like to see other options?`;
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${creds.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: v.guest_phone, type: "text", text: { body } }),
      });
      if (res.ok) {
        await supabase.from("viewings").update({ followup_sent_at: now }).eq("id", v.id);
        sent++;
      } else console.error("followup failed", v.id, await res.text());
    } catch (e) { console.error("followup exception", v.id, e); }
  }

  return new Response(JSON.stringify({ checked: due?.length ?? 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
