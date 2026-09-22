// Shared: register a local order row on the tenant's Shopify store.
// Used by shopify-order-retry (cron) and shopify-api (manual/dashboard orders)
// so every path that creates an order in Jawabify also pushes it to Shopify.

import { shopifyRest } from "./shopify.ts";
import { matchProduct, stripQtyPrefix } from "./product-match.ts";

export type ShopifyCred = { access_token: string; shop_domain: string };

type ItemInput = { product_name: string; quantity: number };

export type RegisterResult = {
  ok: boolean;
  kind: string;
  shopifyOrderId?: string;
  orderNumber?: number;
  error?: string;
};

async function rest(shop: string, token: string, endpoint: string, method = "GET", body?: any) {
  const r = await shopifyRest(shop, token, endpoint, method, body);
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

/** Rebuild orderable items from line_items jsonb, falling back to the product_name string. */
export function itemsFromOrder(order: any): ItemInput[] {
  let items: ItemInput[] = [];
  if (Array.isArray(order.line_items) && order.line_items.length > 0) {
    items = order.line_items
      .map((li: any) => ({
        product_name: String(li.title ?? li.product_name ?? ""),
        quantity: Number(li.qty ?? li.quantity ?? 1),
      }))
      .filter((i: ItemInput) => i.product_name);
  }
  if (items.length === 0 && order.product_name) {
    items = String(order.product_name)
      .split(",")
      .map((s: string) => {
        const m = s.trim().match(/^(\d+)\s*x\s*(.+)$/i);
        return m
          ? { product_name: m[2].trim(), quantity: parseInt(m[1], 10) }
          : { product_name: s.trim(), quantity: Number(order.quantity) || 1 };
      })
      .filter((i: ItemInput) => i.product_name);
  }
  return items;
}

export async function registerOrderOnShopify(order: any, cred: ShopifyCred): Promise<RegisterResult> {
  const items = itemsFromOrder(order);
  if (items.length === 0) return { ok: false, kind: "failed", error: "no items to send" };

  const lineItems: Array<{ variant_id: number; quantity: number }> = [];
  const unmatched: string[] = [];
  for (const it of items) {
    const raw = stripQtyPrefix(it.product_name);
    // Search the live catalog per item — stores can hold tens of thousands of
    // products, far more than can be paged through on every order.
    const best = await matchProduct(cred.shop_domain, cred.access_token, raw);
    if (best) {
      const variants = best.product.variants || [];
      const variant =
        variants.find((v: any) => {
          const vt = String(v.title || "").toLowerCase();
          if (!vt || vt === "default title") return false;
          return raw.includes(vt);
        }) ||
        variants.find((v: any) => (v.inventory_quantity ?? 1) > 0) ||
        variants[0];
      if (variant) lineItems.push({ variant_id: variant.id, quantity: it.quantity });
      else unmatched.push(it.product_name);
    } else unmatched.push(it.product_name);
  }
  if (lineItems.length === 0) {
    return { ok: false, kind: "unmatched", error: `no product match: ${unmatched.join(", ")}` };
  }

  const nameParts = String(order.customer_name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || ".";
  const phone = order.customer_phone || "";
  const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  const address = {
    first_name: firstName,
    last_name: lastName,
    address1: order.customer_address || "N/A",
    city: "N/A",
    country: "LB",
    phone: formattedPhone,
  };

  // Prefer an existing customer so Shopify doesn't reject a taken phone number.
  let customerObj: any = { first_name: firstName, last_name: lastName };
  try {
    const lookup = await rest(
      cred.shop_domain,
      cred.access_token,
      `customers/search.json?query=${encodeURIComponent("phone:" + formattedPhone)}`,
    );
    const existing = lookup.body?.customers?.[0];
    if (existing?.id) customerObj = { id: existing.id };
  } catch { /* ignore */ }

  const deliveryFee = order.delivery_fee == null ? 3 : Number(order.delivery_fee) || 0;
  const payload = {
    order: {
      line_items: lineItems,
      customer: customerObj,
      shipping_address: address,
      billing_address: address,
      shipping_lines: deliveryFee > 0
        ? [{ title: "Delivery Fee", price: deliveryFee.toFixed(2), code: "DELIVERY" }]
        : [],
      financial_status: "pending",
      inventory_behaviour: "bypass",
      send_receipt: false,
      send_fulfillment_receipt: false,
      note_attributes: [{ name: "lovable_order_id", value: String(order.id) }],
    },
  };

  const res = await rest(cred.shop_domain, cred.access_token, "orders.json", "POST", payload);
  if (!res.ok || res.body?.errors) {
    return {
      ok: false,
      kind: "failed",
      error: `HTTP ${res.status}: ${JSON.stringify(res.body?.errors || res.body).slice(0, 400)}`,
    };
  }
  return {
    ok: true,
    kind: "success",
    shopifyOrderId: String(res.body?.order?.id),
    orderNumber: res.body?.order?.order_number,
  };
}

/** Load the tenant's active Shopify credential, or null. */
export async function getShopifyCred(supabase: any, tenantId: string): Promise<ShopifyCred | null> {
  const { data } = await supabase
    .from("tenant_credentials")
    .select("access_token, shop_domain")
    .eq("tenant_id", tenantId)
    .eq("provider", "shopify")
    .eq("is_active", true)
    .maybeSingle();
  return data && data.access_token && data.shop_domain ? data : null;
}

/** Register the order and persist the outcome on the row. */
export async function registerAndPersist(
  supabase: any,
  order: any,
  cred: ShopifyCred,
): Promise<RegisterResult> {
  const r = await registerOrderOnShopify(order, cred);
  const nowIso = new Date().toISOString();
  const attempts = (order.shopify_sync_attempts || 0) + 1;

  if (r.ok && r.shopifyOrderId) {
    const updates: any = {
      shopify_order_id: r.shopifyOrderId,
      shopify_sync_status: "synced",
      shopify_sync_error: null,
      shopify_sync_attempts: attempts,
      shopify_last_attempt_at: nowIso,
      shopify_synced_at: nowIso,
    };
    if (r.orderNumber) {
      const { error: upErr } = await supabase
        .from("orders")
        .update({ ...updates, display_id: r.orderNumber })
        .eq("id", order.id);
      if (upErr && (upErr as any).code === "23505") {
        await supabase.from("orders").update(updates).eq("id", order.id);
      }
    } else {
      await supabase.from("orders").update(updates).eq("id", order.id);
    }
  } else {
    await supabase.from("orders").update({
      shopify_sync_status: r.kind === "unmatched" ? "unmatched" : "failed",
      shopify_sync_error: r.error?.slice(0, 500) || "unknown",
      shopify_sync_attempts: attempts,
      shopify_last_attempt_at: nowIso,
    }).eq("id", order.id);
  }
  return r;
}
