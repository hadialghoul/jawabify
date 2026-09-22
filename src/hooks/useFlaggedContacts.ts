import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface FlaggedContact {
  id: string;
  name: string;
  phoneNumber: string;
  needsHuman: boolean;
  humanRequestedAt?: Date;
}

/**
 * Flagged-for-human queue read straight from the database (independent of the
 * paginated contact list), so escalations always show up and resolved ones stay
 * visible after a reload.
 */
export function useFlaggedContacts() {
  const { tenantId } = useAuth();
  const [flagged, setFlagged] = useState<FlaggedContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlagged = useCallback(async () => {
    if (!tenantId) {
      setFlagged([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, phone_number, needs_human, human_requested_at')
      .eq('tenant_id', tenantId)
      .not('human_requested_at', 'is', null)
      .order('human_requested_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching flagged contacts:', error);
      setLoading(false);
      return;
    }

    setFlagged(
      (data || []).map((c: any) => ({
        id: c.id,
        name: c.name || c.phone_number,
        phoneNumber: c.phone_number,
        needsHuman: !!c.needs_human,
        humanRequestedAt: c.human_requested_at ? new Date(c.human_requested_at) : undefined,
      })),
    );
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  // Keep the queue live: any contact update in this tenant can flag/unflag.
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`flagged-contacts-${tenantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contacts', filter: `tenant_id=eq.${tenantId}` },
        () => fetchFlagged(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchFlagged]);

  // Optimistic local flip so the card moves between sections instantly.
  const setLocalResolved = useCallback((contactId: string, needsHuman: boolean) => {
    setFlagged((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, needsHuman, humanRequestedAt: c.humanRequestedAt ?? new Date() }
          : c,
      ),
    );
  }, []);

  return { flagged, loading, refetch: fetchFlagged, setLocalResolved };
}
