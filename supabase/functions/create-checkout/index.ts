import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function listData<T>(response: { data?: T[] } | null | undefined, label: string): T[] {
  if (Array.isArray(response?.data)) return response.data;
  const maybeError = response as { type?: unknown; message?: unknown; details?: unknown; props?: unknown } | null | undefined;
  console.error(`${label} returned an unexpected response shape`, {
    keys: response ? Object.keys(response as Record<string, unknown>) : [],
    type: maybeError?.type,
    message: maybeError?.message,
    details: maybeError?.details,
    props: maybeError?.props,
  });
  return [];
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    const customers = listData<{ id: string }>(found, 'customers.search');
    if (customers.length) return customers[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customers = listData<{ id: string; metadata?: Record<string, string> }>(existing, 'customers.list');
    if (customers.length) {
      const customer = customers[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { priceId, returnUrl, environment } = await req.json();
    if (!priceId || !returnUrl || !environment) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(priceId)) throw new Error("Invalid priceId");

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard: never double-bill. If billing already runs through Shopify, block Stripe checkout.
    const { data: existingSubs } = await supabase
      .from("subscriptions")
      .select("billing_provider, status, current_period_end")
      .eq("user_id", user.id);

    const hasLiveShopify = (existingSubs || []).some((s: any) =>
      s.billing_provider === "shopify" &&
      ["active", "trialing", "past_due"].includes(s.status) &&
      (!s.current_period_end || new Date(s.current_period_end) > new Date())
    );
    if (hasLiveShopify) {
      return new Response(JSON.stringify({
        error: "Your subscription is billed through Shopify. Manage it from your Shopify admin — no card payment needed.",
        code: "already_billed_by_shopify",
      }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // App Store installs must never be offered a card checkout (Shopify policy 1.2.1):
    // resolve the tenant's billing origin (via the acting tenant when impersonating).
    const actingTenant = req.headers.get("x-acting-tenant");
    let tenantId: string | null = null;
    if (actingTenant) {
      const { data: member } = await supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("tenant_id", actingTenant)
        .eq("user_id", user.id)
        .maybeSingle();
      if (member?.tenant_id) tenantId = member.tenant_id;
    }
    if (!tenantId) {
      const { data: owner } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", user.id)
        .limit(1)
        .maybeSingle();
      tenantId = owner?.id ?? null;
    }
    const candidateTenantIds = new Set<string>();
    if (tenantId) candidateTenantIds.add(tenantId);
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(5);
    for (const m of memberships || []) if (m?.tenant_id) candidateTenantIds.add(m.tenant_id);

    if (candidateTenantIds.size) {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("billing_origin")
        .in("id", [...candidateTenantIds]);
      if ((tenants || []).some((t: any) => t.billing_origin === "shopify")) {
        return new Response(JSON.stringify({
          error: "This account was set up through the Shopify App Store, so billing runs through Shopify. Approve your plan from your Shopify admin.",
          code: "shopify_billing_required",
        }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }


    const env = environment as StripeEnv;
    const stripe = createStripeClient(env);

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    const priceList = listData<{ id: string }>(prices, 'prices.list');
    if (!priceList.length) throw new Error("Price not found");
    const stripePrice = priceList[0];

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: user.email,
      userId: user.id,
    });

    // Skip the trial for anyone who already had a subscription — including
    // canceled ones — so a canceled past subscription cannot be used to
    // claim another free 7 days.
    let hasHadSub = false;
    try {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 20,
      });
      const subscriptions = listData<{ status: string }>(existingSubs, 'subscriptions.list');
      hasHadSub = subscriptions.some(s =>
        ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete_expired'].includes(s.status)
      );
    } catch (e) {
      console.error('subscriptions.list failed, defaulting to trial-eligible:', e);
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: 'subscription',
      ui_mode: 'embedded_page',
      return_url: returnUrl,
      customer: customerId,
      customer_update: { address: 'auto', name: 'auto' },
      automatic_tax: { enabled: true },
      subscription_data: {
        metadata: { userId: user.id },
        ...(!hasHadSub && { trial_period_days: 7 }),
      },
      metadata: { userId: user.id },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('create-checkout error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
