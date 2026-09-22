import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-acting-tenant, x-supabase-authorization, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const {
      name, templateName, templateLanguage, templateBody, variables, contactIds,
      contactPhones, scheduledAt, sendRatePerMinute, concurrency,
      excludeOptedOut, appendOptOut, optOutVariableIndex, variableFallbacks,
    } = body;

    if (!name || !templateName || !Array.isArray(contactIds) || contactIds.length === 0) {
      return json({ error: 'Missing name, templateName, or contactIds' }, 400);
    }

    const normalizedPhones = Array.isArray(contactPhones)
      ? contactPhones.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];

    // Look up contacts first (no tenant filter) so we can give a clear error
    // and support super-admins / users whose membership tenant differs. If the
    // UI has stale IDs after a realtime/import refresh, fall back to the phone
    // numbers that were displayed to the user.
    let { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .select('id, phone_number, tenant_id, opted_out')
      .in('id', contactIds);
    if (contactsErr) {
      console.error('contacts lookup error:', contactsErr);
      return json({ error: contactsErr.message }, 500);
    }

    if ((!contacts || contacts.length === 0) && normalizedPhones.length > 0) {
      const fallback = await supabase
        .from('contacts')
        .select('id, phone_number, tenant_id, opted_out')
        .in('phone_number', normalizedPhones);
      if (fallback.error) {
        console.error('contacts phone fallback error:', fallback.error);
        return json({ error: fallback.error.message }, 500);
      }
      contacts = fallback.data;
    }

    console.log('send-campaign: requested', contactIds.length, 'found', contacts?.length || 0);
    if (!contacts || contacts.length === 0) {
      return json({ error: `No contacts found for the ${contactIds.length} selected recipients. Refresh contacts and try again.` }, 400);
    }

    let uniqueContacts = Array.from(new Map(contacts.map((c) => [c.id, c])).values());

    // Server-side safety net: drop opted-out contacts when requested (defaults true).
    const dropOptedOut = excludeOptedOut !== false;
    if (dropOptedOut) {
      const before = uniqueContacts.length;
      uniqueContacts = uniqueContacts.filter((c: any) => !c.opted_out);
      const removed = before - uniqueContacts.length;
      if (removed > 0) console.log(`send-campaign: excluded ${removed} opted-out contact(s)`);
      if (uniqueContacts.length === 0) {
        return json({ error: 'All selected contacts have opted out.' }, 400);
      }
    }

    // Derive tenant from the contacts themselves (all must share one tenant).
    const tenantIds = Array.from(new Set(uniqueContacts.map((c) => c.tenant_id).filter(Boolean)));
    if (tenantIds.length !== 1) {
      return json({ error: 'Selected contacts span multiple tenants' }, 400);
    }
    const tenantId = tenantIds[0] as string;

    // Confirm the caller belongs to that tenant (or is super_admin).
    const [{ data: membership }, { data: roleRow }] = await Promise.all([
      supabase.from('tenant_members').select('tenant_id').eq('user_id', userData.user.id).eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userData.user.id).eq('role', 'super_admin').maybeSingle(),
    ]);
    if (!membership && !roleRow) return json({ error: 'Not a member of this tenant' }, 403);

    const { data: cred } = await supabase
      .from('tenant_credentials')
      .select('phone_number_id, access_token')
      .eq('tenant_id', tenantId)
      .eq('provider', 'whatsapp_cloud')
      .eq('is_active', true)
      .maybeSingle();
    if (!cred) return json({ error: 'WhatsApp not configured' }, 400);


    const scheduled = scheduledAt ? new Date(scheduledAt) : null;
    const willSchedule = scheduled && scheduled.getTime() > Date.now() + 30_000;

    const rate = clamp(parseInt(sendRatePerMinute, 10), 10, 600, 60);
    const conc = clamp(parseInt(concurrency, 10), 1, 20, 5);

    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .insert({
        tenant_id: tenantId,
        name,
        template_name: templateName,
        template_language: templateLanguage || 'en_US',
        template_body: templateBody || null,
        variables: variables || [],
        variable_fallbacks: Array.isArray(variableFallbacks) ? variableFallbacks.map((v: unknown) => String(v ?? '')) : [],
        status: willSchedule ? 'scheduled' : 'sending',
        total_recipients: uniqueContacts.length,
        scheduled_at: scheduled ? scheduled.toISOString() : null,
        send_rate_per_minute: rate,
        concurrency: conc,
        started_at: willSchedule ? null : new Date().toISOString(),
        created_by: userData.user.id,
        append_opt_out: appendOptOut !== false,
        opt_out_variable_index: Number.isFinite(parseInt(optOutVariableIndex, 10)) ? parseInt(optOutVariableIndex, 10) : null,
      })
      .select()
      .single();
    if (campErr || !campaign) return json({ error: campErr?.message || 'Failed to create campaign' }, 500);

    const recipientRows = uniqueContacts.map((c) => ({
      campaign_id: campaign.id,
      contact_id: c.id,
      phone_number: c.phone_number,
      status: 'pending',
      next_attempt_at: scheduled ? scheduled.toISOString() : new Date().toISOString(),
    }));
    const INSERT_CHUNK = 500;
    for (let i = 0; i < recipientRows.length; i += INSERT_CHUNK) {
      await supabase.from('campaign_recipients').insert(recipientRows.slice(i, i + INSERT_CHUNK));
    }

    // Kick off the worker immediately if not scheduled.
    if (!willSchedule) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/campaign-worker`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          'Content-Type': 'application/json',
        },
        body: '{}',
      }).catch((e) => console.error('worker kick failed:', e));
    }

    return json({
      success: true, campaignId: campaign.id, total: contacts.length,
      status: campaign.status, scheduledAt: campaign.scheduled_at,
    });
  } catch (e) {
    console.error('send-campaign error:', e);
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
