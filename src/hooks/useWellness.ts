import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  status: "new" | "qualified" | "booked" | "completed" | "no_show";
  interest: string | null;
  service_id: string | null;
  assigned_staff_id: string | null;
  needs_human: boolean;
  handoff_reason: string | null;
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
  lead_id: string | null;
  package_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  scheduled_at: string;
  duration_min: number;
  status: "booked" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  source: string;
}

export interface WellnessSettings {
  tenant_id: string;
  currency: string;
  bot_tone: "calm" | "energetic" | "luxury";
  languages: string[];
  session_duration_min: number;
  reminder_hours_before: number;
  second_reminder_hours_before: number;
  followup_hours_after: number;
  calendly_url: string | null;
  google_sheet_url: string | null;
  crm_webhook_url: string | null;
  payment_link: string | null;
  human_transfer_phone: string | null;
}

function makeCrud<T extends { id?: string }>(table: string) {
  return function useThing() {
    const { tenantId } = useAuth();
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
      if (!tenantId) return;
      setLoading(true);
      const { data } = await (supabase as any).from(table).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      setItems((data ?? []) as T[]);
      setLoading(false);
    }, [tenantId]);
    useEffect(() => { load(); }, [load]);
    return {
      items, loading, refresh: load,
      create: async (v: Partial<T>) => {
        if (!tenantId) return null;
        const { data, error } = await (supabase as any).from(table).insert({ ...v, tenant_id: tenantId }).select().single();
        if (error) { toast.error(error.message); return null; }
        await load(); return data;
      },
      update: async (id: string, patch: Partial<T>) => {
        const { error } = await (supabase as any).from(table).update(patch).eq("id", id);
        if (error) toast.error(error.message); else await load();
      },
      remove: async (id: string) => {
        const { error } = await (supabase as any).from(table).delete().eq("id", id);
        if (error) toast.error(error.message); else await load();
      },
    };
  };
}

export const useWellnessServices = makeCrud<WellnessService>("wellness_services");
export const useWellnessStaff = makeCrud<WellnessStaff>("wellness_staff");
export const useWellnessPackages = makeCrud<WellnessPackage>("wellness_packages");
export const useWellnessLeads = makeCrud<WellnessLead>("wellness_leads");

export function useWellnessSessions(rangeStart: Date, rangeEnd: Date) {
  const { tenantId } = useAuth();
  const [sessions, setSessions] = useState<WellnessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("wellness_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at");
    setSessions((data ?? []) as WellnessSession[]);
    setLoading(false);
  }, [tenantId, startIso, endIso]);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel("wsess-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "wellness_sessions", filter: `tenant_id=eq.${tenantId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, fetchAll]);
  return {
    sessions, loading,
    create: async (v: Partial<WellnessSession>) => {
      if (!tenantId) return null;
      const { data, error } = await (supabase as any).from("wellness_sessions").insert({ ...v, tenant_id: tenantId }).select().single();
      if (error) throw error; return data;
    },
    update: async (id: string, patch: Partial<WellnessSession>) =>
      (supabase as any).from("wellness_sessions").update(patch).eq("id", id),
    remove: async (id: string) =>
      (supabase as any).from("wellness_sessions").delete().eq("id", id),
  };
}

export function useWellnessSettings() {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<WellnessSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let { data } = await (supabase as any).from("wellness_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (!data) {
      const { data: ins } = await (supabase as any).from("wellness_settings").insert({ tenant_id: tenantId }).select().single();
      data = ins;
    }
    setSettings(data as WellnessSettings);
    setLoading(false);
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);
  return {
    settings, loading,
    save: async (patch: Partial<WellnessSettings>) => {
      if (!tenantId) return;
      const { error } = await (supabase as any).from("wellness_settings").update(patch).eq("tenant_id", tenantId);
      if (error) { toast.error(error.message); return; }
      toast.success("Saved");
      await load();
    },
  };
}
