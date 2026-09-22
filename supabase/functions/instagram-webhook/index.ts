// Instagram Direct webhook: verification handshake + incoming DM fan-out.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { replyToInstagramMessage } from '../_shared/instagram-ai.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_VERIFY_TOKEN') ?? '';
const INSTAGRAM_GRAPH_VERSION = 'v25.0';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function igProfile(igsid: string, token: string) {
  try {
    const res = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${igsid}?fields=name,username&access_token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as { name?: string; username?: string };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);

  // Meta verification handshake
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await req.json();

    for (const entry of body?.entry ?? []) {
      // The IG business account receiving the message.
      const recipientId: string | undefined =
        entry?.messaging?.[0]?.recipient?.id ?? entry?.id;

      // A single IG account may briefly exist on more than one tenant row
      // (e.g. after reconnecting under a different account). Prefer the active,
      // most recently updated credential instead of failing on duplicates.
      const { data: creds } = await admin
        .from('tenant_credentials')
        .select('tenant_id, access_token, ig_account_id, page_id, is_active, updated_at')
        .eq('provider', 'instagram')
        .or(`ig_account_id.eq.${recipientId},page_id.eq.${recipientId}`)
        .order('is_active', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(1);
      const cred = creds?.[0];

      if (!cred?.tenant_id) {
        console.warn('No tenant matched Instagram account', recipientId);
        continue;
      }

      for (const event of entry?.messaging ?? []) {
        if (event?.message?.is_echo) continue;
        const igsid: string | undefined = event?.sender?.id;
        if (!igsid || igsid === recipientId) continue;

        const text: string = event?.message?.text ?? '';
        const attachment = event?.message?.attachments?.[0];
        const mediaUrl: string | null = attachment?.payload?.url ?? null;
        const mediaType: string | null = attachment?.type ?? null;
        if (!text && !mediaUrl) continue;

        // Find or create the contact for this IG user.
        let { data: contact } = await admin
          .from('contacts')
          .select('id, name, handle')
          .eq('tenant_id', cred.tenant_id)
          .eq('platform', 'instagram')
          .eq('external_id', igsid)
          .maybeSingle();

        if (!contact) {
          const profile = cred.access_token ? await igProfile(igsid, cred.access_token) : null;
          const { data: created, error: createErr } = await admin
            .from('contacts')
            .insert({
              tenant_id: cred.tenant_id,
              platform: 'instagram',
              external_id: igsid,
              handle: profile?.username ?? null,
              // Prefer the @username over the display name so the inbox never
              // falls back to an opaque numeric id.
              name: profile?.username ?? profile?.name ?? null,
              phone_number: `ig:${igsid}`,
            })
            .select('id, name, handle')
            .single();
          if (createErr) {
            console.error('Failed to create IG contact', createErr);
            continue;
          }
          contact = created;
        } else if ((!contact.handle || !contact.name) && cred.access_token) {
          // Backfill the username for contacts created before the profile
          // lookup succeeded, so the inbox stops showing "ig:<id>".
          const profile = await igProfile(igsid, cred.access_token);
          const handle = profile?.username ?? contact.handle ?? null;
          const name = contact.name ?? profile?.username ?? profile?.name ?? null;
          if (handle || name) {
            await admin.from('contacts').update({ handle, name }).eq('id', contact.id);
          }
        }

        const { error: msgErr } = await admin.from('messages').insert({
          contact_id: contact.id,
          content: text || (mediaType === 'image' ? '📷 Photo' : '📎 Attachment'),
          direction: 'incoming',
          status: 'delivered',
          platform: 'instagram',
          media_url: mediaUrl,
          media_type: mediaType,
        });
        if (msgErr) console.error('Failed to store IG message', msgErr);

        // AI auto-reply (respects tenant + per-chat AI switches).
        if (text && cred.access_token) {
          try {
            await replyToInstagramMessage({
              admin,
              tenantId: cred.tenant_id,
              contactId: contact.id,
              igsid,
              senderId: cred.ig_account_id || cred.page_id || recipientId!,
              accessToken: cred.access_token,
              userMessage: text,
            });
          } catch (aiErr) {
            console.error('IG AI reply failed', aiErr);
          }
        }

      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('instagram-webhook error', err);
    // Always 200 so Meta does not disable the subscription.
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
