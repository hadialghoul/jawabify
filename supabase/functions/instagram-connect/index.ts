// Instagram Business Login OAuth flow for a tenant's professional account.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const APP_ID = Deno.env.get('INSTAGRAM_APP_ID') ?? Deno.env.get('META_APP_ID') ?? '';
const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? Deno.env.get('META_APP_SECRET') ?? '';
const INSTAGRAM_GRAPH_VERSION = 'v25.0';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
].join(',');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!APP_ID || !APP_SECRET) {
      return json({ error: 'Meta app credentials are not configured' }, 400);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return json({ error: 'Unauthorized' }, 401);

    const { data: tenantId } = await admin.rpc('get_user_tenant_id', { p_user_id: auth.user.id });
    if (!tenantId) return json({ error: 'No tenant for this user' }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'exchange' ? 'exchange' : 'start';
    const redirectTo = typeof body?.redirectTo === 'string' ? body.redirectTo : '';

    if (action === 'start') {
      if (!redirectTo) return json({ error: 'redirectTo is required' }, 400);
      const state = crypto.randomUUID();
      const authUrl =
        `https://www.instagram.com/oauth/authorize?client_id=${APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectTo)}` +
        `&state=${state}&response_type=code&scope=${encodeURIComponent(SCOPES)}`;
      return json({ authUrl, state });
    }

    // action === 'exchange'
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code || !redirectTo) return json({ error: 'code and redirectTo are required' }, 400);

    const tokenForm = new FormData();
    tokenForm.set('client_id', APP_ID);
    tokenForm.set('client_secret', APP_SECRET);
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
      return json({ error: tokenJson?.error_message || tokenJson?.error?.message || 'Token exchange failed' }, 400);
    }

    const longTokenUrl = new URL('https://graph.instagram.com/access_token');
    longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longTokenUrl.searchParams.set('client_secret', APP_SECRET);
    longTokenUrl.searchParams.set('access_token', tokenData.access_token);
    const longTokenRes = await fetch(longTokenUrl);
    const longTokenJson = await longTokenRes.json().catch(() => ({}));
    const accessToken = longTokenRes.ok && longTokenJson?.access_token
      ? longTokenJson.access_token
      : tokenData.access_token;

    // Instagram Login API requires a versioned graph.instagram.com endpoint.
    const profileRes = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/me?fields=user_id,username,account_type&access_token=${encodeURIComponent(accessToken)}`,
    );
    const profileJson = await profileRes.json().catch(() => ({}));
    const profile = Array.isArray(profileJson?.data) ? profileJson.data[0] : profileJson;
    if (!profileRes.ok || !profile?.user_id) {
      console.error('Instagram profile lookup failed', profileJson);
      return json({
        error: profileJson?.error?.message || 'Could not verify the connected Instagram professional account',
      }, 400);
    }

    const igAccountId = String(profile.user_id);

    // Subscribe this professional account so DMs reach our webhook.
    const subscribeRes = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${igAccountId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${encodeURIComponent(accessToken)}`,
      { method: 'POST' },
    );

    if (!subscribeRes.ok) {
      const subscribeError = await subscribeRes.json().catch(() => ({}));
      console.error('Instagram webhook subscription failed', subscribeError);
      return json({ error: subscribeError?.error?.message || 'Could not subscribe the Instagram account to messages' }, 400);
    }

    const { error: upsertErr } = await admin
      .from('tenant_credentials')
      .upsert(
        {
          tenant_id: tenantId,
          provider: 'instagram',
          access_token: accessToken,
          ig_account_id: igAccountId,
          ig_username: profile?.username ?? null,
          page_id: null,
          is_active: true,
        },
        { onConflict: 'tenant_id,provider' },
      );
    if (upsertErr) {
      console.error('Failed to save Instagram credentials', upsertErr);
      return json({ error: 'Could not save the connection' }, 500);
    }

    return json({ ok: true, username: profile?.username ?? null });
  } catch (err) {
    console.error('instagram-connect error', err);
    return json({ error: 'Unexpected error' }, 500);
  }
});
