// Server-side helper: fan out a mobile push notification to every auth user
// that belongs to a tenant, via the notify-app edge function.
//
// Every attempt is durably recorded in public.push_attempts so we never rely on
// short-lived edge function logs to diagnose delivery problems.

type AppPush = {
  title: string;
  body: string;
  url?: string;
  badge?: number;
  /** Free-form label of what produced this push, e.g. 'inbound_message'. */
  eventType?: string;
};

async function logAttempt(
  supabase: any,
  row: {
    event_type: string;
    tenant_id: string | null;
    user_id?: string | null;
    title?: string | null;
    body?: string | null;
    outcome: string;
    http_status?: number | null;
    error?: string | null;
  },
) {
  try {
    const { error } = await supabase.from('push_attempts').insert(row);
    if (error) console.error('[app-push] push_attempts insert failed:', error.message);
  } catch (e) {
    console.error('[app-push] push_attempts insert threw:', e);
  }
}

async function invokeNotifyApp(
  supabase: any,
  userId: string,
  push: AppPush,
  ctx: { eventType: string; tenantId: string | null },
) {
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const { eventType, tenantId } = ctx;

  if (!base || !key) {
    console.error('[app-push] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    await logAttempt(supabase, {
      event_type: eventType,
      tenant_id: tenantId,
      user_id: userId,
      title: push.title,
      body: push.body,
      outcome: 'missing_env',
      error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set',
    });
    return;
  }

  const { eventType: _drop, ...payload } = push;

  try {
    const res = await fetch(`${base}/functions/v1/notify-app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ userId, ...payload }),
    });
    const text = await res.text();
    console.log(
      `[app-push] notify-app status=${res.status} event=${eventType} user=${userId} body=${text.slice(0, 300)}`,
    );
    await logAttempt(supabase, {
      event_type: eventType,
      tenant_id: tenantId,
      user_id: userId,
      title: push.title,
      body: push.body,
      outcome: res.ok ? 'sent' : 'http_error',
      http_status: res.status,
      error: res.ok ? null : text.slice(0, 1000),
    });
  } catch (e) {
    console.error('[app-push] notify-app request failed:', e);
    await logAttempt(supabase, {
      event_type: eventType,
      tenant_id: tenantId,
      user_id: userId,
      title: push.title,
      body: push.body,
      outcome: 'fetch_failed',
      error: String(e).slice(0, 1000),
    });
  }
}

/** Notify every member of a tenant. Never throws. */
export async function notifyTenantApp(supabase: any, tenantId: string | null, push: AppPush) {
  const eventType = push.eventType || 'unknown';
  try {
    console.log(`[app-push] notifyTenantApp called event=${eventType} tenant=${tenantId}`);
    // Durable "we got here" marker so we can distinguish never-called from
    // called-but-no-members from called-but-lookup-failed.
    await logAttempt(supabase, {
      event_type: eventType,
      tenant_id: tenantId,
      title: push.title,
      body: push.body,
      outcome: 'called',
    });

    if (!tenantId) {
      await logAttempt(supabase, {
        event_type: eventType,
        tenant_id: null,
        title: push.title,
        body: push.body,
        outcome: 'no_tenant',
      });
      return;
    }

    const { data, error } = await supabase
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[app-push] member lookup failed:', error.message);
      await logAttempt(supabase, {
        event_type: eventType,
        tenant_id: tenantId,
        title: push.title,
        body: push.body,
        outcome: 'member_lookup_failed',
        error: error.message,
      });
      return;
    }

    const userIds = Array.from(
      new Set((data || []).map((r: any) => r.user_id).filter(Boolean)),
    ) as string[];

    if (userIds.length === 0) {
      console.warn(`[app-push] no tenant members for tenant=${tenantId} event=${eventType}`);
      await logAttempt(supabase, {
        event_type: eventType,
        tenant_id: tenantId,
        title: push.title,
        body: push.body,
        outcome: 'no_members',
      });
      return;
    }

    await Promise.all(
      userIds.map((id) => invokeNotifyApp(supabase, id, push, { eventType, tenantId })),
    );
  } catch (e) {
    console.error('[app-push] notifyTenantApp failed:', e);
    await logAttempt(supabase, {
      event_type: eventType,
      tenant_id: tenantId,
      title: push.title,
      body: push.body,
      outcome: 'exception',
      error: String(e).slice(0, 1000),
    });
  }
}

export function messagePreview(text: string | null | undefined, mediaType?: string | null) {
  if (mediaType?.startsWith('image')) return '📷 Photo';
  if (mediaType?.startsWith('audio')) return '🎤 Voice message';
  if (mediaType?.startsWith('video')) return '🎥 Video';
  const t = (text ?? '').trim();
  if (!t) return 'New message';
  return t.length > 120 ? `${t.slice(0, 117)}…` : t;
}
