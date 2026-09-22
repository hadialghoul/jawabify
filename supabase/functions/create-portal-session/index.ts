import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

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

  try {
    const { returnUrl, environment } = await req.json();
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

    // Shopify-billed merchants must manage billing inside Shopify (policy 1.2.1).
    // Check every signal: owned tenant, membership tenant, and any Shopify
    // subscription row on the account.
    const shopifyBlocked = { ok: false };

    const { data: ownedTenants } = await supabase
      .from('tenants')
      .select('id, billing_origin')
      .eq('owner_user_id', user.id)
      .limit(5);
    if ((ownedTenants || []).some((t: any) => t.billing_origin === 'shopify')) shopifyBlocked.ok = true;

    if (!shopifyBlocked.ok) {
      const { data: memberships } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
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
        .eq('user_id', user.id)
        .eq('billing_provider', 'shopify')
        .limit(1);
      if (shopSubs?.length) shopifyBlocked.ok = true;
    }

    if (shopifyBlocked.ok) {
      return new Response(JSON.stringify({
        error: 'Billing for this store is managed by Shopify. Open Settings → Apps and sales channels in your Shopify admin.',
        code: 'shopify_billing_required',
      }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }


    const env = (environment || 'sandbox') as StripeEnv;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .eq('environment', env)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No subscription found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = createStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id as string,
      ...(returnUrl && { return_url: returnUrl }),
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('create-portal-session error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
