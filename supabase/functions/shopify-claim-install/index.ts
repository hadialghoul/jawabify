import { createClient } from "npm:@supabase/supabase-js@2";
import { isValidShopDomain, normalizeShopDomain, registerWebhooks } from "../_shared/shopify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const asUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const shop = normalizeShopDomain(String(body?.shop || ""));
    const tenantId = body?.tenant_id;
    if (!shop || !isValidShopDomain(shop) || !tenantId) {
      return json({ error: "Missing or invalid shop / tenant_id" }, 400);
    }

    // Caller must belong to the tenant (or be a super admin).
    const [{ data: membership }, { data: roleRow }] = await Promise.all([
      admin.from("tenant_members").select("tenant_id")
        .eq("tenant_id", tenantId).eq("user_id", user.id).maybeSingle(),
      admin.from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "super_admin").maybeSingle(),
    ]);
    if (!membership && !roleRow) return json({ error: "Forbidden" }, 403);

    const { data: pending } = await admin
      .from("shopify_pending_installs")
      .select("id, access_token, claimed_at")
      .eq("shop_domain", shop)
      .is("claimed_at", null)
      .maybeSingle();

    if (!pending?.access_token) return json({ connected: false, reason: "no_pending_install" });

    const { data: existing } = await admin
      .from("tenant_credentials")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", "shopify")
      .maybeSingle();

    if (existing?.id) {
      await admin.from("tenant_credentials").update({
        access_token: pending.access_token,
        shop_domain: shop,
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await admin.from("tenant_credentials").insert({
        tenant_id: tenantId,
        provider: "shopify",
        access_token: pending.access_token,
        shop_domain: shop,
        is_active: true,
      });
    }

    await admin.from("shopify_pending_installs")
      .update({ claimed_at: new Date().toISOString(), tenant_id: tenantId })
      .eq("id", pending.id);

    await registerWebhooks(
      shop,
      pending.access_token,
      `${SUPABASE_URL}/functions/v1/shopify-webhook`,
    );

    return json({ connected: true, shop });
  } catch (e) {
    console.error("shopify-claim-install error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
