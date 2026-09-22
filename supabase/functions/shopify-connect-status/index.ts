// Public, storage-free connection status for the Shopify embedded connector page.
//
// Shopify policy 1.1.1: the embedded app must work without third-party cookies or
// localStorage (incognito). The connector screen therefore resolves the store's
// connection status from the `shop` query param alone — no session required.
// Returns only a boolean; never any tenant data, tokens, or account details.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const url = new URL(req.url);
    let shop = url.searchParams.get("shop");
    if (!shop && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      shop = body?.shop ?? null;
    }
    shop = (shop ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    // Public app client id (not a secret) so the embedded page can load
    // Shopify App Bridge with the required `shopify-api-key` meta tag.
    const apiKey = Deno.env.get("SHOPIFY_CLIENT_ID") ?? null;

    if (!SHOP_RE.test(shop)) return json({ connected: false, shop: null, api_key: apiKey });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data } = await admin
      .from("tenant_credentials")
      .select("id")
      .eq("provider", "shopify")
      .eq("shop_domain", shop)
      .eq("is_active", true)
      .not("tenant_id", "is", null)
      .limit(1);

    return json({ connected: !!data?.length, shop, api_key: apiKey });
  } catch (e) {
    return json({ connected: false, error: (e as Error)?.message ?? "error" }, 500);
  }
});
