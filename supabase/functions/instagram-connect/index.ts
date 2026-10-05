// Connects a tenant's Instagram professional account. Two methods:
// 1. Instagram Business Login (default): action 'start' returns an Instagram
//    OAuth URL; action 'exchange' swaps the returned code for a long-lived
//    token and subscribes the account to message webhooks.
// 2. Facebook Login (fallback): the browser sends a Facebook user token; we
//    find the Page linked to the Instagram account, store a long-lived Page
//    token and subscribe the Page to message webhooks.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Instagram Business Login may use dedicated IG app credentials; Facebook Login
// must use the Meta/Facebook app (same as the web FB SDK app id).
const IG_APP_ID = Deno.env.get('INSTAGRAM_APP_ID') ?? Deno.env.get('META_APP_ID') ?? '';
const IG_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? Deno.env.get('META_APP_SECRET') ?? '';
const FB_APP_ID = Deno.env.get('META_APP_ID') ?? Deno.env.get('INSTAGRAM_APP_ID') ?? '';
const FB_APP_SECRET = Deno.env.get('META_APP_SECRET') ?? Deno.env.get('INSTAGRAM_APP_SECRET') ?? '';
const APP_ID = FB_APP_ID;
const APP_SECRET = FB_APP_SECRET;
const GRAPH = 'https://graph.facebook.com/v21.0';
const INSTAGRAM_GRAPH_VERSION = 'v25.0';

const IG_SCOPES = ['instagram_business_basic', 'instagram_business_manage_messages'].join(',');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
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

async function resolveTenant(req: Request, userId: string): Promise<string | null> {
  const acting = req.headers.get('x-acting-tenant');
  if (acting) {
    const [{ data: member }, { data: role }] = await Promise.all([
      admin.from('tenant_members').select('tenant_id').eq('tenant_id', acting).eq('user_id', userId).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).eq('role', 'super_admin').maybeSingle(),
    ]);
    if (!member && !role) return null;
    return acting;
  }
  const { data } = await admin.rpc('get_user_tenant_id', { p_user_id: userId });
  return (data as string | null) ?? null;
}

async function saveConnection(tenantId: string, accessToken: string, igAccountId: string, igUsername: string | null, pageId: string | null) {
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
      access_token: accessToken,
      ig_account_id: igAccountId,
      ig_username: igUsername,
      page_id: pageId,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,provider' },
  );
  return upsertErr;
}

// ---- Instagram Business Login (OAuth via instagram.com) ----
async function handleInstagramOAuth(tenantId: string, body: any) {
  const action = body?.action === 'exchange' ? 'exchange' : 'start';
  const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : '';

  if (action === 'start') {
    if (!redirectTo) return fail('redirectTo is required');
    const state = crypto.randomUUID();
    const authUrl =
      `https://www.instagram.com/oauth/authorize?client_id=${IG_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectTo)}` +
      `&state=${state}&response_type=code&scope=${encodeURIComponent(IG_SCOPES)}`;
    return json({ authUrl, state });
  }

  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code || !redirectTo) return fail('code and redirectTo are required');

  const tokenForm = new FormData();
  tokenForm.set('client_id', IG_APP_ID);
  tokenForm.set('client_secret', IG_APP_SECRET);
  tokenForm.set('grant_type', 'authorization_code');
  tokenForm.set('redirect_uri', redirectTo);
  tokenForm.set('code', code.replace(/#_$/, ''));
  const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: tokenForm,
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  const tokenData = Array.isArray(tokenJson?.data) ? tokenJson.data[0] : tokenJson;
  if (!tokenRes.ok || !tokenData?.access_token || !tokenData?.user_id) {
    console.error('Instagram token exchange failed', tokenJson);
    return fail(tokenJson?.error_message || tokenJson?.error?.message || 'Token exchange failed', tokenJson);
  }

  const longTokenUrl = new URL('https://graph.instagram.com/access_token');
  longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longTokenUrl.searchParams.set('client_secret', IG_APP_SECRET);
  longTokenUrl.searchParams.set('access_token', tokenData.access_token);
  const longTokenRes = await fetch(longTokenUrl);
  const longTokenJson = await longTokenRes.json().catch(() => ({}));
  const accessToken = longTokenRes.ok && longTokenJson?.access_token
    ? longTokenJson.access_token
    : tokenData.access_token;

  // Instagram Login API: try a few known-good shapes, since the accepted
  // field set differs between API versions.
  const attempts = [
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me?fields=user_id,username`,
    `https://graph.instagram.com/me?fields=user_id,username`,
    `https://graph.instagram.com/me?fields=id,username`,
  ];
  let profile: any = null;
  let lastProfileError: any = null;
  for (const url of attempts) {
    const res = await fetch(`${url}&access_token=${encodeURIComponent(accessToken)}`);
    const resBody = await res.json().catch(() => ({}));
    const candidate = Array.isArray(resBody?.data) ? resBody.data[0] : resBody;
    if (res.ok && (candidate?.user_id || candidate?.id)) {
      profile = candidate;
      break;
    }
    lastProfileError = resBody;
    console.error('Instagram profile lookup attempt failed', url, resBody);
  }
  if (!profile) {
    return fail(
      lastProfileError?.error?.message || 'Could not verify the connected Instagram professional account',
      lastProfileError,
    );
  }

  const igAccountId = String(profile.user_id ?? profile.id);
  const igUsername: string | null = profile?.username ?? null;

  // Subscribe this professional account so DMs reach our webhook.
  const subscribeRes = await fetch(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${igAccountId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(accessToken)}`,
    { method: 'POST' },
  );
  if (!subscribeRes.ok) {
    const subscribeError = await subscribeRes.json().catch(() => ({}));
    console.error('Instagram webhook subscription failed', subscribeError);
    return fail(subscribeError?.error?.message || 'Could not subscribe the Instagram account to messages', subscribeError);
  }

  const upsertErr = await saveConnection(tenantId, accessToken, igAccountId, igUsername, null);
  if (upsertErr) return fail('Could not save the Instagram connection.', upsertErr);

  return json({ success: true, ok: true, username: igUsername });
}

/** Exchange a Facebook OAuth authorization code (mobile AuthSession) for a user token. */
async function exchangeFacebookCode(code: string, redirectTo: string): Promise<string | null> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set('client_id', FB_APP_ID);
  url.searchParams.set('client_secret', FB_APP_SECRET);
  url.searchParams.set('redirect_uri', redirectTo);
  url.searchParams.set('code', code);
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.access_token) {
    console.error('Facebook code exchange failed', json);
    return null;
  }
  return String(json.access_token);
}

// ---- Facebook Login (Messenger Platform for Instagram) ----
async function handleFacebookLogin(tenantId: string, body: any) {
  // Mobile: Facebook redirects with ?code= → we swap it for a user token here.
  if (body?.action === 'facebook_oauth_exchange') {
    const code = typeof body?.code === 'string' ? body.code : '';
    const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : '';
    if (!code || !redirectTo) return fail('code and redirectTo are required');
    const token = await exchangeFacebookCode(code, redirectTo);
    if (!token) {
      return fail(
        'Facebook login could not be completed. In Meta → Facebook Login → Settings, add this Exact Redirect URI: ' +
          redirectTo,
      );
    }
    return await handleFacebookLogin(tenantId, { userAccessToken: token, pageId: body?.pageId });
  }

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
      // Client needs this to finish after the user picks a Page (mobile code flow).
      userAccessToken: userToken,
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

  const upsertErr = await saveConnection(tenantId, pageToken, igAccountId, igUsername, page.id);
  if (upsertErr) return fail('Could not save the Instagram connection.', upsertErr);

  return json({ success: true, username: igUsername, pageName: page.name });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!APP_ID || !APP_SECRET) return fail('Meta app credentials are not configured.');

    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(jwt);
    if (!user) return fail('Your session expired. Please sign in again.');

    const tenantId = await resolveTenant(req, user.id);
    if (!tenantId) return fail('No workspace found for this user.');

    const body = await req.json().catch(() => ({}));

    if (body?.action === 'start' || body?.action === 'exchange') {
      if (!IG_APP_ID || !IG_APP_SECRET) return fail('Instagram app credentials are not configured.');
      return await handleInstagramOAuth(tenantId, body);
    }
    return await handleFacebookLogin(tenantId, body);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Unexpected error');
  }
});
