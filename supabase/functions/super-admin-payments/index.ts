import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { type StripeEnv, createStripeClient } from '../_shared/stripe.ts';

const responseHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, 'Content-Type': 'application/json' },
  });

const decodeJwtPayload = (token: string): { sub?: string } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const isSuperAdmin = async (req: Request, url: string, anonKey: string): Promise<boolean> => {
  const token = (req.headers.get('Authorization') ?? '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  if (!token) return false;
  const userId = decodeJwtPayload(token)?.sub;
  if (!userId) return false;
  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data } = await verifier
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle();
  return Boolean(data?.user_id);
};

const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
const THREE_DECIMAL = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd']);
const toMajor = (amount: number | null | undefined, currency: string) => {
  const v = amount ?? 0;
  const c = (currency ?? '').toLowerCase();
  if (ZERO_DECIMAL.has(c)) return v;
  if (THREE_DECIMAL.has(c)) return v / 1000;
  return v / 100;
};
const iso = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

async function loadEnv(env: StripeEnv, limit: number) {
  const stripe = createStripeClient(env);
  const [charges, subs] = await Promise.all([
    stripe.charges.list({ limit, expand: ['data.customer'] }),
    stripe.subscriptions.list({ status: 'all', limit, expand: ['data.customer'] }),
  ]);

  return {
    charges: charges.data.map((c: any) => ({
      id: c.id,
      environment: env,
      amount: toMajor(c.amount, c.currency),
      amount_refunded: toMajor(c.amount_refunded, c.currency),
      currency: c.currency,
      status: c.status,
      paid: c.paid,
      refunded: c.refunded,
      description: c.description ?? null,
      created: iso(c.created),
      receipt_url: c.receipt_url ?? null,
      failure_message: c.failure_message ?? null,
      customer_id: typeof c.customer === 'string' ? c.customer : c.customer?.id ?? null,
      customer_email: (typeof c.customer === 'object' ? c.customer?.email : null) ?? c.billing_details?.email ?? null,
      customer_name: (typeof c.customer === 'object' ? c.customer?.name : null) ?? c.billing_details?.name ?? null,
      user_id: (typeof c.customer === 'object' ? c.customer?.metadata?.userId : null) ?? c.metadata?.userId ?? null,
      card: c.payment_method_details?.card
        ? { brand: c.payment_method_details.card.brand, last4: c.payment_method_details.card.last4 }
        : null,
      subscription_id: c.invoice ? null : null,
    })),
    subscriptions: subs.data.map((s: any) => {
      const item = s.items?.data?.[0];
      return {
        id: s.id,
        environment: env,
        status: s.status,
        plan: item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id ?? item?.price?.id ?? null,
        amount: toMajor(item?.price?.unit_amount, item?.price?.currency ?? 'usd'),
        currency: item?.price?.currency ?? 'usd',
        current_period_end: iso(item?.current_period_end ?? s.current_period_end),
        cancel_at_period_end: Boolean(s.cancel_at_period_end),
        created: iso(s.created),
        customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id ?? null,
        customer_email: typeof s.customer === 'object' ? s.customer?.email ?? null : null,
        user_id: s.metadata?.userId ?? (typeof s.customer === 'object' ? s.customer?.metadata?.userId : null) ?? null,
      };
    }),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: responseHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    if (!(await isSuperAdmin(req, url, anonKey))) return json({ error: 'Unauthorized' }, 401);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit) || 50, 100);
    const action = typeof body.action === 'string' ? body.action : 'list';
    const env: StripeEnv = body.environment === 'sandbox' ? 'sandbox' : 'live';

    if (action === 'refund') {
      if (typeof body.charge_id !== 'string' || !/^(ch|py)_[A-Za-z0-9_]+$/.test(body.charge_id)) {
        return json({ error: 'Invalid charge_id' }, 400);
      }
      const stripe = createStripeClient(env);
      const refund = await stripe.refunds.create({
        charge: body.charge_id,
        ...(body.amount ? { amount: Math.round(Number(body.amount) * 100) } : {}),
      });
      return json({
        refund: { id: refund.id, status: refund.status, amount: toMajor(refund.amount, refund.currency), currency: refund.currency },
      });
    }

    if (action === 'cancel_subscription') {
      if (typeof body.subscription_id !== 'string' || !/^sub_[A-Za-z0-9_]+$/.test(body.subscription_id)) {
        return json({ error: 'Invalid subscription_id' }, 400);
      }
      const stripe = createStripeClient(env);
      const sub: any = await stripe.subscriptions.retrieve(body.subscription_id);
      if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
        await stripe.subscriptions.cancel(body.subscription_id, { prorate: false });
      }
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await admin
        .from('subscriptions')
        .update({ status: 'canceled', cancel_at_period_end: false, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', body.subscription_id);
      return json({ canceled: body.subscription_id });
    }

    if (action === 'extend_trial') {
      if (typeof body.subscription_id !== 'string' || !/^sub_[A-Za-z0-9_]+$/.test(body.subscription_id)) {
        return json({ error: 'Invalid subscription_id' }, 400);
      }
      const days = Math.min(Math.max(Number(body.days) || 30, 1), 365);
      const stripe = createStripeClient(env);
      const sub: any = await stripe.subscriptions.retrieve(body.subscription_id);
      const nowSec = Math.floor(Date.now() / 1000);
      const base = Math.max(Number(sub.trial_end) || 0, Number(sub.current_period_end) || 0, nowSec);
      const trialEnd = base + days * 86400;
      const updated: any = await stripe.subscriptions.update(body.subscription_id, {
        trial_end: trialEnd,
        proration_behavior: 'none',
      });
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await admin
        .from('subscriptions')
        .update({
          status: updated.status,
          current_period_end: new Date(trialEnd * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', body.subscription_id);
      return json({ subscription_id: body.subscription_id, trial_end: new Date(trialEnd * 1000).toISOString(), status: updated.status });
    }

    // Grant free access to any tenant owner, with or without a Stripe subscription
    if (action === 'grant_free_access') {
      const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Invalid user_id' }, 400);
      const days = Math.min(Math.max(Number(body.days) || 30, 1), 730);
      const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      const { data: rows, error: readErr } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (readErr) return json({ error: readErr.message }, 500);

      const now = Date.now();
      const stripeRow = (rows ?? []).find((r: any) => r.stripe_subscription_id && r.billing_provider !== 'shopify');

      // Stripe-backed: push the Stripe trial so we never double-charge the merchant
      if (stripeRow) {
        const stripeEnv: StripeEnv = stripeRow.environment === 'sandbox' ? 'sandbox' : 'live';
        try {
          const stripe = createStripeClient(stripeEnv);
          const sub: any = await stripe.subscriptions.retrieve(stripeRow.stripe_subscription_id);
          if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
            const nowSec = Math.floor(now / 1000);
            const base = Math.max(Number(sub.trial_end) || 0, Number(sub.current_period_end) || 0, nowSec);
            const trialEnd = base + days * 86400;
            const updated: any = await stripe.subscriptions.update(stripeRow.stripe_subscription_id, {
              trial_end: trialEnd,
              proration_behavior: 'none',
            });
            await admin
              .from('subscriptions')
              .update({
                status: updated.status,
                current_period_end: new Date(trialEnd * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', stripeRow.id);
            return json({ mode: 'stripe', until: new Date(trialEnd * 1000).toISOString(), status: updated.status });
          }
        } catch (e) {
          console.error('stripe trial extend failed, falling back to manual grant', e);
        }
      }

      // Manual grant (no Stripe subscription, or Stripe sub already canceled)
      const manualRow = (rows ?? []).find((r: any) => !r.stripe_subscription_id && r.billing_provider !== 'shopify');
      const existingEnd = manualRow?.current_period_end ? new Date(manualRow.current_period_end).getTime() : 0;
      const base = Math.max(existingEnd, now);
      const until = new Date(base + days * 86400000).toISOString();

      if (manualRow) {
        const { error } = await admin
          .from('subscriptions')
          .update({
            status: 'trialing',
            cancel_at_period_end: false,
            current_period_end: until,
            updated_at: new Date().toISOString(),
          })
          .eq('id', manualRow.id);
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await admin.from('subscriptions').insert({
          user_id: userId,
          status: 'trialing',
          price_id: 'jawabify_pro_monthly_v2',
          billing_provider: 'stripe',
          environment: 'live',
          current_period_start: new Date(now).toISOString(),
          current_period_end: until,
        });
        if (error) return json({ error: error.message }, 500);
      }
      return json({ mode: 'manual', until });
    }


    const results = await Promise.all(
      (['live', 'sandbox'] as StripeEnv[]).map(async (env) => {
        try {
          return { env, ...(await loadEnv(env, limit)) };
        } catch (e) {
          console.error(`stripe ${env} read failed`, e);
          return { env, charges: [], subscriptions: [], error: (e as Error).message };
        }
      }),
    );

    return json({
      charges: results.flatMap((r) => r.charges),
      subscriptions: results.flatMap((r) => r.subscriptions),
      errors: results.filter((r) => (r as any).error).map((r) => ({ environment: r.env, message: (r as any).error })),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
