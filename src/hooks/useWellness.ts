import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from './useToast';

export interface WellnessService {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_min: number;
  price: number | null;
  currency: string;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WellnessStaff {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  specialties: string[];
  bio: string | null;
  active: boolean;
}

export interface WellnessPackage {
  id: string;
  tenant_id: string;
  service_id: string | null;
  service_ids: string[];
  name: string;
  description: string | null;
  sessions_count: number;
  price: number | null;
  currency: string;
  active: boolean;
}

export interface WellnessLead {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  status: string;
  interest: string | null;
  service_id: string | null;
  assigned_staff_id: string | null;
  needs_human: boolean;
  notes: string | null;
  source: string;
  created_at: string;
}

export interface WellnessSession {
  id: string;
  tenant_id: string;
  service_id: string | null;
  staff_id: string | null;
  contact_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  scheduled_at: string;
  duration_min: number;
  status: string;
  notes: string | null;
}

function makeCrud<T extends { id?: string }>(table: string) {
  return function useThing() {
    const { tenantId } = useAuth();
    const toast = useToast();
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
      if (!tenantId) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error } = await (supabase as any).from(table).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
      if (error) toast.error(error.message);
      setItems((data ?? []) as T[]);
      setLoading(false);
    }, [tenantId, toast]);

    useEffect(() => {
      load();
    }, [load]);

    return {
      items,
      loading,
      refresh: load,
      create: async (v: Partial<T>) => {
        if (!tenantId) return null;
        const { data, error } = await (supabase as any).from(table).insert({ ...v, tenant_id: tenantId }).select().single();
        if (error) {
          toast.error(error.message);
          return null;
        }
        toast.success('Saved');
        await load();
        return data as T;
      },
      update: async (id: string, patch: Partial<T>) => {
        const { error } = await (supabase as any).from(table).update(patch).eq('id', id);
        if (error) toast.error(error.message);
        else {
          toast.success('Updated');
          await load();
        }
      },
      remove: async (id: string) => {
        const { error } = await (supabase as any).from(table).delete().eq('id', id);
        if (error) toast.error(error.message);
        else {
          toast.success('Deleted');
          await load();
        }
      },
    };
  };
}

export const useWellnessServices = makeCrud<WellnessService>('wellness_services');
export const useWellnessStaff = makeCrud<WellnessStaff>('wellness_staff');
export const useWellnessPackages = makeCrud<WellnessPackage>('wellness_packages');
export const useWellnessLeads = makeCrud<WellnessLead>('wellness_leads');

export function useWellnessSessions(rangeStart: Date, rangeEnd: Date) {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<WellnessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const fetchAll = useCallback(async () => {
    if (!tenantId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('wellness_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at');
    if (error) toast.error(error.message);
    setSessions((data ?? []) as WellnessSession[]);
    setLoading(false);
  }, [tenantId, startIso, endIso, toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    sessions,
    loading,
    refresh: fetchAll,
    create: async (v: Partial<WellnessSession>) => {
      if (!tenantId) return null;
      const { data, error } = await (supabase as any).from('wellness_sessions').insert({ ...v, tenant_id: tenantId }).select().single();
      if (error) {
        toast.error(error.message);
        return null;
      }
      toast.success('Booking created');
      await fetchAll();
      return data as WellnessSession;
    },
    update: async (id: string, patch: Partial<WellnessSession>) => {
      const { error } = await (supabase as any).from('wellness_sessions').update(patch).eq('id', id);
      if (error) toast.error(error.message);
      else await fetchAll();
    },
    remove: async (id: string) => {
      const { error } = await (supabase as any).from('wellness_sessions').delete().eq('id', id);
      if (error) toast.error(error.message);
      else {
        toast.success('Deleted');
        await fetchAll();
      }
    },
  };
}
