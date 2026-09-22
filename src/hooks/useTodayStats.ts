import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useCachedState, hasCache, isFresh } from '@/lib/dataCache';

export interface TodayStats {
  contactsTalked: number;
  newContacts: number;
  incoming: number;
  outgoing: number;
  orders: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  flagged: number;
}

const TODAY_TTL = 60_000;

export function useTodayStats() {
  const { tenantId } = useAuth();
  const cacheKey = tenantId ? `today-stats:${tenantId}` : null;
  const [data, setData] = useCachedState<TodayStats | null>(cacheKey, null);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const fetchStats = useCallback(async (force = false) => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
      return;
    }
    if (!force && isFresh(cacheKey, TODAY_TTL)) {
      setLoading(false);
      return;
    }
    if (!hasCache(cacheKey)) setLoading(true);
    try {
      const { data: raw, error } = await supabase.rpc('get_tenant_today_stats', {
        p_tenant_id: tenantId,
        p_from: startOfDay(new Date()).toISOString(),
        p_to: endOfDay(new Date()).toISOString(),
      });
      if (error) throw error;
      const r: any = raw || {};

      setData({
        contactsTalked: r.contactsTalked ?? 0,
        newContacts: r.newContacts ?? 0,
        incoming: r.incoming ?? 0,
        outgoing: r.outgoing ?? 0,
        orders: r.orders ?? 0,
        pendingOrders: r.pendingOrders ?? 0,
        processingOrders: r.processingOrders ?? 0,
        completedOrders: r.completedOrders ?? 0,
        cancelledOrders: r.cancelledOrders ?? 0,
        flagged: r.flagged ?? 0,
      });
    } catch (e) {
      console.error('Today stats fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [tenantId, cacheKey, setData]);


  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const refetch = useCallback(() => fetchStats(true), [fetchStats]);

  return { data, loading, refetch };
}
