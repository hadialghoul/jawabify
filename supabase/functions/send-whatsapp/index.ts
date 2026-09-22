import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantId } from "../_shared/tenant.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Detect the real audio container from magic bytes (browsers mislabel recordings). */
function sniffAudio(bytes: Uint8Array, fallback: string) {
  const ascii = (i: number, n: number) =>
    String.fromCharCode(...bytes.slice(i, i + n));
  if (ascii(0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  if (ascii(4, 4) === 'ftyp') {
    // Meta's transcoder needs a plain (non-fragmented) MP4: it must carry a
    // `moov` box. Safari's MediaRecorder emits fragmented MP4 (moof/mdat only),
    // which Meta reports back as application/octet-stream (error 131053).
    const head = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 262144)));
    const moov = head.indexOf('moov');
    const moof = head.indexOf('moof');
    if (moov === -1 || (moof !== -1 && moof < moov)) {
      return { mime: 'audio/fragmented-mp4', ext: 'm4a' };
    }
    return { mime: 'audio/mp4', ext: 'm4a' };
  }
  if (ascii(0, 3) === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    // WebM/Matroska — not accepted by WhatsApp as audio.
    return { mime: 'audio/webm', ext: 'webm' };
  }
  if (ascii(0, 4) === '#!AM') return { mime: 'audio/amr', ext: 'amr' };
  return { mime: fallback || 'audio/ogg', ext: 'bin' };
}


async function uploadAudioToMeta(
  mediaUrl: string,
  declaredType: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<{ id?: string; error?: string }> {
  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) return { error: `download failed (${res.status})` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { mime, ext } = sniffAudio(bytes, declaredType);
    if (mime === 'audio/webm' || mime === 'audio/fragmented-mp4') {
      return { error: `${mime} not accepted by WhatsApp as audio` };
    }


    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([bytes], { type: mime }), `voice.${ext}`);

    const up = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    const json = await up.json().catch(() => ({}));
    if (!up.ok || !json?.id) return { error: JSON.stringify(json) };
    console.log(`Uploaded audio to Meta as ${mime}, id=${json.id}`);
    return { id: json.id as string };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, mediaUrl, mediaType, fileName, tenant_id: requestedTenantId } = await req.json();

    if (!to || (!message && !mediaUrl)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to and (message or mediaUrl)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user's tenant credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Extract user from auth header
    const authHeader = req.headers.get('Authorization');
    let phoneNumberId: string | null = null;
    let accessToken: string | null = null;

    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user } } = await anonClient.auth.getUser();

      if (user) {
        // Look up tenant credentials
        const tenantId = await resolveTenantId(supabase, user.id, requestedTenantId ?? req.headers.get('x-acting-tenant'));

        if (tenantId) {
          const { data: cred } = await supabase
            .from('tenant_credentials')
            .select('phone_number_id, access_token')
            .eq('tenant_id', tenantId)
            .eq('provider', 'whatsapp_cloud')
            .eq('is_active', true)
            .maybeSingle();

          if (cred) {
            // Use DB values if they're real, otherwise fall back to env vars
            phoneNumberId = (cred.phone_number_id && cred.phone_number_id !== 'FROM_ENV')
              ? cred.phone_number_id
              : Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || null;
            accessToken = (cred.access_token && cred.access_token !== 'FROM_ENV')
              ? cred.access_token
              : Deno.env.get('WHATSAPP_ACCESS_TOKEN') || null;
          }
        }
      }
    }

    // Only fall back to env vars for the admin tenant (not for user-initiated requests with auth)
    if (!phoneNumberId && !authHeader) {
      phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || null;
    }
    if (!accessToken && !authHeader) {
      accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || null;
    }

    if (!phoneNumberId || !accessToken) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanedPhone = to.replace('whatsapp:', '').replace(/\D/g, '');
    console.log(`Sending WhatsApp message to ${cleanedPhone}, hasMedia: ${!!mediaUrl}`);

    let body: Record<string, unknown>;

    // WhatsApp only accepts these audio containers; anything else goes as a document.
    const WA_AUDIO = ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'];
    const type: string = typeof mediaType === 'string' ? mediaType.split(';')[0] : '';
    const derivedName = fileName || (mediaUrl ? decodeURIComponent(String(mediaUrl).split('/').pop() || 'file') : 'file');

    if (mediaUrl && type.startsWith('image/')) {
      body = {
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'image',
        image: { link: mediaUrl, ...(message ? { caption: message } : {}) },
      };
    } else if (mediaUrl && (WA_AUDIO.includes(type) || type.startsWith('audio/'))) {
      // Meta rejects audio fetched by link when the served Content-Type doesn't
      // match the real container (error 131053). Download, sniff the container
      // from magic bytes, and upload the bytes to Meta directly instead.
      const uploaded = await uploadAudioToMeta(mediaUrl, type, phoneNumberId, accessToken);
      if (uploaded.id) {
        body = {
          messaging_product: 'whatsapp',
          to: cleanedPhone,
          type: 'audio',
          audio: { id: uploaded.id },
        };
      } else {
        console.warn('Audio upload to Meta failed, sending as document:', uploaded.error);
        body = {
          messaging_product: 'whatsapp',
          to: cleanedPhone,
          type: 'document',
          document: { link: mediaUrl, filename: derivedName, ...(message ? { caption: message } : {}) },
        };
      }
    } else if (mediaUrl && type.startsWith('video/')) {
      body = {
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'video',
        video: { link: mediaUrl, ...(message ? { caption: message } : {}) },
      };
    } else if (mediaUrl) {
      body = {
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'document',
        document: {
          link: mediaUrl,
          filename: derivedName,
          ...(message ? { caption: message } : {}),
        },
      };
    } else {
      body = {
        messaging_product: 'whatsapp',
        to: cleanedPhone,
        type: 'text',
        text: { body: message },
      };
    }


    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', result);
      return new Response(
        JSON.stringify({ error: result.error?.message || 'Failed to send message' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messageId = result.messages?.[0]?.id;
    console.log('Message sent successfully:', messageId);

    return new Response(
      JSON.stringify({ success: true, messageSid: messageId, status: 'sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
