import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { type StripeEnv, createStripeClient } from '../_shared/stripe.ts';

// Cancel every Stripe subscription tied to this user, in both environments.
async function cancelSubscriptions(admin: any, userId: string) {
  const canceled: string[] = [];

  const { data: rows } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id, environment, status')
    .eq('user_id', userId);

  for (const env of ['live', 'sandbox'] as StripeEnv[]) {
    let stripe: ReturnType<typeof createStripeClient>;
    try {
      stripe = createStripeClient(env);
    } catch (e) {
      console.warn(`delete-account: stripe ${env} unavailable`, (e as Error).message);
      continue;
    }

    const ids = new Set<string>(
      (rows ?? [])
        .filter((r: any) => r.environment === env && r.stripe_subscription_id)
        .map((r: any) => r.stripe_subscription_id as string),
    );

    // Also catch subscriptions that never made it into our table.
    try {
      const found = await stripe.subscriptions.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 100,
      });
      for (const s of found.data) ids.add(s.id);
    } catch (e) {
      console.warn(`delete-account: subscription search failed (${env})`, (e as Error).message);
    }

    for (const id of ids) {
      try {
        const sub = await stripe.subscriptions.retrieve(id);
        if (['canceled', 'incomplete_expired'].includes(sub.status)) continue;
        await stripe.subscriptions.cancel(id, { prorate: false });
        canceled.push(id);
      } catch (e) {
        console.error(`delete-account: failed to cancel ${id} (${env})`, (e as Error).message);
      }
    }
  }

  if (canceled.length) {
    await admin
      .from('subscriptions')
      .update({ status: 'canceled', cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .in('stripe_subscription_id', canceled);
  }

  return canceled;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const admin = createClient(url, service);

    // Never allow a super admin account to self-destruct — losing it locks
    // everyone out of the admin console.
    const { data: superRole } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .maybeSingle();
    if (superRole) {
      return new Response(
        JSON.stringify({ error: 'Super admin accounts cannot be deleted from the app.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }


    // Stop billing before anything is removed, so a deleted account can never
    // keep getting charged.
    let canceledSubscriptions: string[] = [];
    try {
      canceledSubscriptions = await cancelSubscriptions(admin, userId);
    } catch (e) {
      console.error('delete-account: subscription cancellation error', (e as Error).message);
    }

    // Best-effort cleanup of owned tenant(s) where this user is the only member.
    const { data: memberships } = await admin
      .from('tenant_members').select('tenant_id').eq('user_id', userId);

    for (const m of memberships ?? []) {
      const { count } = await admin
        .from('tenant_members')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', m.tenant_id);
      if ((count ?? 0) <= 1) {
        await admin.from('tenants').delete().eq('id', m.tenant_id);
      } else {
        await admin.from('tenant_members').delete()
          .eq('tenant_id', m.tenant_id).eq('user_id', userId);
      }
    }

    await admin.from('profiles').delete().eq('user_id', userId);
    await admin.from('user_roles').delete().eq('user_id', userId);

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true, canceledSubscriptions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
