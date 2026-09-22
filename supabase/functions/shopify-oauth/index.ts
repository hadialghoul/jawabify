import { createClient } from "npm:@supabase/supabase-js@2";
import {
  isValidShopDomain,
  loadCustomAppCreds,
  normalizeShopDomain,
  rawShopDomain,
  registerWebhooks,
  verifyQueryHmac,
} from "../_shared/shopify.ts";

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

const DEFAULT_SCOPES = Deno.env.get("SHOPIFY_SCOPES") ||
  "read_products,write_products,read_inventory,write_orders,read_orders,read_fulfillments,read_locales";
const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://jawabify.com";

/**
 * Per-store scope overrides. Custom-distribution apps MUST request exactly the
 * scopes configured in their Partner app, otherwise Shopify shows
 * "Oops, something went wrong — Unauthorized Access" on /oauth/authorize.
 * Scopes are public config (not secrets), so they are pinned here to guarantee
 * an exact match with each Partner app configuration.
 */
const SHOP_SCOPE_OVERRIDES: Record<string, string> = {
  // Shoes Bullet (fitrizer-2 permanent domain, fitbulletlb alias)
  "fitrizer-2.myshopify.com": "read_inventory,read_orders,write_orders,read_products",
  "fitbulletlb.myshopify.com": "read_inventory,read_orders,write_orders,read_products",
};

/**
 * Stores that MUST install through the public (App Store) app, never a
 * custom-distribution app. Custom apps cannot use the Shopify Billing API, so
 * the App Store review / demo store has to hold a public-app token.
 */
const FORCE_PUBLIC_APP_SHOPS = new Set([
  "3a6f9n-ty.myshopify.com",
]);




Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID")!;
  const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;

  // Optional additional Shopify apps (custom distribution, single-store installs).
  // Supports one legacy block plus indexed blocks (_2, _3, ...) for multiple custom apps.
  const customApps = loadCustomAppCreds();

  const appCredsFor = (shopDomain: string) => {
    const d = (shopDomain || "").toLowerCase();
    const canon = normalizeShopDomain(d);
    const forcePublic = FORCE_PUBLIC_APP_SHOPS.has(d) || FORCE_PUBLIC_APP_SHOPS.has(canon);
    const match = forcePublic ? undefined : customApps.find((a) =>
      a.shop_domains.includes(d) || a.shop_domains.includes(canon)
    );

    const override = SHOP_SCOPE_OVERRIDES[d] || SHOP_SCOPE_OVERRIDES[canon];

    if (match) {
      return {
        client_id: match.client_id,
        client_secret: match.client_secret,
        app: "custom",
        scopes: override || match.scopes || DEFAULT_SCOPES,
      };
    }
    return {
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      app: "public",
      scopes: override || DEFAULT_SCOPES,

    };
  };

  const allSecrets = [SHOPIFY_CLIENT_SECRET, ...customApps.map((a) => a.client_secret)];

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const functionBase = `${SUPABASE_URL}/functions/v1/shopify-oauth`;
  const redirectUri = `${functionBase}/callback`;

  const newState = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── SHOPIFY-INITIATED INSTALL (GET /?shop=...&hmac=...) ───
    // Required by Shopify: installing from the App Store or the "install" link
    // hits this route directly with a signed query string.
    if (req.method === "GET" && !path.endsWith("/callback")) {
      const shopParam = url.searchParams.get("shop");
      if (!shopParam) return new Response("Missing shop parameter", { status: 400 });

      // Redirect on the exact domain Shopify sent; store canonical for matching.
      const shopDomain = rawShopDomain(shopParam);
      const canonicalShop = normalizeShopDomain(shopParam);
      if (!isValidShopDomain(shopDomain)) {
        return new Response("Invalid shop domain", { status: 400 });
      }
      if (!(await verifyQueryHmac(url, allSecrets))) {
        console.warn("install request HMAC verification failed", shopDomain);
        return new Response("Invalid HMAC signature", { status: 401 });
      }

      const state = newState();
      await supabaseAdmin.from("shopify_oauth_states").insert({
        state,
        shop_domain: canonicalShop,
        tenant_id: null,
        user_id: null,
      });

      const creds = appCredsFor(shopDomain);
      const installUrl =
        `https://${shopDomain}/admin/oauth/authorize?client_id=${creds.client_id}` +
        `&scope=${creds.scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

      return new Response(null, { status: 302, headers: { Location: installUrl } });
    }

    // ─── INSTALL FROM OUR APP: POST { shop, tenant_id } + auth header ───
    if (req.method === "POST" && !path.endsWith("/callback")) {

      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);

      const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized" }, 401);

      const body = await req.json().catch(() => ({}));
      const actingTenant = req.headers.get("x-acting-tenant");
      const shop = body?.shop;
      const targetTenantId = actingTenant || body?.tenant_id;
      if (!shop || !targetTenantId) return json({ error: "Missing shop or tenant_id" }, 400);

      // Authorize: caller must be a member of the target tenant, or a super admin.
      const [{ data: membership }, { data: roleRow }] = await Promise.all([
        supabaseAdmin
          .from("tenant_members")
          .select("tenant_id")
          .eq("tenant_id", targetTenantId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "super_admin")
          .maybeSingle(),
      ]);
      if (!membership && !roleRow) {
        return json({ error: "You do not have access to this account" }, 403);
      }

      // Authorize on the exact domain the merchant typed (Shopify redirects
      // aliases itself); store the canonical domain for state/token records.
      const shopDomain = rawShopDomain(String(shop));
      const canonicalShop = normalizeShopDomain(String(shop));
      if (!isValidShopDomain(shopDomain)) {
        return json({ error: "Invalid store domain. Use the form your-store.myshopify.com" }, 400);
      }

      // Cryptographically random nonce stored server-side (never trust client state).
      const state = newState();
      const { error: stateErr } = await supabaseAdmin.from("shopify_oauth_states").insert({
        state,
        shop_domain: canonicalShop,

        tenant_id: targetTenantId,
        user_id: user.id,
      });
      if (stateErr) {
        console.error("failed to store oauth state:", stateErr);
        return json({ error: "Could not start Shopify install" }, 500);
      }

      const creds = appCredsFor(shopDomain);
      console.log(`shopify install for ${shopDomain} using ${creds.app} app`);
      const installUrl =
        `https://${shopDomain}/admin/oauth/authorize?client_id=${creds.client_id}` +
        `&scope=${creds.scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

      return json({ install_url: installUrl });
    }

    // ─── CALLBACK: verify HMAC + nonce, then exchange code for token ───
    if (req.method === "GET" && path.endsWith("/callback")) {
      const code = url.searchParams.get("code");
      const shopParam = url.searchParams.get("shop");
      const stateParam = url.searchParams.get("state");

      if (!code || !shopParam || !stateParam) {
        return new Response("Missing parameters", { status: 400 });
      }

      const shop = normalizeShopDomain(shopParam);
      const shopHost = rawShopDomain(shopParam);
      if (!isValidShopDomain(shopHost)) {
        return new Response("Invalid shop domain", { status: 400 });
      }


      if (!(await verifyQueryHmac(url, allSecrets))) {
        console.warn("callback HMAC verification failed", shop);
        return new Response("Invalid HMAC signature", { status: 401 });
      }

      // One-time nonce, bound to this shop and not yet used or expired.
      const { data: stateRow } = await supabaseAdmin
        .from("shopify_oauth_states")
        .select("state, tenant_id, user_id, shop_domain, expires_at, used_at")
        .eq("state", stateParam)
        .maybeSingle();

      if (
        !stateRow ||
        stateRow.used_at ||
        stateRow.shop_domain !== shop ||
        new Date(stateRow.expires_at).getTime() < Date.now()
      ) {
        console.warn("invalid or expired oauth state", { shop });
        return new Response("Invalid or expired state", { status: 403 });
      }

      await supabaseAdmin
        .from("shopify_oauth_states")
        .update({ used_at: new Date().toISOString() })
        .eq("state", stateParam);

      // Exchange code for a permanent access token with the app that owns this shop.
      const cbCreds = appCredsFor(shop);
      const tokenRes = await fetch(`https://${shopHost}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: cbCreds.client_id,
          client_secret: cbCreds.client_secret,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("Shopify token exchange failed:", tokenData);
        return new Response("Failed to get access token", { status: 400 });
      }

      // Shopify-initiated installs have no tenant yet — send the merchant to the
      // app to sign in / pick their account, keeping the token for that step.
      if (!stateRow.tenant_id) {
        const { data: existingByShop } = await supabaseAdmin
          .from("tenant_credentials")
          .select("id, tenant_id")
          .eq("provider", "shopify")
          .eq("shop_domain", shop)
          .maybeSingle();

        if (existingByShop?.id) {
          await supabaseAdmin.from("tenant_credentials").update({
            access_token: tokenData.access_token,
            is_active: true,
            install_source: "app_store",
            updated_at: new Date().toISOString(),
          }).eq("id", existingByShop.id);
          if (existingByShop.tenant_id) {
            await supabaseAdmin
              .from("tenants")
              .update({ billing_origin: "shopify" })
              .eq("id", existingByShop.tenant_id);
          }
          await registerWebhooks(
            shop,
            tokenData.access_token,
            `${SUPABASE_URL}/functions/v1/shopify-webhook`,
          );
          return new Response(null, {
            status: 302,
            headers: { Location: `${APP_URL}/shopify/connect?shop=${encodeURIComponent(shop)}` },
          });
        }

        // Keep the token until the merchant signs up, then link it to their tenant.
        await supabaseAdmin.from("shopify_pending_installs").upsert({
          shop_domain: shop,
          access_token: tokenData.access_token,
          claimed_at: null,
          tenant_id: null,
          install_source: "app_store",
        }, { onConflict: "shop_domain" });

        return new Response(null, {
          status: 302,
          headers: {
            Location: `${APP_URL}/shopify/connect?shop=${encodeURIComponent(shop)}`,
          },
        });

      }

      const { data: existing } = await supabaseAdmin
        .from("tenant_credentials")
        .select("id")
        .eq("tenant_id", stateRow.tenant_id)
        .eq("provider", "shopify")
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("tenant_credentials")
          .update({
            access_token: tokenData.access_token,
            shop_domain: shop,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("tenant_credentials").insert({
          tenant_id: stateRow.tenant_id,
          provider: "shopify",
          access_token: tokenData.access_token,
          shop_domain: shop,
          is_active: true,
          install_source: "app_store",
        });
        await supabaseAdmin
          .from("tenants")
          .update({ billing_origin: "shopify" })
          .eq("id", stateRow.tenant_id);
      }

      // Requeue orders that couldn't reach Shopify while the store was disconnected.
      await supabaseAdmin
        .from("orders")
        .update({ shopify_sync_status: "pending", shopify_sync_attempts: 0, shopify_sync_error: null })
        .eq("tenant_id", stateRow.tenant_id)
        .is("shopify_order_id", null)
        .in("shopify_sync_status", ["no_credentials", "failed", "unmatched"]);

      // Register webhooks (incl. app/uninstalled) so Shopify pushes live updates.
      const registered = await registerWebhooks(
        shop,
        tokenData.access_token,
        `${SUPABASE_URL}/functions/v1/shopify-webhook`,
      );
      const failed = registered.filter((w) => !w.ok);
      if (failed.length) console.warn("webhook registration issues", failed);

      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/settings?shopify=connected` },
      });
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error("shopify-oauth error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
