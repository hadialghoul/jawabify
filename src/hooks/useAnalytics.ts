import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay, endOfDay, format, differenceInCalendarDays } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useCachedState, hasCache, isFresh } from '@/lib/dataCache';


export interface DailyPoint {
  date: string;
  label: string;
  incoming: number;
  outgoing: number;
  orders: number;
}

export interface AnalyticsData {
  totals: {
    contacts: number;
    interested: number;
    messages: number;
    incoming: number;
    outgoing: number;
    orders: number;
    pendingOrders: number;
    processingOrders: number;
    completedOrders: number;
    cancelledOrders: number;
    revenue: number;
    returningRate: number;
    customersWithOrders: number;
    returningCustomers: number;
  };
  daily: DailyPoint[];
  ordersByStatus: { name: string; value: number }[];
  topProducts: { name: string; orders: number; quantity: number }[];
  topCustomers: { name: string; phone: string; messages: number }[];
  hourlyHeatmap: { hour: number; count: number }[];
  responseRatio: { name: string; value: number }[];
}

export interface DateRange {
  from: Date;
  to: Date;
}

const ANALYTICS_TTL = 60_000;

export function useAnalytics(range: DateRange) {
  const { tenantId } = useAuth();

  const fromKey = startOfDay(range.from).toISOString();
  const toKey = endOfDay(range.to).toISOString();
  const cacheKey = tenantId ? `analytics:${tenantId}:${fromKey}:${toKey}` : null;

  const [data, setData] = useCachedState<AnalyticsData | null>(cacheKey, null);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const fetchAnalytics = useCallback(async (force = false) => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
      return;
    }
    // Cached snapshot is shown immediately; skip the round-trip when fresh.
    if (!force && isFresh(cacheKey, ANALYTICS_TTL)) {
      setLoading(false);
      return;
    }
    if (!hasCache(cacheKey)) setLoading(true);

    try {
      const days = differenceInCalendarDays(new Date(toKey), new Date(fromKey)) + 1;

      // Single aggregated round-trip — all heavy counting happens in the database.
      const { data: raw, error } = await supabase.rpc('get_tenant_analytics', {
        p_tenant_id: tenantId,
        p_from: fromKey,
        p_to: toKey,
      });
      if (error) throw error;
      const r: any = raw || {};

      const dailyMap = new Map<string, DailyPoint>();
      for (let i = days - 1; i >= 0; i--) {
        const d = startOfDay(subDays(new Date(toKey), i));
        dailyMap.set(format(d, 'yyyy-MM-dd'), {
          date: d.toISOString(),
          label: format(d, 'MMM d'),
          incoming: 0,
          outgoing: 0,
          orders: 0,
        });
      }
      (r.daily ?? []).forEach((row: any) => {
        const key = format(startOfDay(new Date(row.date)), 'yyyy-MM-dd');
        const b = dailyMap.get(key);
        if (!b) return;
        b.incoming = row.incoming ?? 0;
        b.outgoing = row.outgoing ?? 0;
        b.orders = row.orders ?? 0;
      });

      const customersWithOrders = r.customersWithOrders ?? 0;
      const returningCustomers = r.returningCustomers ?? 0;

      setData({
        totals: {
          contacts: r.contacts ?? 0,
          interested: r.interested ?? 0,
          messages: r.messages ?? 0,
          incoming: r.incoming ?? 0,
          outgoing: r.outgoing ?? 0,
          orders: r.orders ?? 0,
          pendingOrders: r.pendingOrders ?? 0,
          processingOrders: r.processingOrders ?? 0,
          completedOrders: r.completedOrders ?? 0,
          cancelledOrders: r.cancelledOrders ?? 0,
          revenue: Number(r.revenue ?? 0),
          returningRate:
            customersWithOrders > 0 ? Math.round((returningCustomers / customersWithOrders) * 100) : 0,
          customersWithOrders,
          returningCustomers,
        },
        daily: Array.from(dailyMap.values()),
        ordersByStatus: r.ordersByStatus ?? [],
        topProducts: r.topProducts ?? [],
        topCustomers: r.topCustomers ?? [],
        hourlyHeatmap: r.hourlyHeatmap ?? [],
        responseRatio: [
          { name: 'Incoming', value: r.incoming ?? 0 },
          { name: 'Outgoing', value: r.outgoing ?? 0 },
        ],
      });
    } catch (e) {
      console.error('Analytics fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [fromKey, toKey, tenantId, cacheKey, setData]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const refetch = useCallback(() => fetchAnalytics(true), [fetchAnalytics]);

  return { data, loading, refetch };

}

