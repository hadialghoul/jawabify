import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface Reservation {
  id: string;
  table_id: string | null;
  contact_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  source: 'manual' | 'ai' | 'whatsapp';
  notes: string | null;
}

export function useReservations(rangeStart: Date, rangeEnd: Date) {
  const { tenantId } = useAuth();
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('reservations')
      .select('id,table_id,contact_id,guest_name,guest_phone,party_size,starts_at,ends_at,status,source,notes')
      .eq('tenant_id', tenantId)
      .gte('starts_at', startIso)
      .lt('starts_at', endIso)
      .order('starts_at');
    setReservations((data ?? []) as Reservation[]);
    setLoading(false);
  }, [tenantId, startIso, endIso]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel('res-mobile-' + tenantId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `tenant_id=eq.${tenantId}` },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [tenantId, fetchAll]);

  return {
    reservations,
    loading,
    refetch: fetchAll,
    create: async (r: Omit<Reservation, 'id'>) => {
      if (!tenantId) return null;
      const { data: rs } = await supabase
        .from('restaurant_settings')
        .select('reminder_hours_before')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const hours = (rs as any)?.reminder_hours_before ?? 2;
      const reminderAt = new Date(new Date(r.starts_at).getTime() - hours * 3600_000).toISOString();
      const { data, error } = await supabase
        .from('reservations')
        .insert({ ...r, tenant_id: tenantId, reminder_at: reminderAt } as any)
        .select()
        .single();
      if (error) throw error;
      await fetchAll();
      return data;
    },
    update: async (id: string, patch: Partial<Reservation>) => {
      const { error } = await supabase.from('reservations').update(patch).eq('id', id);
      if (error) throw error;
      await fetchAll();
    },
    remove: async (id: string) => {
      const { error } = await supabase.from('reservations').delete().eq('id', id);
      if (error) throw error;
      await fetchAll();
    },
  };
}
