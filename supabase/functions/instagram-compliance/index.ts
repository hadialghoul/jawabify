// Meta compliance endpoints for the Instagram integration.
//   POST .../instagram-compliance/deauthorize      -> Deauthorize callback URL
//   POST .../instagram-compliance/data-deletion    -> Data deletion request URL
// Meta posts `signed_request` (base64url payload signed with the app secret).
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? Deno.env.get('META_APP_SECRET') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const b64urlToBytes = (input: string) => {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

async function parseSignedRequest(signed: string) {
  const [sig, payload] = signed.split('.');
  if (!sig || !payload || !APP_SECRET) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  );
  const provided = b64urlToBytes(sig);
  if (expected.length !== provided.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ provided[i];
  if (diff !== 0) return null;
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
}

async function readSignedRequest(req: Request): Promise<string> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return typeof body?.signed_request === 'string' ? body.signed_request : '';
  }
  const form = await req.formData().catch(() => null);
  return (form?.get('signed_request') as string) ?? '';
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const mode = url.pathname.includes('data-deletion') ? 'data-deletion' : 'deauthorize';

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: true, endpoint: mode }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const signed = await readSignedRequest(req);
  const payload = signed ? await parseSignedRequest(signed) : null;
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid signed_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const igUserId = String(payload.user_id ?? '');
  console.log(`[instagram-compliance] ${mode} for instagram user ${igUserId}`);

  if (igUserId) {
    // Deactivate any Instagram credential tied to this Instagram account.
    await admin
      .from('tenant_credentials')
      .update({ is_active: false })
      .eq('provider', 'instagram')
      .eq('external_id', igUserId);

    if (mode === 'data-deletion') {
      // Remove stored Instagram conversation data for that account.
      const { data: contacts } = await admin
        .from('contacts')
        .select('id')
        .eq('platform', 'instagram')
        .eq('external_id', igUserId);
      const ids = (contacts ?? []).map((c: { id: string }) => c.id);
      if (ids.length) {
        await admin.from('messages').delete().in('contact_id', ids);
        await admin.from('contacts').delete().in('id', ids);
      }
    }
  }

  const confirmationCode = crypto.randomUUID().replace(/-/g, '');
  return new Response(
    JSON.stringify({
      url: `https://jawabify.com/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
