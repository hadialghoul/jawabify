// Shopify mandatory compliance (GDPR) webhooks.
// Topics: customers/data_request, customers/redact, shop/redact
// Every request is verified with the app's HMAC-SHA256 signature.

import { createClient } from "npm:@supabase/supabase-js@2";
import { loadCustomAppCreds, verifyWebhookHmac } from "../_shared/shopify.ts";

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const customApps = loadCustomAppCreds();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Accept requests signed by the public app or any configured custom app.
const verifyHmac = (rawBody: string, headerHmac: string | null) =>
  verifyWebhookHmac(rawBody, headerHmac, [SHOPIFY_CLIENT_SECRET, ...customApps.map((a) => a.client_secret)]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const topic = req.headers.get("x-shopify-topic") || "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

  if (!(await verifyHmac(raw, hmac))) {
    console.warn("compliance HMAC verification failed", { topic, shopDomain });
    return new Response("unauthorized", { status: 401 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const shop = shopDomain || payload.shop_domain || "";

  try {
    const { data: cred } = await supabaseLookup(admin, shop);
    const tenantId = cred?.tenant_id || null;

    if (topic === "customers/redact") {
      const phones: string[] = [payload?.customer?.phone, payload?.orders_to_redact ? null : null]
        .filter(Boolean) as string[];
      const emails: string[] = [payload?.customer?.email].filter(Boolean) as string[];
      const orderIds: string[] = (payload?.orders_to_redact || []).map((id: any) => String(id));

      if (tenantId && orderIds.length) {
        await admin
          .from("orders")
          .update({
            customer_name: "Redacted",
            customer_phone: "",
            customer_address: "",
          })
          .eq("tenant_id", tenantId)
          .in("shopify_order_id", orderIds);
      }
      console.log("customers/redact processed", { shop, tenantId, orderIds: orderIds.length, phones: phones.length, emails: emails.length });
    } else if (topic === "shop/redact") {
      if (tenantId) {
        await admin
          .from("tenant_credentials")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("provider", "shopify");
        await admin
          .from("orders")
          .update({ shopify_order_id: null })
          .eq("tenant_id", tenantId)
          .not("shopify_order_id", "is", null);
      }
      console.log("shop/redact processed", { shop, tenantId });
    } else if (topic === "customers/data_request") {
      // We only store order metadata received from Shopify; the merchant can export
      // it from the app. Logged so the request is auditable.
      console.log("customers/data_request received", {
        shop,
        tenantId,
        customer_id: payload?.customer?.id,
        orders: (payload?.orders_requested || []).length,
      });
    } else {
      console.log("unhandled compliance topic", topic);
    }
  } catch (err) {
    console.error("shopify-compliance error", err);
  }

  // Always ack verified requests so Shopify does not retry indefinitely.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function supabaseLookup(admin: any, shop: string) {
  if (!shop) return { data: null };
  return await admin
    .from("tenant_credentials")
    .select("tenant_id")
    .eq("provider", "shopify")
    .eq("shop_domain", shop)
    .maybeSingle();
}
