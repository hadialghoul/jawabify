import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RosterMember {
  id: string;
  display_name: string | null;
  email: string | null;
  role: 'owner' | 'admin' | 'employee';
  is_active: boolean;
}

/**
 * Lightweight list of the account's team members, readable by every member of
 * the tenant. Used to show and change who a conversation is assigned to.
 */
export function useTeamRoster() {
  const { tenantId } = useAuth();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) {
      setRoster([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('tenant_members')
      .select('id, display_name, email, role, is_active')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    setRoster((data as RosterMember[]) ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  return { roster, loading, reload: load };
}

export function memberLabel(m?: RosterMember | null) {
  if (!m) return 'Unassigned';
  return m.display_name || m.email || 'Team member';
}
