// Connects a tenant's Instagram professional account through Facebook Login
// (Messenger Platform for Instagram). The browser sends the Facebook user
// token; we find the Page linked to the Instagram account, store a long-lived
// Page token and subscribe the Page to message webhooks.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_ID = Deno.env.get('META_APP_ID') ?? '';
const APP_SECRET = Deno.env.get('META_APP_SECRET') ?? '';
const GRAPH = 'https://graph.facebook.com/v21.0';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
const fail = (error: string, details?: unknown) => {
  console.error('instagram-connect failure:', error, JSON.stringify(details ?? {}));
  return json({ success: false, error });
};

async function graph(path: string, token: string, init?: RequestInit) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data?.error, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!APP_ID || !APP_SECRET) return fail('Meta app credentials are not configured.');

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return fail('Your session expired. Please sign in again.');

    // Resolve the workspace: super admins may act on behalf of a client.
    const acting = req.headers.get('x-acting-tenant');
    let tenantId: string | null = null;
    if (acting) {
      const [{ data: member }, { data: role }] = await Promise.all([
        admin.from('tenant_members').select('tenant_id').eq('tenant_id', acting).eq('user_id', user.id).maybeSingle(),
        admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').maybeSingle(),
      ]);
      if (!member && !role) return fail('You are not allowed to manage that workspace.');
      tenantId = acting;
    } else {
      const { data } = await admin.rpc('get_user_tenant_id', { p_user_id: user.id });
      tenantId = data as string | null;
    }
    if (!tenantId) return fail('No workspace found for this user.');

    const body = await req.json().catch(() => ({}));
    const shortToken = typeof body?.userAccessToken === 'string' ? body.userAccessToken : '';
    const pageIdChoice = typeof body?.pageId === 'string' ? body.pageId : '';
    if (!shortToken) return fail('Missing Facebook login token.');

    // Make sure the token was issued to our app.
    const debug = await graph(`/debug_token?input_token=${encodeURIComponent(shortToken)}`, `${APP_ID}|${APP_SECRET}`);
    if (!debug.ok || String(debug.data?.data?.app_id) !== APP_ID || !debug.data?.data?.is_valid) {
      return fail('Facebook login could not be verified. Please try again.', debug.data);
    }

    // Long-lived user token -> Page tokens derived from it never expire.
    let userToken = shortToken;
    const ll = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(shortToken)}`,
    ).then((r) => r.json()).catch(() => ({}));
    if (ll?.access_token) userToken = ll.access_token;

    const accounts = await graph(
      '/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100',
      userToken,
    );
    if (!accounts.ok) {
      return fail(accounts.data?.error?.message || 'Could not read your Facebook Pages.', accounts.data);
    }
    const pages = (accounts.data?.data ?? []).filter((p: any) => p?.instagram_business_account?.id);
    if (!pages.length) {
      return fail(
        'None of the Facebook Pages you shared has an Instagram professional account linked. Link Instagram to your Page (Page settings → Linked accounts) and make sure you selected that Page in the Facebook popup.',
      );
    }

    let page = pageIdChoice ? pages.find((p: any) => p.id === pageIdChoice) : pages.length === 1 ? pages[0] : null;
    if (!page) {
      return json({
        success: false,
        needsPageSelection: true,
        pages: pages.map((p: any) => ({
          pageId: p.id,
          pageName: p.name,
          igUsername: p.instagram_business_account?.username ?? null,
        })),
      });
    }

    const pageToken: string = page.access_token;
    const igAccountId = String(page.instagram_business_account.id);
    const igUsername: string | null = page.instagram_business_account.username ?? null;

    // Subscribe the Page so Instagram DMs reach our webhook.
    const sub = await graph(
      `/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks`,
      pageToken,
      { method: 'POST' },
    );
    if (!sub.ok) {
      return fail(sub.data?.error?.message || 'Could not subscribe the Page to Instagram messages.', sub.data);
    }

    // One Instagram account belongs to one workspace: retire older links.
    await admin
      .from('tenant_credentials')
      .update({ is_active: false })
      .eq('provider', 'instagram')
      .eq('ig_account_id', igAccountId)
      .neq('tenant_id', tenantId);

    const { error: upsertErr } = await admin.from('tenant_credentials').upsert(
      {
        tenant_id: tenantId,
        provider: 'instagram',
        access_token: pageToken,
        ig_account_id: igAccountId,
        ig_username: igUsername,
        page_id: page.id,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,provider' },
    );
    if (upsertErr) return fail('Could not save the Instagram connection.', upsertErr);

    return json({ success: true, username: igUsername, pageName: page.name });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error');
  }
});
