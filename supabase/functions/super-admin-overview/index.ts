import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const responseHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

const getSuperAdminUserIdFromRequest = async (req: Request, url: string, anonKey: string): Promise<string | null> => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';

  if (!token) {
    console.warn('super-admin-overview unauthorized', { reason: 'missing_bearer_token', hasAuthorizationHeader: Boolean(authHeader) });
    return null;
  }

  const userId = decodeJwtPayload(token)?.sub;
  if (!userId) {
    console.warn('super-admin-overview unauthorized', { reason: 'missing_user_id_claim', hasAuthorizationHeader: Boolean(authHeader) });
    return null;
  }

  const verifier = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await verifier
    .from('user_roles')
    .select('user_id, role')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .limit(1)
    .maybeSingle();

  if (error || !data?.user_id) {
    console.warn('super-admin-overview unauthorized', {
      reason: error?.message ?? 'missing_super_admin_role',
      hasAuthorizationHeader: Boolean(authHeader),
    });
    return null;
  }

  return userId;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: responseHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userId = await getSuperAdminUserIdFromRequest(req, url, anonKey);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(url, serviceKey);

    const { data: tenants } = await admin.from('tenants').select('id, name, owner_user_id, created_at').order('created_at', { ascending: false });
    const { data: members } = await admin.from('tenant_members').select('tenant_id, user_id, role, created_at');
    const { data: profiles } = await admin.from('profiles').select('user_id, display_name, business_name, business_type, country, city, address, contact_phone, website, expected_volume, referral_source, onboarding_completed, created_at');
    const { data: creds } = await admin.from('tenant_credentials').select('tenant_id, provider, phone_number, shop_domain, is_active');
    const { data: subscriptions } = await admin.from('subscriptions').select('*').order('created_at', { ascending: false });

    const userIds = new Set<string>();
    tenants?.forEach((t) => userIds.add(t.owner_user_id));
    members?.forEach((m) => userIds.add(m.user_id));

    const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, { email: string | null; last_sign_in_at: string | null; created_at: string }> = {};
    authList?.users?.forEach((u) => {
      emailMap[u.id] = { email: u.email ?? null, last_sign_in_at: u.last_sign_in_at ?? null, created_at: u.created_at };
    });

    const tenantIds = (tenants ?? []).map((t) => t.id);
    const counts: Record<string, { contacts: number; messages: number }> = {};
    for (const tid of tenantIds) {
      const { count: contactsCount } = await admin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tid);
      const { data: tenantContacts } = await admin.from('contacts').select('id').eq('tenant_id', tid);
      const cIds = (tenantContacts ?? []).map((c) => c.id);
      let messagesCount = 0;
      const BATCH = 100;
      for (let i = 0; i < cIds.length; i += BATCH) {
        const slice = cIds.slice(i, i + BATCH);
        const { count } = await admin.from('messages').select('id', { count: 'exact', head: true }).in('contact_id', slice);
        messagesCount += count ?? 0;
      }
      counts[tid] = { contacts: contactsCount ?? 0, messages: messagesCount };
    }

    // Time series - last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: recentMessages }, { data: recentContacts }] = await Promise.all([
      admin.from('messages').select('created_at, direction').gte('created_at', since),
      admin.from('contacts').select('created_at').gte('created_at', since),
    ]);

    const recentSignups = (authList?.users ?? [])
      .filter((u) => new Date(u.created_at) >= new Date(since))
      .map((u) => ({ created_at: u.created_at }));

    const timeseries = {
      messages: recentMessages ?? [],
      contacts: recentContacts ?? [],
      signups: recentSignups,
    };

    return json({ tenants, members, profiles, creds, emailMap, counts, subscriptions, timeseries, totalAuthUsers: authList?.users?.length ?? 0 });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
