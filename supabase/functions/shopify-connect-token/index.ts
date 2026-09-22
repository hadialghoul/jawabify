import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tenantId = await resolveTenantId(supabaseAdmin, user.id, req.headers.get("x-acting-tenant"));
    if (!tenantId) return json({ error: "No tenant found" }, 400);

    const body = await req.json().catch(() => ({}));
    const rawShop = String(body?.shop || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const token = String(body?.access_token || "").trim();

    if (!rawShop || !token) return json({ error: "Store domain and access token are required" }, 400);
    const shopDomain = normalizeShopDomain(rawShop);
    if (!isValidShopDomain(shopDomain)) {
      return json({ error: "Invalid store domain. Use the form your-store.myshopify.com" }, 400);
    }
    if (!/^shp(at|ca)_[A-Za-z0-9]+$/.test(token)) {
      return json({ error: "That does not look like an Admin API access token (should start with shpat_)" }, 400);
    }

    // Validate the token against the store before saving
    const check = await fetch(`https://${shopDomain}/admin/api/2026-01/shop.json`, {
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    });
    if (!check.ok) {
      const detail = await check.text();
      console.error("shopify token validation failed:", check.status, detail.slice(0, 300));
      return json({
        error: check.status === 401 || check.status === 403
          ? "Shopify rejected the token. Check the token and that the app has read_products, read_inventory, read_orders and write_orders scopes."
          : `Shopify returned ${check.status} for ${shopDomain}. Check the store domain.`,
      }, 400);
    }
    const shopInfo = await check.json().catch(() => ({}));

    const { data: existing } = await supabaseAdmin
      .from("tenant_credentials")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", "shopify")
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.from("tenant_credentials").update({
        access_token: token,
        shop_domain: shopDomain,
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("tenant_credentials").insert({
        tenant_id: tenantId,
        provider: "shopify",
        access_token: token,
        shop_domain: shopDomain,
        is_active: true,
      });
    }

    // Requeue orders that couldn't reach Shopify while the store was disconnected.
    await supabaseAdmin
      .from("orders")
      .update({ shopify_sync_status: "pending", shopify_sync_attempts: 0, shopify_sync_error: null })
      .eq("tenant_id", tenantId)
      .is("shopify_order_id", null)
      .in("shopify_sync_status", ["no_credentials", "failed", "unmatched"]);

    // Register order + app/uninstalled webhooks so live updates keep flowing
    const webhookAddress = `${SUPABASE_URL}/functions/v1/shopify-webhook`;
    const webhooks = await registerWebhooks(shopDomain, token, webhookAddress);

    return json({
      success: true,
      shop_domain: shopDomain,
      shop_name: shopInfo?.shop?.name || null,
      webhooks,
    });
  } catch (err) {
    console.error("shopify-connect-token error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
