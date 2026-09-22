// Sends an Instagram Direct reply on behalf of the tenant.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const INSTAGRAM_GRAPH_VERSION = 'v25.0';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const contactId = typeof body?.contactId === 'string' ? body.contactId : '';
    const message = typeof body?.message === 'string' ? body.message : '';
    const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl : null;
    if (!contactId || (!message && !mediaUrl)) {
      return json({ error: 'contactId and message (or mediaUrl) are required' }, 400);
    }

    // Contact must belong to a tenant the caller can read (RLS-checked).
    const { data: contact, error: contactErr } = await userClient
      .from('contacts')
      .select('id, tenant_id, external_id, platform')
      .eq('id', contactId)
      .maybeSingle();
    if (contactErr || !contact) return json({ error: 'Contact not found' }, 404);
    if (contact.platform !== 'instagram' || !contact.external_id) {
      return json({ error: 'Contact is not an Instagram conversation' }, 400);
    }

    const { data: cred } = await admin
      .from('tenant_credentials')
      .select('access_token, ig_account_id, page_id, is_active')
      .eq('tenant_id', contact.tenant_id)
      .eq('provider', 'instagram')
      .maybeSingle();

    if (!cred?.access_token || cred.is_active === false) {
      return json({ error: 'Instagram is not connected for this account' }, 400);
    }

    const senderId = cred.ig_account_id || cred.page_id;
    const mediaType = typeof body?.mediaType === 'string' ? body.mediaType.split(';')[0] : '';
    const attachmentType = mediaType.startsWith('image/')
      ? 'image'
      : mediaType.startsWith('audio/')
        ? 'audio'
        : mediaType.startsWith('video/')
          ? 'video'
          : 'file';
    const payload = mediaUrl
      ? { recipient: { id: contact.external_id }, message: { attachment: { type: attachmentType, payload: { url: mediaUrl } } } }
      : { recipient: { id: contact.external_id }, message: { text: message } };


    const res = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${senderId}/messages?access_token=${encodeURIComponent(cred.access_token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Instagram send failed', result);
      return json({ error: result?.error?.message || 'Instagram rejected the message' }, 400);
    }

    return json({ ok: true, messageSid: result?.message_id ?? null });
  } catch (err) {
    console.error('send-instagram error', err);
    return json({ error: 'Unexpected error' }, 500);
  }
});
