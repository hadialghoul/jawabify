// Cron-invoked: syncs recent Shopify orders for all connected tenants.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendOrderConfirmation } from "../_shared/order-confirmation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function shopifyRequest(shop: string, token: string, endpoint: string) {
  const res = await fetch(`https://${shop}/admin/api/2026-01/${endpoint}`, {
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: creds } = await supabase
      .from("tenant_credentials")
      .select("tenant_id, shop_domain, access_token")
      .eq("provider", "shopify")
      .eq("is_active", true);

    const sinceIso = new Date(Date.now() - 2 * 86400_000).toISOString();
    const summary: any[] = [];

    for (const c of creds || []) {
      if (!c.shop_domain || !c.access_token) continue;
      try {
        const resp = await shopifyRequest(
          c.shop_domain,
          c.access_token,
          `orders.json?status=any&limit=100&updated_at_min=${encodeURIComponent(sinceIso)}`,
        );
        const list = Array.isArray(resp?.orders) ? resp.orders : [];
        let inserted = 0, updated = 0, confirmed = 0;

        for (const o of list) {
          const shopifyOrderId = String(o.id);
          const ship = o.shipping_address || o.billing_address || {};
          const item = o.line_items?.[0];
          let status = "pending";
          if (o.cancelled_at) status = "cancelled";
          else if (o.fulfillment_status === "fulfilled") status = "completed";
          else if (o.financial_status === "paid") status = "processing";
          const f = (o.fulfillments || [])[0] || {};

          const common = {
            financial_status: o.financial_status || null,
            fulfillment_status: o.fulfillment_status || null,
            tracking_number: f.tracking_number || (f.tracking_numbers || [])[0] || null,
            tracking_url: f.tracking_url || (f.tracking_urls || [])[0] || null,
            tracking_company: f.tracking_company || null,
            total_price: o.total_price != null ? parseFloat(o.total_price) : null,
            status,
            shopify_synced_at: new Date().toISOString(),
          };

          const { data: existing } = await supabase
            .from("orders").select("id, confirmation_sent_at, customer_name, customer_phone")
            .eq("tenant_id", c.tenant_id)
            .eq("shopify_order_id", shopifyOrderId)
            .limit(1);

          const customerName =
            [ship.first_name, ship.last_name].filter(Boolean).join(" ") ||
            o.customer?.first_name ||
            "Customer";
          const customerPhone = ship.phone || o.customer?.phone || o.phone || "";
          const orderNumber = String(o.order_number ?? o.name ?? shopifyOrderId);
          const totalText = `${o.total_price || ""} ${o.currency || ""}`.trim();
          // Only ever confirm recent orders, so a backfill can't message old customers.
          const fresh = Date.now() - new Date(o.created_at).getTime() < 24 * 3600_000;

          if (existing && existing.length > 0) {
            await supabase.from("orders").update(common).eq("id", existing[0].id);
            updated++;
            if (fresh && !existing[0].confirmation_sent_at && customerPhone && !o.cancelled_at) {
              try {
                const { sent } = await sendOrderConfirmation(supabase, c.tenant_id, {
                  phone: customerPhone,
                  name: customerName,
                  orderNumber,
                  total: totalText,
                });
                if (sent) {
                  await supabase
                    .from("orders")
                    .update({ confirmation_sent_at: new Date().toISOString() })
                    .eq("id", existing[0].id);
                  confirmed++;
                }
              } catch (e) {
                console.error("order confirmation send failed", shopifyOrderId, e);
              }
            }
          } else {
            const { error: insErr } = await supabase.from("orders").insert({
              tenant_id: c.tenant_id,
              shopify_order_id: shopifyOrderId,
              // Use Shopify's order_number as our display_id so it matches the
              // customer's Shopify confirmation email. Falls back to the local
              // sequence if Shopify didn't provide one.
              display_id: o.order_number ?? undefined,
              customer_name: customerName,
              customer_phone: customerPhone,
              customer_address: [ship.address1, ship.address2, ship.city, ship.country].filter(Boolean).join(", ") || "",
              product_name: item?.title || "Shopify order",
              quantity: item?.quantity || 1,
              delivery_fee: 3.0,
              ...common,
            });
            if (insErr && insErr.code === "23505") {
              // Unique violation — already exists, update instead
              await supabase.from("orders").update(common)
                .eq("tenant_id", c.tenant_id).eq("shopify_order_id", shopifyOrderId);
              updated++;
            } else if (!insErr) {
              inserted++;
              if (fresh && customerPhone && !o.cancelled_at) {
                try {
                  const { sent } = await sendOrderConfirmation(supabase, c.tenant_id, {
                    phone: customerPhone,
                    name: customerName,
                    orderNumber,
                    total: totalText,
                  });
                  if (sent) {
                    await supabase
                      .from("orders")
                      .update({ confirmation_sent_at: new Date().toISOString() })
                      .eq("tenant_id", c.tenant_id)
                      .eq("shopify_order_id", shopifyOrderId);
                    confirmed++;
                  }
                } catch (e) {
                  console.error("order confirmation send failed", shopifyOrderId, e);
                }
              }
            }
          }
        }
        summary.push({ tenant_id: c.tenant_id, fetched: list.length, inserted, updated, confirmed });
      } catch (e: any) {
        summary.push({ tenant_id: c.tenant_id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, tenants: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("shopify-auto-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
