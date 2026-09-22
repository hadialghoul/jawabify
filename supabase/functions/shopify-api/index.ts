import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";
import { registerAndPersist } from "../_shared/shopify-order.ts";
import {
  fetchAllProducts,
  searchProducts,
  registerWebhooks,
  shopifyRest,
  shopifyGraphQL,
  SHOPIFY_API_VERSION,
} from "../_shared/shopify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getShopifyCredentials(supabaseAdmin: any, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenant_credentials")
    .select("access_token, shop_domain")
    .eq("tenant_id", tenantId)
    .eq("provider", "shopify")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function shopifyRequest(shop: string, token: string, endpoint: string, method = "GET", body?: any) {
  const res = await shopifyRest(shop, token, endpoint, method, body);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tenantId = await resolveTenantId(supabaseAdmin, user.id, req.headers.get("x-acting-tenant"));

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = await getShopifyCredentials(supabaseAdmin, tenantId);
    if (!creds) {
      return new Response(JSON.stringify({ error: "Shopify not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, params } = await req.json();

    let result;
    switch (action) {
      case "get_products": {
        // Products come from the GraphQL Admin API (REST product endpoints are
        // deprecated), mapped back to the REST-like shape callers expect.
        const limit = Math.min(Number(params?.limit) || 50, 250);
        const r = await fetchAllProducts(creds.shop_domain, creds.access_token, limit);
        if (!r.ok) throw new Error(`Shopify products query failed (${r.status})`);
        result = { products: r.products.slice(0, limit) };
        break;
      }
      case "get_product": {
        const gid = `gid://shopify/Product/${String(params.product_id).split("/").pop()}`;
        const r = await shopifyGraphQL<any>(
          creds.shop_domain,
          creds.access_token,
          `query P($id: ID!) { product(id: $id) { id title handle status descriptionHtml productType vendor tags media(first: 10) { nodes { ... on MediaImage { id image { url altText } } } } variants(first: 100) { nodes { id title price sku inventoryQuantity availableForSale } } } }`,
          { id: gid },
        );
        if (!r.ok) throw new Error(`Shopify product query failed (${r.status})`);
        const n = r.data?.product;
        result = {
          product: n
            ? {
                id: Number(String(n.id).split("/").pop()),
                title: n.title,
                handle: n.handle,
                status: String(n.status || "").toLowerCase(),
                body_html: n.descriptionHtml,
                product_type: n.productType,
                vendor: n.vendor,
                tags: Array.isArray(n.tags) ? n.tags.join(", ") : n.tags,
                images: (n.media?.nodes || []).filter((m: any) => m?.image?.url).map((m: any) => ({
                  id: Number(String(m.id).split("/").pop()),
                  src: m.image.url,
                  alt: m.image.altText,
                })),
                variants: (n.variants?.nodes || []).map((v: any) => ({
                  id: Number(String(v.id).split("/").pop()),
                  title: v.title,
                  price: v.price,
                  sku: v.sku,
                  inventory_quantity: v.inventoryQuantity,
                  available: v.availableForSale,
                })),
              }
            : null,
        };
        break;
      }
      case "search_products": {
        const q = String(params?.query || "");
        // Search the whole catalog server-side (stores can hold 10k+ products).
        const r = await searchProducts(creds.shop_domain, creds.access_token, q ? `title:${q}*` : "", 20);
        if (!r.ok) throw new Error(`Shopify products query failed (${r.status})`);
        let products = r.products;
        if (products.length === 0 && q) {
          const alt = await searchProducts(creds.shop_domain, creds.access_token, q, 20);
          if (alt.ok) products = alt.products;
        }
        result = { products: products.slice(0, 20) };
        break;
      }
      case "register_order": {
        // Push a locally created order (dashboard / manual) to Shopify.
        const orderId = String(params?.order_id || "");
        if (!orderId) throw new Error("order_id required");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, tenant_id, customer_name, customer_address, customer_phone, product_name, quantity, delivery_fee, line_items, shopify_order_id, shopify_sync_attempts")
          .eq("id", orderId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!order) throw new Error("Order not found");
        if (order.shopify_order_id) {
          result = { already_synced: true, shopify_order_id: order.shopify_order_id };
          break;
        }
        const r = await registerAndPersist(supabaseAdmin, order, creds);
        result = {
          synced: r.ok,
          kind: r.kind,
          shopify_order_id: r.shopifyOrderId ?? null,
          order_number: r.orderNumber ?? null,
          error: r.error ?? null,
        };
        break;
      }
      case "get_inventory":
        result = await shopifyRequest(creds.shop_domain, creds.access_token, `inventory_levels.json?inventory_item_ids=${params.inventory_item_ids}`);
        break;
      case "create_order":
        result = await shopifyRequest(creds.shop_domain, creds.access_token, "orders.json", "POST", { order: params.order });
        break;
      case "get_orders":
        result = await shopifyRequest(creds.shop_domain, creds.access_token, `orders.json?status=${params?.status || "any"}&limit=${params?.limit || 50}`);
        break;
      case "cancel_order":
        result = await shopifyRequest(creds.shop_domain, creds.access_token, `orders/${params.order_id}/cancel.json`, "POST");
        break;
      case "sync_orders": {
        // Pull recent orders from Shopify and upsert into local orders table
        const limit = Math.min(Number(params?.limit) || 100, 250);
        const sinceDays = Number(params?.since_days) || 30;
        const sinceIso = new Date(Date.now() - sinceDays * 86400_000).toISOString();
        const resp = await shopifyRequest(
          creds.shop_domain,
          creds.access_token,
          `orders.json?status=any&limit=${limit}&updated_at_min=${encodeURIComponent(sinceIso)}`,
        );
        const list = Array.isArray(resp?.orders) ? resp.orders : [];
        let inserted = 0, updated = 0;
        for (const o of list) {
          const shopifyOrderId = String(o.id);
          const ship = o.shipping_address || o.billing_address || {};
          const item = o.line_items?.[0];
          let status = "pending";
          if (o.cancelled_at) status = "cancelled";
          else if (o.fulfillment_status === "fulfilled") status = "completed";
          else if (o.financial_status === "paid") status = "processing";
          const fulfillment = (o.fulfillments || [])[0] || {};
          const tracking_number = fulfillment.tracking_number || (fulfillment.tracking_numbers || [])[0] || null;
          const tracking_url = fulfillment.tracking_url || (fulfillment.tracking_urls || [])[0] || null;
          const tracking_company = fulfillment.tracking_company || null;

          const { data: existing } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("shopify_order_id", shopifyOrderId)
            .limit(1);

          const common = {
            financial_status: o.financial_status || null,
            fulfillment_status: o.fulfillment_status || null,
            tracking_number,
            tracking_url,
            tracking_company,
            status,
            shopify_synced_at: new Date().toISOString(),
          };

          if (existing && existing.length > 0) {
            await supabaseAdmin.from("orders").update(common).eq("id", existing[0].id);
            updated++;
          } else {
            const { error: insErr } = await supabaseAdmin.from("orders").insert({
              tenant_id: tenantId,
              shopify_order_id: shopifyOrderId,
              customer_name:
                [ship.first_name, ship.last_name].filter(Boolean).join(" ") ||
                o.customer?.first_name ||
                "Customer",
              customer_phone: ship.phone || o.customer?.phone || o.phone || "",
              customer_address:
                [ship.address1, ship.address2, ship.city, ship.country].filter(Boolean).join(", ") || "",
              product_name: item?.title || "Shopify order",
              quantity: item?.quantity || 1,
              delivery_fee: 3.0,
              ...common,
            });
            if (insErr && (insErr as any).code === "23505") {
              await supabaseAdmin.from("orders").update(common)
                .eq("tenant_id", tenantId).eq("shopify_order_id", shopifyOrderId);
              updated++;
            } else if (!insErr) {
              inserted++;
            }
          }
        }
        result = { fetched: list.length, inserted, updated };
        break;
      }
      case "register_webhooks": {
        const SUPABASE_PUBLIC_URL = Deno.env.get("SUPABASE_URL")!;
        const webhookAddress = `${SUPABASE_PUBLIC_URL}/functions/v1/shopify-webhook`;
        const out = await registerWebhooks(creds.shop_domain, creds.access_token, webhookAddress);
        const list = await shopifyRequest(creds.shop_domain, creds.access_token, "webhooks.json");
        result = { registered: out, current: list?.webhooks || [], api_version: SHOPIFY_API_VERSION };
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("shopify-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
