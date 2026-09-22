import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Hard ceilings for safety
const MAX_BATCH_PER_CAMPAIGN = 600;     // claim at most this many rows per cycle
const MAX_TIME_MS = 50_000;             // stop a cycle before edge function timeout
const STALE_LOCK_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const workerId = crypto.randomUUID();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Promote scheduled campaigns whose start time has arrived.
    await supabase
      .from('campaigns')
      .update({ status: 'sending', started_at: new Date().toISOString() })
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    // 2. Release stale locks across the whole table.
    await supabase.rpc('release_stale_campaign_locks', { p_max_minutes: STALE_LOCK_MINUTES });

    // 3. Find active campaigns.
    const { data: active } = await supabase
      .from('campaigns')
      .select('id, tenant_id, template_name, template_language, template_body, variables, send_rate_per_minute, concurrency, append_opt_out, opt_out_variable_index, variable_fallbacks')
      .eq('status', 'sending')
      .limit(50);

    const results: Record<string, { sent: number; failed: number }> = {};
    for (const camp of active || []) {
      if (Date.now() - startedAt > MAX_TIME_MS) break;
      const r = await processCampaign(supabase, camp, workerId, startedAt);
      results[camp.id] = r;
    }

    return new Response(JSON.stringify({ ok: true, workerId, processed: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('campaign-worker error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processCampaign(supabase: any, camp: any, workerId: string, startedAt: number) {
  let sent = 0, failed = 0;

  // Resolve tenant credentials.
  const { data: cred } = await supabase
    .from('tenant_credentials')
    .select('phone_number_id, access_token')
    .eq('tenant_id', camp.tenant_id)
    .eq('provider', 'whatsapp_cloud')
    .eq('is_active', true)
    .maybeSingle();
  if (!cred) {
    await supabase.from('campaigns').update({
      status: 'paused', auto_paused: true, paused_reason: 'WhatsApp credentials missing',
    }).eq('id', camp.id);
    return { sent, failed };
  }
  const phoneNumberId = cred.phone_number_id && cred.phone_number_id !== 'FROM_ENV'
    ? cred.phone_number_id : Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = cred.access_token && cred.access_token !== 'FROM_ENV'
    ? cred.access_token : Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!phoneNumberId || !accessToken) {
    await supabase.from('campaigns').update({
      status: 'paused', auto_paused: true, paused_reason: 'WhatsApp credentials missing',
    }).eq('id', camp.id);
    return { sent, failed };
  }

  const vars: string[] = Array.isArray(camp.variables) ? camp.variables.map(String) : [];
  // Inject opt-out disclaimer into the chosen template variable slot.
  const OPT_OUT_TEXT = 'Reply STOP to unsubscribe.';
  if (camp.append_opt_out && Number.isInteger(camp.opt_out_variable_index) && camp.opt_out_variable_index >= 1) {
    const i = camp.opt_out_variable_index - 1;
    while (vars.length <= i) vars.push('');
    vars[i] = OPT_OUT_TEXT;
  }
  const fallbacks: string[] = Array.isArray(camp.variable_fallbacks) ? camp.variable_fallbacks.map(String) : [];
  const usesPersonalization = vars.some((v) => /\{\s*(name|first_name|phone)\s*\}/i.test(v));

  const concurrency = Math.max(1, Math.min(20, camp.concurrency || 5));
  const rate = Math.max(10, Math.min(600, camp.send_rate_per_minute || 60));
  const minIntervalMs = Math.ceil(60_000 / rate);

  const batchSize = Math.min(MAX_BATCH_PER_CAMPAIGN, Math.ceil(rate * 0.9));

  // Claim a batch.
  const { data: claimed, error: claimErr } = await supabase.rpc('claim_campaign_recipients', {
    p_campaign_id: camp.id, p_limit: batchSize, p_worker: workerId,
  });
  if (claimErr) {
    console.error('claim failed:', claimErr);
    return { sent, failed };
  }
  const rows: any[] = claimed || [];

  if (rows.length === 0) {
    // Nothing pending — check if everything is processed and finalize.
    const { count: pendingCount } = await supabase
      .from('campaign_recipients')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', camp.id)
      .eq('status', 'pending');
    if ((pendingCount ?? 0) === 0) {
      const { data: counts } = await supabase
        .from('campaign_recipients')
        .select('status')
        .eq('campaign_id', camp.id);
      const totalSent = (counts || []).filter((c: any) => c.status === 'sent').length;
      const totalFailed = (counts || []).filter((c: any) => c.status === 'failed').length;
      await supabase.from('campaigns').update({
        sent_count: totalSent,
        failed_count: totalFailed,
        status: totalFailed > 0 && totalSent === 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', camp.id);
    }
    return { sent, failed };
  }

  // Resolve contact names for personalization tokens.
  const contactNames: Record<string, string> = {};
  if (usesPersonalization) {
    const ids = rows.map((r) => r.contact_id).filter(Boolean);
    for (let i = 0; i < ids.length; i += 200) {
      const { data: cs } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', ids.slice(i, i + 200));
      for (const c of cs || []) if (c.name) contactNames[c.id] = String(c.name);
    }
  }

  // Token-bucket: process in parallel waves of `concurrency`, throttled by minIntervalMs/concurrency.
  const waveDelay = Math.max(0, minIntervalMs * concurrency - 50);
  let recentFailed = 0;
  let recentTotal = 0;

  for (let i = 0; i < rows.length; i += concurrency) {
    if (Date.now() - startedAt > MAX_TIME_MS) break;
    const slice = rows.slice(i, i + concurrency);
    const waveStart = Date.now();

    const outcomes = await Promise.allSettled(slice.map((r) =>
      sendOne(supabase, camp, r, phoneNumberId!, accessToken!, vars, fallbacks, usesPersonalization ? contactNames : null)
    ));

    for (const o of outcomes) {
      recentTotal++;
      if (o.status === 'fulfilled' && o.value.ok) sent++;
      else { failed++; recentFailed++; }
    }

    // Auto-pause if rolling failure rate is too high.
    if (recentTotal >= 20 && recentFailed / recentTotal > 0.25) {
      await supabase.from('campaigns').update({
        status: 'paused',
        auto_paused: true,
        paused_reason: `Auto-paused: ${Math.round((recentFailed / recentTotal) * 100)}% of recent sends failed`,
      }).eq('id', camp.id);
      break;
    }

    const elapsed = Date.now() - waveStart;
    if (elapsed < waveDelay) await new Promise((r) => setTimeout(r, waveDelay - elapsed));
  }

  // Update aggregate counts.
  const { data: counts2 } = await supabase
    .from('campaign_recipients')
    .select('status')
    .eq('campaign_id', camp.id);
  const totalSent = (counts2 || []).filter((c: any) => c.status === 'sent').length;
  const totalFailed = (counts2 || []).filter((c: any) => c.status === 'failed').length;
  await supabase.from('campaigns').update({
    sent_count: totalSent, failed_count: totalFailed,
  }).eq('id', camp.id);

  return { sent, failed };
}

function resolveVars(
  vars: string[], fallbacks: string[], r: any, contactNames: Record<string, string> | null,
): string[] {
  const name = (contactNames && r.contact_id ? contactNames[r.contact_id] : '') || '';
  const phone = String(r.phone_number || '').replace('whatsapp:', '');
  return vars.map((raw, i) => {
    const fb = (fallbacks[i] || '').trim();
    let out = String(raw ?? '').replace(/\{\s*(name|first_name|phone)\s*\}/gi, (_m, key: string) => {
      const k = key.toLowerCase();
      if (k === 'phone') return phone;
      if (k === 'first_name') return name.trim().split(/\s+/)[0] || '';
      return name;
    });
    out = out.replace(/\s{2,}/g, ' ').trim();
    if (!out) out = fb;
    // WhatsApp rejects empty template parameters.
    return out || '-';
  });
}

async function sendOne(
  supabase: any, camp: any, r: any,
  phoneNumberId: string, accessToken: string,
  baseVars: string[], fallbacks: string[], contactNames: Record<string, string> | null,
): Promise<{ ok: boolean }> {
  const vars = resolveVars(baseVars, fallbacks, r, contactNames);
  const components = vars.length > 0
    ? [{ type: 'body', parameters: vars.map((v) => ({ type: 'text', text: v })) }]
    : undefined;
  const cleaned = String(r.phone_number).replace('whatsapp:', '').replace(/\D/g, '');
  const reqBody: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: cleaned,
    type: 'template',
    template: {
      name: camp.template_name,
      language: { code: camp.template_language || 'en_US' },
      ...(components ? { components } : {}),
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
    const result = await res.json();
    if (res.ok) {
      const waMsgId = result.messages?.[0]?.id;
      await supabase.from('campaign_recipients').update({
        status: 'sent', whatsapp_message_id: waMsgId,
        sent_at: new Date().toISOString(),
        locked_at: null, locked_by: null,
      }).eq('id', r.id);

      let messageText: string;
      if (camp.template_body) {
        messageText = String(camp.template_body).replace(/\{\{(\d+)\}\}/g, (_m: string, n: string) => {
          const idx = parseInt(n, 10) - 1;
          return vars[idx] ?? `{{${n}}}`;
        });
      } else {
        messageText = `${camp.template_name}${vars.length > 0 ? `\n${vars.join(' | ')}` : ''}`;
      }
      if (r.contact_id) {
        await supabase.from('messages').insert({
          contact_id: r.contact_id, content: messageText,
          direction: 'outgoing', status: 'sent', twilio_sid: waMsgId,
        });
      }
      return { ok: true };
    }

    const attempts = (r.attempts ?? 0) + 1;
    const errMsg = result.error?.message || 'Unknown error';
    const errCode = String(result.error?.code || '');
    if (attempts >= 3) {
      await supabase.from('campaign_recipients').update({
        status: 'failed', error: errMsg, error_code: errCode,
        attempts, last_error_at: new Date().toISOString(),
        failed_at: new Date().toISOString(),
        locked_at: null, locked_by: null,
      }).eq('id', r.id);
    } else {
      const backoffSec = Math.pow(2, attempts) * 30; // 60s, 120s, 240s
      await supabase.from('campaign_recipients').update({
        status: 'pending', error: errMsg, error_code: errCode,
        attempts, last_error_at: new Date().toISOString(),
        next_attempt_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
        locked_at: null, locked_by: null,
      }).eq('id', r.id);
    }
    return { ok: false };
  } catch (e) {
    const attempts = (r.attempts ?? 0) + 1;
    const errMsg = e instanceof Error ? e.message : 'Network error';
    await supabase.from('campaign_recipients').update({
      status: attempts >= 3 ? 'failed' : 'pending',
      error: errMsg, attempts, last_error_at: new Date().toISOString(),
      failed_at: attempts >= 3 ? new Date().toISOString() : null,
      next_attempt_at: attempts >= 3 ? null : new Date(Date.now() + 60_000 * attempts).toISOString(),
      locked_at: null, locked_by: null,
    }).eq('id', r.id);
    return { ok: false };
  }
}
