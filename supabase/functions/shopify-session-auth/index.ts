// Embedded Shopify app sign-in (no password, no Jawabify login screen).
//
// POST { config: true }        -> { api_key }            (public client id for App Bridge)
// POST { id_token }            -> { token_hash, shop, tenant_id }
//
// The App Bridge session token is verified with the new app's secret. On first
// use the store is provisioned: offline token via token exchange, a Jawabify
// account + workspace for the shop (billing_origin = 'shopify'), webhooks.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  hmacBase64,
  isValidShopDomain,
  normalizeShopDomain,
  registerWebhooks,
  shopifyGraphQL,
  timingSafeEqual,
  v2AppCreds,
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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

/** Verifies an App Bridge session token (HS256, signed with the app secret). */
async function verifySessionToken(token: string, clientId: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = (await hmacBase64(secret, `${h}.${p}`))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (!timingSafeEqual(expected, sig)) return null;
  let header: any, payload: any;
  try {
    header = JSON.parse(b64urlDecode(h));
    payload = JSON.parse(b64urlDecode(p));
  } catch {
    return null;
  }
  if (header?.alg !== "HS256") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now - 5) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 5) return null;
  if (payload.aud !== clientId) return null;
  const shop = normalizeShopDomain(new URL(String(payload.dest)).hostname);
  if (!isValidShopDomain(shop)) return null;
  const issHost = (() => { try { return new URL(String(payload.iss)).hostname; } catch { return ""; } })();
  if (normalizeShopDomain(issHost) !== shop) return null;
  return { shop, payload };
}

async function exchangeToken(shop: string, idToken: string, clientId: string, secret: string) {
  const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: 1,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.access_token) {
    console.error("token exchange failed", r.status, data);
    return null;
  }
  return {
    access_token: String(data.access_token),
    refresh_token: data.refresh_token ? String(data.refresh_token) : null,
    expires_at: data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const app = v2AppCreds();
  if (!app) return json({ error: "Shopify app is not configured yet." }, 503);

  const body = await req.json().catch(() => ({}));
  if (body?.config) return json({ api_key: app.client_id });

  const idToken = typeof body?.id_token === "string" ? body.id_token : "";
  if (!idToken || idToken.length > 4096) return json({ error: "Missing session token" }, 400);

  try {
    const verified = await verifySessionToken(idToken, app.client_id, app.client_secret);
    if (!verified) return json({ error: "Invalid session token" }, 401);
    const { shop } = verified;

    // 1. Store credential (token exchange on first load or after reinstall).
    const { data: cred } = await admin
      .from("tenant_credentials")
      .select("id, tenant_id, access_token, is_active, refresh_token")
      .eq("provider", "shopify")
      .eq("shop_domain", shop)
      .maybeSingle();

    // Only expiring tokens (with a refresh token) are accepted by Shopify now.
    let accessToken = cred?.is_active && cred.refresh_token ? cred.access_token : null;
    let refreshToken: string | null = cred?.refresh_token ?? null;
    let expiresAt: string | null = null;
    let freshToken = false;
    if (accessToken) {
      const probe = await shopifyGraphQL<any>(shop, accessToken, `{ shop { id } }`).catch(() => null);
      if (!probe?.ok || !probe?.data?.shop?.id) accessToken = null;
    }
    if (!accessToken) {
      const ex = await exchangeToken(shop, idToken, app.client_id, app.client_secret);
      if (!ex) return json({ error: "Could not authorize this store." }, 502);
      accessToken = ex.access_token;
      refreshToken = ex.refresh_token;
      expiresAt = ex.expires_at;
      freshToken = true;
    }

    const info = await shopifyGraphQL<any>(shop, accessToken, `{ shop { name } }`).catch(() => null);
    const shopName = String(info?.data?.shop?.name || shop.replace(".myshopify.com", ""));

    // 2. Store user (synthetic email — never linked to a real inbox, so a store
    //    admin can never take over an unrelated Jawabify account).
    const handle = shop.replace(".myshopify.com", "");
    const email = `shop+${handle}@shopify.jawabify.com`;
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: shopName, business_name: shopName, shop_domain: shop },
    });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) {
      console.error("createUser failed", created.error);
      return json({ error: "Could not create the store account." }, 500);
    }

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data?.properties?.hashed_token || !link.data.user) {
      console.error("generateLink failed", link.error);
      return json({ error: "Could not start the session." }, 500);
    }
    const userId = link.data.user.id;

    // 3. Workspace: the store's existing tenant, else the shop user's, else new.
    let tenantId: string | null = cred?.tenant_id ?? null;
    if (!tenantId) {
      const { data: m } = await admin
        .from("tenant_members").select("tenant_id").eq("user_id", userId).limit(1).maybeSingle();
      tenantId = m?.tenant_id ?? null;
    }
    if (!tenantId) {
      const { data: t, error: tErr } = await admin
        .from("tenants")
        .insert({ name: shopName, owner_user_id: userId, vertical: "ecommerce", billing_origin: "shopify" })
        .select("id")
        .single();
      if (tErr || !t) {
        console.error("tenant insert failed", tErr);
        return json({ error: "Could not create the workspace." }, 500);
      }
      tenantId = t.id;
    } else {
      await admin.from("tenants").update({ billing_origin: "shopify" }).eq("id", tenantId);
    }

    const { data: member } = await admin
      .from("tenant_members").select("id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
    if (!member) {
      const { data: t } = await admin.from("tenants").select("owner_user_id").eq("id", tenantId).maybeSingle();
      await admin.from("tenant_members").insert({
        tenant_id: tenantId,
        user_id: userId,
        role: t?.owner_user_id === userId ? "owner" : "admin",
        email,
        display_name: shopName,
      });
    }

    // 4. Save credential + webhooks.
    if (cred?.id) {
      await admin.from("tenant_credentials").update({
        tenant_id: tenantId,
        access_token: accessToken,
        ...(freshToken ? { refresh_token: refreshToken, token_expires_at: expiresAt } : {}),
        is_active: true,
        install_source: "app_store",
        updated_at: new Date().toISOString(),
      }).eq("id", cred.id);
    } else {
      const { data: other } = await admin
        .from("tenant_credentials").select("id").eq("tenant_id", tenantId).eq("provider", "shopify").maybeSingle();
      const row = {
        tenant_id: tenantId,
        provider: "shopify",
        shop_domain: shop,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: expiresAt,
        is_active: true,
        install_source: "app_store",
      };
      if (other?.id) await admin.from("tenant_credentials").update(row).eq("id", other.id);
      else await admin.from("tenant_credentials").insert(row);
    }
    await admin.from("shopify_pending_installs").delete().eq("shop_domain", shop);

    if (freshToken) {
      const reg = await registerWebhooks(shop, accessToken, `${SUPABASE_URL}/functions/v1/shopify-webhook`);
      const failed = reg.filter((w) => !w.ok);
      if (failed.length) console.warn("webhook registration issues", failed);
    }

    return json({ token_hash: link.data.properties.hashed_token, shop, tenant_id: tenantId });
  } catch (e) {
    console.error("shopify-session-auth error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
