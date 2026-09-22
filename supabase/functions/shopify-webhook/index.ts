// Shopify webhook receiver — keeps local orders in sync with live Shopify status.
// Topics handled: orders/create, orders/updated, orders/paid, orders/cancelled,
// fulfillments/create, fulfillments/update.

import { createClient } from "npm:@supabase/supabase-js@2";
import { loadCustomAppCreds, verifyWebhookHmac } from "../_shared/shopify.ts";
import { sendOrderConfirmation } from "../_shared/order-confirmation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain, x-shopify-webhook-id, x-shopify-api-version",
};

const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET")!;
const customApps = loadCustomAppCreds();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Accept webhooks signed by the public app or any configured custom app.
const verifyHmac = (rawBody: string, headerHmac: string | null) =>
  verifyWebhookHmac(rawBody, headerHmac, [SHOPIFY_CLIENT_SECRET, ...customApps.map((a) => a.client_secret)]);

function pickTracking(order: any): { number?: string; url?: string; company?: string } {
  const fulfillments = order?.fulfillments || [];
  for (const f of fulfillments) {
    if (f?.tracking_number || f?.tracking_url) {
      return {
        number: f.tracking_number || (f.tracking_numbers || [])[0],
        url: f.tracking_url || (f.tracking_urls || [])[0],
        company: f.tracking_company,
      };
    }
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const raw = await req.text();
    const hmac = req.headers.get("x-shopify-hmac-sha256");
    const topic = req.headers.get("x-shopify-topic") || "";
    const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

    const ok = await verifyHmac(raw, hmac);
    if (!ok) {
      console.warn("HMAC verification failed", { topic, shopDomain });
      return new Response("invalid signature", { status: 401, headers: corsHeaders });
    }

    const payload = JSON.parse(raw);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency: Shopify retries deliveries, so ignore webhook ids we've seen.
    const webhookId = req.headers.get("x-shopify-webhook-id");
    if (webhookId) {
      const { error: dupErr } = await supabase
        .from("shopify_webhook_events")
        .insert({ webhook_id: webhookId, topic, shop_domain: shopDomain });
      if (dupErr) {
        if ((dupErr as any).code === "23505") {
          console.log("duplicate webhook ignored", { webhookId, topic });
          return new Response("ok", { status: 200, headers: corsHeaders });
        }
        console.warn("webhook dedupe insert failed", dupErr);
      }
    }

    // App uninstall: the access token is revoked immediately by Shopify.
    if (topic === "app/uninstalled") {
      await supabase
        .from("tenant_credentials")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("provider", "shopify")
        .eq("shop_domain", shopDomain);
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("billing_provider", "shopify")
        .eq("shop_domain", shopDomain);
      console.log("app/uninstalled processed", shopDomain);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Shopify billing subscription update (e.g. trial ended, canceled, active).
    if (topic === "app_subscriptions/update") {
      const sub = payload.app_subscription || payload;
      const shopifySubId = sub?.id;
      const status = sub?.status?.toLowerCase() || sub?.status || "active";
      const currentPeriodEnd = sub?.current_period_end || sub?.currentPeriodEnd || null;
      if (!shopifySubId) {
        console.warn("app_subscriptions/update missing id", { shopDomain });
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      const { data: localSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("billing_provider", "shopify")
        .eq("shopify_subscription_id", shopifySubId)
        .maybeSingle();
      if (localSub?.id) {
        await supabase
          .from("subscriptions")
          .update({
            status,
            current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
            shop_domain: shopDomain,
            updated_at: new Date().toISOString(),
          })
          .eq("id", localSub.id);
      } else {
        // Find the tenant from the shop domain and create a local subscription row.
        const { data: cred } = await supabase
          .from("tenant_credentials")
          .select("tenant_id")
          .eq("provider", "shopify")
          .eq("shop_domain", shopDomain)
          .maybeSingle();
        if (!cred?.tenant_id) {
          console.warn("app_subscriptions/update no tenant for shop", shopDomain);
          return new Response("ok", { status: 200, headers: corsHeaders });
        }
        const { data: member } = await supabase
          .from("tenant_members")
          .select("user_id")
          .eq("tenant_id", cred.tenant_id)
          .maybeSingle();
        if (!member?.user_id) {
          console.warn("app_subscriptions/update no owner for tenant", cred.tenant_id);
          return new Response("ok", { status: 200, headers: corsHeaders });
        }
        await supabase.from("subscriptions").insert({
          user_id: member.user_id,
          billing_provider: "shopify",
          shopify_subscription_id: shopifySubId,
          shop_domain: shopDomain,
          status,
          current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd).toISOString() : null,
          environment: "live",
        });
      }
      console.log("app_subscriptions/update processed", { shopifySubId, status, shopDomain });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }


    // Resolve tenant from shop domain
    const { data: cred } = await supabase
      .from("tenant_credentials")
      .select("tenant_id, shop_domain")
      .eq("provider", "shopify")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    if (!cred?.tenant_id) {
      console.warn("No tenant for shop", shopDomain);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Determine the Shopify order id and shape based on topic
    let shopifyOrderId: string | null = null;
    let updates: Record<string, any> = { shopify_synced_at: new Date().toISOString() };

    if (topic.startsWith("orders/")) {
      shopifyOrderId = String(payload.id);
      const t = pickTracking(payload);
      updates = {
        ...updates,
        financial_status: payload.financial_status || null,
        fulfillment_status: payload.fulfillment_status || null,
        tracking_number: t.number || null,
        tracking_url: t.url || null,
        tracking_company: t.company || null,
        total_price: payload.total_price != null ? parseFloat(payload.total_price) : null,
      };
      if (topic === "orders/cancelled" || payload.cancelled_at) updates.status = "cancelled";
      else if (payload.fulfillment_status === "fulfilled") updates.status = "completed";
      else if (payload.financial_status === "paid") updates.status = "processing";
    } else if (topic.startsWith("fulfillments/")) {
      shopifyOrderId = String(payload.order_id);
      updates = {
        ...updates,
        fulfillment_status: payload.status === "success" ? "fulfilled" : payload.status,
        tracking_number: payload.tracking_number || (payload.tracking_numbers || [])[0] || null,
        tracking_url: payload.tracking_url || (payload.tracking_urls || [])[0] || null,
        tracking_company: payload.tracking_company || null,
      };
      if (payload.status === "success") updates.status = "completed";
    } else {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (!shopifyOrderId) return new Response("ok", { status: 200, headers: corsHeaders });

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("tenant_id", cred.tenant_id)
      .eq("shopify_order_id", shopifyOrderId)
      .maybeSingle();

    if (existing) {
      await supabase.from("orders").update(updates).eq("id", existing.id);
    } else if (topic === "orders/create" || topic === "orders/updated") {
      // Create local row mirroring Shopify order
      const item = payload.line_items?.[0];
      const ship = payload.shipping_address || payload.billing_address || {};
      const customerName =
        [ship.first_name, ship.last_name].filter(Boolean).join(" ") ||
        payload.customer?.first_name ||
        "Customer";
      const customerPhone = ship.phone || payload.customer?.phone || payload.phone || "";
      await supabase.from("orders").insert({
        tenant_id: cred.tenant_id,
        shopify_order_id: shopifyOrderId,
        // Mirror Shopify's order_number as display_id so lookups by the number
        // the customer sees in their confirmation email work.
        display_id: payload.order_number ?? undefined,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address:
          [ship.address1, ship.address2, ship.city, ship.country].filter(Boolean).join(", ") || "",
        product_name: item?.title || "Shopify order",
        quantity: item?.quantity || 1,
        delivery_fee: 3.0,
        ...updates,
      });

      // Customer WhatsApp confirmation on order creation
      if (topic === "orders/create" && customerPhone) {
        try {
          const { sent } = await sendOrderConfirmation(supabase, cred.tenant_id, {
            phone: customerPhone,
            name: customerName,
            orderNumber: String(payload.order_number || payload.name || shopifyOrderId),
            total: `${payload.total_price || ""} ${payload.currency || ""}`.trim(),
          });
          if (sent) {
            await supabase
              .from("orders")
              .update({ confirmation_sent_at: new Date().toISOString() })
              .eq("tenant_id", cred.tenant_id)
              .eq("shopify_order_id", shopifyOrderId);
          }
        } catch (e) {
          console.error("order confirmation send failed", e);
        }
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("shopify-webhook error", err);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
