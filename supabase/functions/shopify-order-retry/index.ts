// Cron-invoked retry worker: re-attempts Shopify registration for local orders
// whose initial registration failed (or where products didn't match at the time).
// Guarantees no order is silently lost — every attempt is logged on the row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { matchProduct, stripQtyPrefix } from "../_shared/product-match.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 8;              // stop retrying after this many attempts
const BATCH_SIZE = 25;               // orders per invocation
const MIN_RETRY_AGE_SECONDS = 90;    // give the primary path time to finish

async function shopifyGet(shop: string, token: string, endpoint: string) {
  const r = await fetch(`https://${shop}/admin/api/2026-01/${endpoint}`, {
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

async function shopifyPost(shop: string, token: string, endpoint: string, body: any) {
  const r = await fetch(`https://${shop}/admin/api/2026-01/${endpoint}`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

type ItemInput = { product_name: string; quantity: number };

async function tryRegister(
  supabase: any,
  order: any,
  cred: { access_token: string; shop_domain: string },
): Promise<{ ok: boolean; kind: string; shopifyOrderId?: string; orderNumber?: number; error?: string }> {
  // Rebuild items from stored line_items jsonb, or fall back to product_name string.
  let items: ItemInput[] = [];
  if (Array.isArray(order.line_items) && order.line_items.length > 0) {
    items = order.line_items.map((li: any) => ({
      product_name: String(li.title ?? li.product_name ?? ""),
      quantity: Number(li.qty ?? li.quantity ?? 1),
    })).filter((i: ItemInput) => i.product_name);
  }
  if (items.length === 0 && order.product_name) {
    // "1x Foo, 2x Bar" → parse
    items = String(order.product_name).split(",").map((s: string) => {
      const m = s.trim().match(/^(\d+)\s*x\s*(.+)$/i);
      return m ? { product_name: m[2].trim(), quantity: parseInt(m[1], 10) } : { product_name: s.trim(), quantity: 1 };
    }).filter((i: ItemInput) => i.product_name);
  }
  if (items.length === 0) return { ok: false, kind: "failed", error: "no items to send" };

  const lineItems: Array<{ variant_id: number; quantity: number }> = [];
  const unmatched: string[] = [];
  for (const it of items) {
    const raw = stripQtyPrefix(it.product_name);
    // Per-item catalog search: large stores can't be paged on every retry.
    const best = await matchProduct(cred.shop_domain, cred.access_token, raw);
    if (best) {
      const variants = best.product.variants || [];
      let variant = variants.find((v: any) => {
        const vt = String(v.title || "").toLowerCase();
        if (!vt || vt === "default title") return false;
        return raw.includes(vt);
      }) || variants.find((v: any) => (v.inventory_quantity ?? 1) > 0) || variants[0];
      if (variant) lineItems.push({ variant_id: variant.id, quantity: it.quantity });
      else unmatched.push(it.product_name);
    } else unmatched.push(it.product_name);
  }
  if (lineItems.length === 0) return { ok: false, kind: "unmatched", error: `no product match: ${unmatched.join(", ")}` };

  const nameParts = String(order.customer_name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || ".";
  const phone = order.customer_phone || "";
  const formattedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  const address = {
    first_name: firstName, last_name: lastName,
    address1: order.customer_address || "N/A",
    city: "N/A", country: "LB", phone: formattedPhone,
  };

  // Prefer existing customer to avoid phone-already-taken.
  let customerObj: any = { first_name: firstName, last_name: lastName };
  try {
    const lookup = await shopifyGet(
      cred.shop_domain, cred.access_token,
      `customers/search.json?query=${encodeURIComponent("phone:" + formattedPhone)}`,
    );
    const existing = lookup.body?.customers?.[0];
    if (existing?.id) customerObj = { id: existing.id };
  } catch { /* ignore */ }

  const payload = {
    order: {
      line_items: lineItems,
      customer: customerObj,
      shipping_address: address,
      billing_address: address,
      shipping_lines: [{ title: "Delivery Fee", price: "3.00", code: "DELIVERY" }],
      financial_status: "pending",
      inventory_behaviour: "bypass",
      send_receipt: false,
      send_fulfillment_receipt: false,
      // Idempotency: tag with our local order id so operators can trace duplicates.
      note_attributes: [{ name: "lovable_order_id", value: String(order.id) }],
    },
  };

  const res = await shopifyPost(cred.shop_domain, cred.access_token, "orders.json", payload);
  if (!res.ok || res.body?.errors) {
    return {
      ok: false, kind: "failed",
      error: `HTTP ${res.status}: ${JSON.stringify(res.body?.errors || res.body).slice(0, 400)}`,
    };
  }
  return {
    ok: true, kind: "success",
    shopifyOrderId: String(res.body?.order?.id),
    orderNumber: res.body?.order?.order_number,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - MIN_RETRY_AGE_SECONDS * 1000).toISOString();

  try {
    // Grab candidates across all tenants.
    const { data: candidates, error } = await supabase
      .from("orders")
      .select("id, tenant_id, customer_name, customer_address, customer_phone, product_name, line_items, shopify_sync_status, shopify_sync_attempts, shopify_last_attempt_at, created_at")
      .is("shopify_order_id", null)
      // "no_credentials" is included so orders queued while the store was
      // disconnected are pushed automatically once Shopify is reconnected.
      .in("shopify_sync_status", ["failed", "unmatched", "pending", "no_credentials"])
      .lt("shopify_sync_attempts", MAX_ATTEMPTS)
      .not("tenant_id", "is", null)
      // Include rows that were never attempted (NULL) OR whose last attempt is older than cutoff.
      .or(`shopify_last_attempt_at.is.null,shopify_last_attempt_at.lte.${cutoff}`)
      .order("shopify_last_attempt_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (error) throw error;

    const summary: any[] = [];

    // Cache creds per tenant to avoid N+1.
    const credCache = new Map<string, { access_token: string; shop_domain: string } | null>();
    const getCred = async (tid: string) => {
      if (credCache.has(tid)) return credCache.get(tid)!;
      const { data } = await supabase
        .from("tenant_credentials")
        .select("access_token, shop_domain")
        .eq("tenant_id", tid)
        .eq("provider", "shopify")
        .eq("is_active", true)
        .maybeSingle();
      const c = data && data.access_token && data.shop_domain ? data : null;
      credCache.set(tid, c);
      return c;
    };

    for (const o of candidates || []) {
      // Pace to stay under Shopify's 2 req/sec limit (each order = ~3 API calls).
      await new Promise((r) => setTimeout(r, 1500));
      const cred = await getCred(o.tenant_id);
      if (!cred) {
        await supabase.from("orders").update({
          shopify_sync_status: "no_credentials",
          shopify_sync_error: "Tenant has no active Shopify connection",
          shopify_last_attempt_at: new Date().toISOString(),
        }).eq("id", o.id);
        summary.push({ order: o.id, result: "no_credentials" });
        continue;
      }

      const r = await tryRegister(supabase, o, cred);
      const nowIso = new Date().toISOString();
      const attempts = (o.shopify_sync_attempts || 0) + 1;

      if (r.ok && r.shopifyOrderId) {
        const updates: any = {
          shopify_order_id: r.shopifyOrderId,
          shopify_sync_status: "synced",
          shopify_sync_error: null,
          shopify_sync_attempts: attempts,
          shopify_last_attempt_at: nowIso,
          shopify_synced_at: nowIso,
        };
        // Try to backfill display_id with the Shopify order number (best-effort — may collide).
        if (r.orderNumber) {
          const { error: upErr } = await supabase.from("orders").update({ ...updates, display_id: r.orderNumber }).eq("id", o.id);
          if (upErr && (upErr as any).code === "23505") {
            await supabase.from("orders").update(updates).eq("id", o.id);
          }
        } else {
          await supabase.from("orders").update(updates).eq("id", o.id);
        }
        summary.push({ order: o.id, result: "synced", shopify_id: r.shopifyOrderId });
      } else if (/HTTP 401|HTTP 403|products 401|products 403/.test(r.error || "")) {
        // Token was revoked (app uninstalled / reinstalled). Flag the connection
        // and keep the order queued instead of burning retry attempts.
        await supabase.from("tenant_credentials")
          .update({ is_active: false, updated_at: nowIso })
          .eq("tenant_id", o.tenant_id).eq("provider", "shopify");
        credCache.set(o.tenant_id, null);
        await supabase.from("orders").update({
          shopify_sync_status: "no_credentials",
          shopify_sync_error: "Shopify token revoked — reconnect the store",
          shopify_last_attempt_at: nowIso,
        }).eq("id", o.id);
        summary.push({ order: o.id, result: "token_revoked" });
      } else {
        await supabase.from("orders").update({
          shopify_sync_status: r.kind,
          shopify_sync_error: r.error?.slice(0, 500) || "unknown",
          shopify_sync_attempts: attempts,
          shopify_last_attempt_at: nowIso,
        }).eq("id", o.id);
        summary.push({ order: o.id, result: r.kind, error: r.error });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: (candidates || []).length, results: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("shopify-order-retry error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
