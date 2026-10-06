import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-acting-tenant",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const { returnUrl, environment } = await req.json();
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const acting = req.headers.get("x-acting-tenant");
    const tenantId = await resolveTenantId(supabase, user.id, acting);
    let ownerIds = [user.id];
    if (tenantId) {
      const { data: tenant } = await supabase.from('tenants').select('owner_user_id').eq('id', tenantId).maybeSingle();
      if (tenant?.owner_user_id) ownerIds = [...new Set([user.id, tenant.owner_user_id])];
    }

    // Shopify-billed merchants must manage billing inside Shopify (policy 1.2.1).
    const shopifyBlocked = { ok: false };

    const { data: ownedTenants } = await supabase
      .from('tenants')
      .select('id, billing_origin')
      .in('owner_user_id', ownerIds)
      .limit(5);
    if ((ownedTenants || []).some((t: any) => t.billing_origin === 'shopify')) shopifyBlocked.ok = true;

    if (!shopifyBlocked.ok) {
      const { data: memberships } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .in('user_id', ownerIds)
        .limit(5);
      const tenantIds = (memberships || []).map((m: any) => m.tenant_id).filter(Boolean);
      if (tenantIds.length) {
        const { data: memberTenants } = await supabase
          .from('tenants')
          .select('billing_origin')
          .in('id', tenantIds);
        if ((memberTenants || []).some((t: any) => t.billing_origin === 'shopify')) shopifyBlocked.ok = true;
      }
    }

    if (!shopifyBlocked.ok) {
      const { data: shopSubs } = await supabase
        .from('subscriptions')
        .select('id')
        .in('user_id', ownerIds)
        .eq('billing_provider', 'shopify')
        .limit(1);
      if (shopSubs?.length) shopifyBlocked.ok = true;
    }

    if (shopifyBlocked.ok) {
      return json({
        error: 'Billing for this store is managed by Shopify. Open Settings \u2192 Apps and sales channels in your Shopify admin.',
        code: 'shopify_billing_required',
      }, 409);
    }

    const env = (environment || 'sandbox') as StripeEnv;

    const { data: ownSubs } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, environment, created_at, billing_provider, user_id')
      .in('user_id', ownerIds)
      .order('created_at', { ascending: false })
      .limit(20);

    let rows = ownSubs || [];

    // Employees don't own the subscription - fall back to co-members (same as cancel-subscription).
    if (!rows.some((r: any) => r.stripe_customer_id)) {
      const { data: memberships } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .in('user_id', ownerIds);
      const tenantIds = (memberships || []).map((m: any) => m.tenant_id);
      if (tenantIds.length > 0) {
        const { data: coMembers } = await supabase
          .from('tenant_members')
          .select('user_id')
          .in('tenant_id', tenantIds);
        const userIds = [...new Set((coMembers || []).map((m: any) => m.user_id))]
          .filter((id) => !ownerIds.includes(id));
        if (userIds.length > 0) {
          const { data: subs2 } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id, environment, created_at, billing_provider, user_id')
            .in('user_id', userIds)
            .order('created_at', { ascending: false })
            .limit(50);
          rows = subs2 || [];
        }
      }
    }

    const withCustomer = rows.filter((r: any) => r.stripe_customer_id);
    const preferred =
      withCustomer.find((r: any) => r.environment === env) ||
      withCustomer[0] ||
      null;

    if (!preferred?.stripe_customer_id) {
      // 200 + error so mobile clients can read data.error without Response context parsing.
      return json({
        error: 'No Stripe subscription found for this account. If you pay via Shopify, manage billing in Shopify admin.',
      }, 200);
    }

    const stripeEnv = (preferred.environment === 'live' || preferred.environment === 'sandbox'
      ? preferred.environment
      : env) as StripeEnv;
    const stripe = createStripeClient(stripeEnv);
    const portal = await stripe.billingPortal.sessions.create({
      customer: preferred.stripe_customer_id as string,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return json({ url: portal.url }, 200);
  } catch (e) {
    console.error('create-portal-session error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});