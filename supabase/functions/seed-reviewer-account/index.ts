// One-shot setup for the Shopify App Store reviewer test account.
//
// Guarded by the REVIEWER_SETUP_TOKEN secret (sent as `x-reviewer-setup`).
// It makes the reviewer account login-ready and provably Shopify-billed so the
// reviewer can never be routed to an off-platform card path (policy 1.2.1):
//   - confirms the email and sets the password
//   - marks onboarding complete
//   - forces tenants.billing_origin = 'shopify'
//   - removes any Stripe subscription rows and keeps one Shopify-billed row
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("REVIEWER_SETUP_TOKEN");
  if (!expected || req.headers.get("x-reviewer-setup") !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const { email = "admin@admin.com", password } = await req.json().catch(() => ({}));
    if (!password || String(password).length < 10) {
      return json({ error: "password (10+ chars) is required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const user = list.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
    if (!user) return json({ error: "reviewer_user_not_found", email }, 404);

    const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
      password: String(password),
      email_confirm: true,
    });
    if (updErr) throw updErr;

    await admin.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);

    // Resolve the reviewer's tenant (owned first, then membership).
    let tenantId: string | null = null;
    const { data: owned } = await admin
      .from("tenants")
      .select("id")
      .eq("owner_user_id", user.id)
      .limit(1)
      .maybeSingle();
    tenantId = owned?.id ?? null;
    if (!tenantId) {
      const { data: member } = await admin
        .from("tenant_members")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      tenantId = member?.tenant_id ?? null;
    }

    let shopDomain: string | null = null;
    if (tenantId) {
      await admin.from("tenants").update({ billing_origin: "shopify" }).eq("id", tenantId);
      const { data: cred } = await admin
        .from("tenant_credentials")
        .select("shop_domain")
        .eq("tenant_id", tenantId)
        .eq("provider", "shopify")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      shopDomain = cred?.shop_domain ?? null;
    }

    // No card-based rows may remain on the reviewer account.
    await admin.from("subscriptions").delete().eq("user_id", user.id).eq("billing_provider", "stripe");

    const { data: shopSub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("billing_provider", "shopify")
      .limit(1)
      .maybeSingle();

    const row = {
      user_id: user.id,
      billing_provider: "shopify",
      shop_domain: shopDomain,
      price_id: "jawabify_pro_monthly_v2",
      status: "active",
      current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
      environment: "live",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    };
    if (shopSub?.id) {
      await admin.from("subscriptions").update(row).eq("id", shopSub.id);
    } else {
      await admin.from("subscriptions").insert(row);
    }

    return json({
      ok: true,
      email,
      tenant_id: tenantId,
      shop_domain: shopDomain,
      billing_origin: "shopify",
    });
  } catch (e) {
    console.error("seed-reviewer-account error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
