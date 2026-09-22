import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks when a team member is signed in so the account admin can see
 * sign-in / sign-out times per employee. Module-level so `signOut()` can
 * close the open session from anywhere.
 */
let sessionId: string | null = null;
let starting: Promise<void> | null = null;

export function getMemberSessionId() {
  return sessionId;
}

export async function startMemberSession(params: {
  tenantId: string;
  memberId: string | null;
  userId: string;
}) {
  if (sessionId || starting) return;
  starting = (async () => {
    // Close any earlier session left open by a closed tab / lost connection.
    await supabase
      .from('tenant_member_sessions')
      .update({ ended_at: new Date().toISOString(), end_reason: 'timeout' })
      .eq('user_id', params.userId)
      .is('ended_at', null);

    const { data } = await supabase
      .from('tenant_member_sessions')
      .insert({
        tenant_id: params.tenantId,
        member_id: params.memberId,
        user_id: params.userId,
        user_agent: navigator.userAgent.slice(0, 300),
      })
      .select('id')
      .maybeSingle();

    sessionId = data?.id ?? null;
  })();
  try {
    await starting;
  } finally {
    starting = null;
  }
}

export async function heartbeatMemberSession() {
  if (!sessionId) return;
  const now = new Date().toISOString();
  await supabase
    .from('tenant_member_sessions')
    .update({ last_seen_at: now })
    .eq('id', sessionId)
    .is('ended_at', null);
}

export async function endMemberSession(reason: 'signout' | 'closed' = 'signout') {
  const id = sessionId;
  if (!id) return;
  sessionId = null;
  const now = new Date().toISOString();
  await supabase
    .from('tenant_member_sessions')
    .update({ ended_at: now, last_seen_at: now, end_reason: reason })
    .eq('id', id)
    .is('ended_at', null);
}

/** Best-effort close during page unload (fetch may be cancelled). */
export function endMemberSessionSync() {
  const id = sessionId;
  if (!id) return;
  sessionId = null;
  const now = new Date().toISOString();
  supabase
    .from('tenant_member_sessions')
    .update({ ended_at: now, last_seen_at: now, end_reason: 'closed' })
    .eq('id', id)
    .is('ended_at', null)
    .then(() => {}, () => {});
}
