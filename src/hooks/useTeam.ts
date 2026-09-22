import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'employee';
  display_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
}

export interface MemberSessionRow {
  session_id: string;
  member_id: string | null;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  end_reason: string | null;
  messages_sent: number;
  orders_handled: number;
}

type Action = 'create' | 'set_password' | 'set_role' | 'set_active' | 'remove';

export function useTeam() {
  const { tenantId, isTenantAdmin } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('tenant_members')
      .select('id, user_id, role, display_name, email, is_active, created_at, last_seen_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    setMembers((data as TeamMember[]) ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const call = useCallback(
    async (action: Action, payload: Record<string, unknown> = {}) => {
      setWorking(true);
      try {
        const { data, error } = await supabase.functions.invoke('manage-team-member', {
          body: { action, tenant_id: tenantId, ...payload },
        });
        if (error) {
          // Surface the function's own message when available.
          const ctxMsg = await (async () => {
            try {
              const res = (error as { context?: Response }).context;
              if (res && typeof res.json === 'function') {
                const body = await res.json();
                return body?.error as string | undefined;
              }
            } catch { /* ignore */ }
            return undefined;
          })();
          throw new Error(ctxMsg || error.message);
        }
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        await load();
        return data;
      } finally {
        setWorking(false);
      }
    },
    [tenantId, load],
  );

  const addMember = (input: { display_name: string; email: string; password: string; role: 'admin' | 'employee' }) =>
    call('create', input);
  const setPassword = (memberId: string, password: string) => call('set_password', { member_id: memberId, password });
  const setRole = (memberId: string, role: 'admin' | 'employee') => call('set_role', { member_id: memberId, role });
  const setActive = (memberId: string, isActive: boolean) => call('set_active', { member_id: memberId, is_active: isActive });
  const removeMember = (memberId: string) => call('remove', { member_id: memberId });

  return {
    members,
    loading,
    working,
    isTenantAdmin,
    reload: load,
    addMember,
    setPassword,
    setRole,
    setActive,
    removeMember,
  };
}

export function useMemberActivity(days = 7) {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<MemberSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const { data } = await supabase.rpc('get_member_activity', {
      p_tenant_id: tenantId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    });
    setRows((data as MemberSessionRow[]) ?? []);
    setLoading(false);
  }, [tenantId, days]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, reload: load };
}
