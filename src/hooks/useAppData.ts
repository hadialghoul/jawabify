import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Vertical } from '../lib/verticals';
import type { ChannelFilter } from '../types';
import { useCachedState, hasCache, isFresh } from '../lib/dataCache';
import { startOfDay, endOfDay } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useTenantVertical() {
  const { tenantId } = useAuth();
  const [vertical, setVertical] = useState<Vertical>('ecommerce');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.from('tenants').select('vertical').eq('id', tenantId).maybeSingle();
      if (data?.vertical) setVertical(data.vertical as Vertical);
      setLoading(false);
    })();
  }, [tenantId]);

  return { vertical, loading };
}

export interface FlaggedContact {
  id: string;
  name: string;
  phoneNumber: string;
  needsHuman: boolean;
  humanRequestedAt?: Date;
}

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

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`flagged-contacts-${tenantId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'contacts', filter: `tenant_id=eq.${tenantId}` }, () => fetchFlagged())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, fetchFlagged]);

  const setLocalResolved = useCallback((contactId: string, needsHuman: boolean) => {
    setFlagged((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, needsHuman, humanRequestedAt: c.humanRequestedAt ?? new Date() } : c)),
    );
  }, []);

  return { flagged, loading, refetch: fetchFlagged, setLocalResolved };
}

export interface InstagramConnection {
  connected: boolean;
  username?: string;
}

export function useInstagramConnection() {
  const { tenantId } = useAuth();
  const [connection, setConnection] = useState<InstagramConnection>({ connected: false });

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setConnection({ connected: false });
      return;
    }
    const { data } = await supabase
      .from('tenant_credentials')
      .select('ig_account_id, ig_username, is_active')
      .eq('tenant_id', tenantId)
      .eq('provider', 'instagram')
      .maybeSingle();
    setConnection({
      connected: !!data?.ig_account_id && data.is_active !== false,
      username: (data as any)?.ig_username || undefined,
    });
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...connection, refresh };
}

const CHANNEL_KEY = 'jawabify.channelFilter';

export function useChannelFilter() {
  const [channel, setChannel] = useState<ChannelFilter>('all');

  useEffect(() => {
    AsyncStorage.getItem(CHANNEL_KEY).then((stored) => {
      if (stored === 'whatsapp' || stored === 'instagram') setChannel(stored);
    });
  }, []);

  const update = useCallback((next: ChannelFilter) => {
    setChannel(next);
    AsyncStorage.setItem(CHANNEL_KEY, next).catch(() => {});
  }, []);

  return { channel, setChannel: update };
}

export interface RosterMember {
  id: string;
  display_name: string | null;
  email: string | null;
  role: 'owner' | 'admin' | 'employee';
  is_active: boolean;
}

export function useTeamRoster() {
  const { tenantId } = useAuth();
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const load = useCallback(async () => {
    if (!tenantId) {
      setRoster([]);
      return;
    }
    const { data } = await supabase
      .from('tenant_members')
      .select('id, display_name, email, role, is_active')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    setRoster((data as RosterMember[]) ?? []);
  }, [tenantId]);
  useEffect(() => {
    load();
  }, [load]);
  return { roster, reload: load };
}

export function memberLabel(m?: RosterMember | null) {
  if (!m) return 'Unassigned';
  return m.display_name || m.email || 'Team member';
}

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

export function useTodayStats() {
  const { tenantId } = useAuth();
  const cacheKey = tenantId ? `today-stats:${tenantId}` : null;
  const [data, setData] = useCachedState<TodayStats | null>(cacheKey, null);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const fetchStats = useCallback(
    async (force = false) => {
      if (!tenantId) {
        setData(null);
        setLoading(false);
        return;
      }
      if (!force && isFresh(cacheKey, 60_000)) {
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
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [tenantId, cacheKey, setData],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, loading, refetch: () => fetchStats(true) };
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
  };
}

export function useAnalytics() {
  const { tenantId } = useAuth();
  const cacheKey = tenantId ? `analytics-30:${tenantId}` : null;
  const [data, setData] = useCachedState<AnalyticsData | null>(cacheKey, null);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const fetchAnalytics = useCallback(async () => {
    if (!tenantId) {
      setData(null);
      setLoading(false);
      return;
    }
    try {
      const from = startOfDay(new Date(Date.now() - 29 * 86400000)).toISOString();
      const to = endOfDay(new Date()).toISOString();
      const { data: raw, error } = await supabase.rpc('get_tenant_analytics', { p_tenant_id: tenantId, p_from: from, p_to: to });
      if (error) throw error;
      const r: any = raw || {};
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
          returningRate: customersWithOrders > 0 ? Math.round((returningCustomers / customersWithOrders) * 100) : 0,
        },
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [tenantId, setData]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, refetch: fetchAnalytics };
}
