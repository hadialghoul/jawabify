import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedState, hasCache } from "@/lib/dataCache";

export interface Viewing {
  id: string;
  tenant_id: string;
  listing_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  agent_id: string | null;
  guest_name: string;
  guest_phone: string | null;
  scheduled_at: string;
  duration_min: number;
  status: "booked" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  source: string;
}

export function useViewings(rangeStart: Date, rangeEnd: Date) {
  const { tenantId } = useAuth();
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const cacheKey = tenantId ? `viewings:${tenantId}:${startIso}:${endIso}` : null;
  const [viewings, setViewings] = useCachedState<Viewing[]>(cacheKey, []);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    if (!hasCache(cacheKey)) setLoading(true);
    const { data } = await (supabase as any)
      .from("viewings")
      .select("id,tenant_id,listing_id,lead_id,contact_id,agent_id,guest_name,guest_phone,scheduled_at,duration_min,status,notes,source")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at");
    setViewings((data ?? []) as Viewing[]);
    setLoading(false);
  }, [tenantId, startIso, endIso, cacheKey, setViewings]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel("viewings-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "viewings", filter: `tenant_id=eq.${tenantId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, fetchAll]);

  return {
    viewings, loading,
    create: async (v: Partial<Viewing>) => {
      if (!tenantId) return null;
      const { data, error } = await (supabase as any).from("viewings")
        .insert({ ...v, tenant_id: tenantId }).select().single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, patch: Partial<Viewing>) =>
      (supabase as any).from("viewings").update(patch).eq("id", id),
    remove: async (id: string) =>
      (supabase as any).from("viewings").delete().eq("id", id),
  };
}
