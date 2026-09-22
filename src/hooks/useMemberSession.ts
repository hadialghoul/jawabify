import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  startMemberSession,
  heartbeatMemberSession,
  endMemberSessionSync,
} from '@/lib/memberSession';

const HEARTBEAT_MS = 60_000;

/**
 * Opens a presence session for the signed-in team member and keeps it fresh,
 * so account admins can review sign-in / sign-out times.
 */
export function useMemberSession() {
  const { user, ownTenantId, memberId, isActingAs } = useAuth();

  useEffect(() => {
    // While a super admin manages a client account we don't log a session for
    // that client's team.
    if (!user?.id || !ownTenantId || isActingAs) return;

    let cancelled = false;
    let timer: number | undefined;

    (async () => {
      await startMemberSession({ tenantId: ownTenantId, memberId, userId: user.id });
      if (cancelled) return;
      timer = window.setInterval(() => { heartbeatMemberSession(); }, HEARTBEAT_MS);
    })();

    window.addEventListener('pagehide', endMemberSessionSync);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener('pagehide', endMemberSessionSync);
    };
  }, [user?.id, ownTenantId, memberId, isActingAs]);
}

