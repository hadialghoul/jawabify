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
    console.warn('super-admin-alerts unauthorized', { reason: 'missing_bearer_token', hasAuthorizationHeader: Boolean(authHeader) });
    return null;
  }

  const userId = decodeJwtPayload(token)?.sub;
  if (!userId) {
    console.warn('super-admin-alerts unauthorized', { reason: 'missing_user_id_claim', hasAuthorizationHeader: Boolean(authHeader) });
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
    console.warn('super-admin-alerts unauthorized', {
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

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stuckSince = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [
      { data: tenants },
      { data: aiIncidents },
      { data: shopifyFails },
      { data: campaignFails },
      { data: emailFails },
      { data: suppressed },
      { data: stuckSessions },
      { count: shopifyFailCount },
      { count: campaignFailCount },
      { count: incidentCount },
    ] = await Promise.all([
      admin.from('tenants').select('id, name'),
      admin.from('ai_incidents').select('id, tenant_id, contact_id, incident_type, reason, user_message, ai_reply, model, created_at, resolved').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
      admin.from('orders').select('id, tenant_id, order_number, customer_name, shopify_sync_status, shopify_sync_error, shopify_sync_attempts, shopify_last_attempt_at, created_at').eq('shopify_sync_status', 'failed').order('shopify_last_attempt_at', { ascending: false, nullsFirst: false }).limit(100),
      admin.from('campaign_recipients').select('id, campaign_id, phone_number, status, error, error_code, attempts, last_error_at').eq('status', 'failed').order('last_error_at', { ascending: false, nullsFirst: false }).limit(100),
      admin.from('email_send_log').select('id, template_name, recipient_email, status, error_message, created_at').eq('status', 'failed').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      admin.from('suppressed_emails').select('id, email, reason, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      admin.from('order_sessions').select('id, tenant_id, contact_id, state, flow_kind, expires_at, updated_at').not('state', 'in', '(completed,cancelled,expired)').lt('expires_at', stuckSince).order('updated_at', { ascending: false }).limit(100),
      admin.from('orders').select('id', { count: 'exact', head: true }).eq('shopify_sync_status', 'failed'),
      admin.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      admin.from('ai_incidents').select('id', { count: 'exact', head: true }).eq('resolved', false).gte('created_at', since),
    ]);

    const tenantMap: Record<string, string> = {};
    (tenants ?? []).forEach((t) => { tenantMap[t.id] = t.name; });

    return json({
        counts: {
          aiIncidents: incidentCount ?? 0,
          shopifyFails: shopifyFailCount ?? 0,
          campaignFails: campaignFailCount ?? 0,
          emailFails: (emailFails ?? []).length,
          suppressed: (suppressed ?? []).length,
          stuckSessions: (stuckSessions ?? []).length,
        },
        aiIncidents: aiIncidents ?? [],
        shopifyFails: shopifyFails ?? [],
        campaignFails: campaignFails ?? [],
        emailFails: emailFails ?? [],
        suppressed: suppressed ?? [],
        stuckSessions: stuckSessions ?? [],
        tenantMap,
      });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
