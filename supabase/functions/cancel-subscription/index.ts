import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { shopifyGraphQL } from "../_shared/shopify.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Cancels the caller's Stripe subscription at the end of the current billing
// period (never immediately — access is kept until paid time runs out).
// Shopify-billed merchants must cancel inside Shopify admin (policy 1.2.1).
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
    const { environment } = await req.json().catch(() => ({}));
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const env = (environment || 'sandbox') as StripeEnv;

    // Find the user's cancellable Stripe subscription in this environment.
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, stripe_subscription_id, status, cancel_at_period_end, billing_provider, current_period_end, environment, shop_domain, shopify_subscription_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    let rows = subs || [];

    // Employees don't own the subscription — the account owner does. If the
    // caller has no subscription of their own, fall back to the subscription
    // owned by any member of the caller's workspace(s).
    if (rows.length === 0) {
      const { data: memberships } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id);
      const tenantIds = (memberships || []).map((m: any) => m.tenant_id);
      if (tenantIds.length > 0) {
        const { data: coMembers } = await supabase
          .from('tenant_members')
          .select('user_id')
          .in('tenant_id', tenantIds);
        const userIds = [...new Set((coMembers || []).map((m: any) => m.user_id))].filter((id) => id !== user.id);
        if (userIds.length > 0) {
          const { data: subs2 } = await supabase
            .from('subscriptions')
            .select('id, stripe_subscription_id, status, cancel_at_period_end, billing_provider, current_period_end, environment, shop_domain, shopify_subscription_id')
            .in('user_id', userIds)
            .order('created_at', { ascending: false })
            .limit(50);
          rows = subs2 || [];
        }
      }
    }
    const shopifyRow = rows.find((r: any) => r.billing_provider === 'shopify' && ['active', 'trialing', 'past_due'].includes(r.status));
    if (shopifyRow) {
      const shop = shopifyRow.shop_domain;
      const subId = shopifyRow.shopify_subscription_id;
      if (!shop || !subId) {
        return json({ error: 'This plan is billed through Shopify. Cancel it from your Shopify admin under Settings → Apps and sales channels.', code: 'shopify_billing_required' }, 409);
      }
      const { data: cred } = await supabase
        .from('tenant_credentials')
        .select('access_token')
        .eq('provider', 'shopify')
        .eq('shop_domain', shop)
        .eq('is_active', true)
        .maybeSingle();
      const accessToken = cred?.access_token;
      if (!accessToken) {
        return json({ error: 'Could not reach your Shopify store. Cancel from your Shopify admin under Settings → Apps and sales channels.', code: 'shopify_billing_required' }, 409);
      }

      // prorate: false keeps access until the end of the paid period.
      const r = await shopifyGraphQL<any>(
        shop,
        accessToken,
        `mutation cancelSub($id: ID!) {
          appSubscriptionCancel(id: $id, prorate: false) {
            appSubscription { id status }
            userErrors { field message }
          }
        }`,
        { id: subId },
      );
      const payload = r.data?.appSubscriptionCancel;
      const userErrors = payload?.userErrors || [];
      if (userErrors.length > 0 || r.errors) {
        console.error('appSubscriptionCancel failed', { userErrors, errors: r.errors });
        return json({ error: userErrors[0]?.message || 'Shopify could not cancel this plan. Try again from your Shopify admin.' }, 502);
      }

      await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          status: shopifyRow.current_period_end && new Date(shopifyRow.current_period_end) > new Date()
            ? shopifyRow.status
            : 'canceled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shopifyRow.id);

      return json({ ok: true, provider: 'shopify', current_period_end: shopifyRow.current_period_end });
    }


    const target = rows.find((r: any) =>
      r.environment === env &&
      r.stripe_subscription_id &&
      ['active', 'trialing', 'past_due'].includes(r.status)
    );
    if (!target) return json({ error: 'No active subscription found to cancel.' }, 404);
    if (target.cancel_at_period_end) {
      return json({ ok: true, already: true, current_period_end: target.current_period_end });
    }

    const stripe = createStripeClient(env);
    const updated = await stripe.subscriptions.update(target.stripe_subscription_id as string, {
      cancel_at_period_end: true,
    });

    const periodEnd = (updated as any).current_period_end ?? (updated.items?.data?.[0] as any)?.current_period_end ?? null;
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        status: (updated as any).status || target.status,
        ...(periodEnd ? { current_period_end: new Date(periodEnd * 1000).toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', target.id);

    return json({ ok: true, current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : target.current_period_end });
  } catch (e) {
    console.error('cancel-subscription error:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
