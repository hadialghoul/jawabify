// Shopify Billing API — merchants who installed from the Shopify App Store are
// charged through Shopify (policy 1.2.1). Direct sign-ups keep using Stripe.
//
// Routes:
//   POST /            { shop, plan }  -> { confirmation_url }
//   GET  /callback?shop=&charge_id=   -> confirms + redirects into the app
//   GET  /status?shop=                -> { active, plan, status }
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  isValidShopDomain,
  normalizeShopDomain,
  shopifyGraphQL,
} from "../_shared/shopify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://jawabify.com";

const PLANS: Record<string, { name: string; amount: number; price_id: string }> = {
  starter: { name: "Jawabify Starter", amount: 45, price_id: "jawabify_pro_monthly_v2" },
  growth: { name: "Jawabify Growth", amount: 90, price_id: "jawabify_growth_monthly" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Access token for a shop: from the linked tenant, else from a pending install. */
async function tokenFor(shop: string): Promise<{ token: string; tenantId: string | null } | null> {
  const { data: cred } = await admin
    .from("tenant_credentials")
    .select("access_token, tenant_id")
    .eq("provider", "shopify")
    .eq("shop_domain", shop)
    .eq("is_active", true)
    .maybeSingle();
  if (cred?.access_token) return { token: cred.access_token, tenantId: cred.tenant_id ?? null };

  const { data: pending } = await admin
    .from("shopify_pending_installs")
    .select("access_token, tenant_id")
    .eq("shop_domain", shop)
    .maybeSingle();
  if (pending?.access_token) return { token: pending.access_token, tenantId: pending.tenant_id ?? null };
  return null;
}

/** Development stores can only be charged with test:true. */
async function isDevStore(shop: string, token: string): Promise<boolean> {
  const r = await shopifyGraphQL<any>(shop, token, `{ shop { plan { partnerDevelopment shopifyPlus } } }`);
  return !!r.data?.shop?.plan?.partnerDevelopment;
}

async function activeSubscription(shop: string, token: string) {
  const r = await shopifyGraphQL<any>(
    shop,
    token,
    `{ currentAppInstallation { activeSubscriptions { id name status trialDays createdAt currentPeriodEnd test } } }`,
  );
  const subs = r.data?.currentAppInstallation?.activeSubscriptions || [];
  return subs[0] ?? null;
}

function planKeyFromName(name: string): string {
  return String(name || "").toLowerCase().includes("growth") ? "growth" : "starter";
}

/** Mirrors a Shopify app subscription into the local subscriptions table. */
async function recordSubscription(shop: string, sub: any) {
  const { data: cred } = await admin
    .from("tenant_credentials")
    .select("tenant_id")
    .eq("provider", "shopify")
    .eq("shop_domain", shop)
    .maybeSingle();
  let tenantId = cred?.tenant_id ?? null;
  if (!tenantId) {
    const { data: pending } = await admin
      .from("shopify_pending_installs")
      .select("tenant_id")
      .eq("shop_domain", shop)
      .maybeSingle();
    tenantId = pending?.tenant_id ?? null;
  }
  if (!tenantId) {
    console.warn("no tenant yet for shop, skipping local record", shop);
    return false;
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("owner_user_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant?.owner_user_id) return false;

  const plan = PLANS[planKeyFromName(sub?.name)];
  const status = String(sub?.status || "ACTIVE").toLowerCase();
  const localStatus = status === "active"
    ? (Number(sub?.trialDays) > 0 && sub?.createdAt &&
        Date.now() < new Date(sub.createdAt).getTime() + Number(sub.trialDays) * 86400000
        ? "trialing"
        : "active")
    : status === "pending"
      ? "incomplete"
      : status === "frozen"
        ? "past_due"
        : "canceled";

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("shopify_subscription_id", sub.id)
    .maybeSingle();

  const row = {
    user_id: tenant.owner_user_id,
    billing_provider: "shopify",
    shopify_subscription_id: sub.id,
    shop_domain: shop,
    price_id: plan.price_id,
    status: localStatus,
    current_period_end: sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
    environment: "live",
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    await admin.from("subscriptions").update(row).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert(row);
  }

  await admin.from("tenants").update({ billing_origin: "shopify" }).eq("id", tenantId);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  try {
    // The body can only be read once per request, so parse it up front and
    // reuse it for both the status check and subscription creation.
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // ─── STATUS ───
    if (req.method === "GET" && url.pathname.endsWith("/status")) {
      const shop = normalizeShopDomain(url.searchParams.get("shop") || "");
      return statusFor(shop);
    }
    // POST with { status: true, shop } — same check. supabase.functions.invoke
    // always POSTs to the function base URL, so the status flag travels in the body.
    if (req.method === "POST" && (body as any)?.status) {
      return statusFor(normalizeShopDomain(String((body as any)?.shop || "")));
    }

    async function statusFor(shop: string) {
      if (!isValidShopDomain(shop)) return json({ active: false });
      const creds = await tokenFor(shop);
      if (!creds) return json({ active: false });
      const sub = await activeSubscription(shop, creds.token);
      if (sub) await recordSubscription(shop, sub);
      return json({
        active: !!sub && ["ACTIVE", "ACCEPTED"].includes(String(sub.status).toUpperCase()),
        plan: sub ? planKeyFromName(sub.name) : null,
        status: sub?.status ?? null,
      });
    }

    // ─── CALLBACK from the Shopify approval screen ───
    if (req.method === "GET" && url.pathname.endsWith("/callback")) {
      const shop = normalizeShopDomain(url.searchParams.get("shop") || "");
      if (!isValidShopDomain(shop)) return new Response("Invalid shop", { status: 400 });
      const creds = await tokenFor(shop);
      if (!creds) return new Response("Store not connected", { status: 400 });

      const sub = await activeSubscription(shop, creds.token);
      if (sub) await recordSubscription(shop, sub);

      const dest = `${APP_URL}/shopify/connect?shop=${encodeURIComponent(shop)}&billing=${
        sub ? "approved" : "declined"
      }`;
      return new Response(null, { status: 302, headers: { Location: dest } });
    }

    // ─── CREATE an app subscription (returns Shopify's approval URL) ───
    if (req.method === "POST") {
      const shop = normalizeShopDomain(String((body as any)?.shop || ""));
      const planKey = PLANS[String((body as any)?.plan || "starter")]
        ? String((body as any).plan)
        : "starter";
      if (!isValidShopDomain(shop)) return json({ error: "Invalid shop domain" }, 400);

      const creds = await tokenFor(shop);
      if (!creds) return json({ error: "This store is not connected to Jawabify yet." }, 400);

      // Never double-bill: block only when a LIVE card subscription is running
      // for the owner. Sandbox/test Stripe rows and tenants already flagged as
      // Shopify-billed must never block the Shopify approval screen (a blocked
      // approval would fail App Store review).
      if (creds.tenantId) {
        const { data: tenant } = await admin
          .from("tenants")
          .select("owner_user_id, billing_origin")
          .eq("id", creds.tenantId)
          .maybeSingle();
        if (tenant?.owner_user_id && tenant.billing_origin !== "shopify") {
          const { data: subs } = await admin
            .from("subscriptions")
            .select("billing_provider, status, current_period_end, environment")
            .eq("user_id", tenant.owner_user_id)
            .eq("billing_provider", "stripe");
          const liveStripe = (subs || []).some((s: any) =>
            s.environment !== "sandbox" &&
            ["active", "trialing", "past_due"].includes(s.status) &&
            (!s.current_period_end || new Date(s.current_period_end) > new Date())
          );
          if (liveStripe) {
            return json({
              error: "This account already has an active Jawabify subscription billed by card.",
              code: "already_billed_by_stripe",
            }, 409);
          }
        }
      }

      const existing = await activeSubscription(shop, creds.token);
      if (existing && ["ACTIVE", "ACCEPTED"].includes(String(existing.status).toUpperCase())) {
        await recordSubscription(shop, existing);
        return json({ already_active: true, plan: planKeyFromName(existing.name) });
      }

      const plan = PLANS[planKey];
      const test = await isDevStore(shop, creds.token);
      const returnUrl =
        `${SUPABASE_URL}/functions/v1/shopify-billing/callback?shop=${encodeURIComponent(shop)}`;

      const mutation = `
        mutation AppSubscriptionCreate(
          $name: String!, $returnUrl: URL!, $trialDays: Int, $test: Boolean,
          $lineItems: [AppSubscriptionLineItemInput!]!
        ) {
          appSubscriptionCreate(
            name: $name, returnUrl: $returnUrl, trialDays: $trialDays, test: $test,
            lineItems: $lineItems
          ) {
            confirmationUrl
            appSubscription { id status }
            userErrors { field message }
          }
        }`;

      const r = await shopifyGraphQL<any>(shop, creds.token, mutation, {
        name: plan.name,
        returnUrl,
        trialDays: 7,
        test,
        lineItems: [{
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.amount, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        }],
      });

      const payload = r.data?.appSubscriptionCreate;
      const userErrors = payload?.userErrors || [];
      if (!r.ok || userErrors.length || !payload?.confirmationUrl) {
        console.error("appSubscriptionCreate failed", { errors: r.errors, userErrors });
        return json({
          error: userErrors[0]?.message || "Could not start Shopify billing for this store.",
        }, 400);
      }

      return json({ confirmation_url: payload.confirmationUrl, plan: planKey, test });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error("shopify-billing error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
