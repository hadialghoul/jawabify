import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedState, hasCache } from "@/lib/dataCache";
import { toast } from "sonner";

export interface Lead {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  intent: "buy" | "rent" | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_areas: string[];
  property_type: string | null;
  bedrooms_min: number | null;
  score: number;
  status: "new" | "qualified" | "viewing_booked" | "closed_won" | "closed_lost";
  assigned_agent_id: string | null;
  notes: string | null;
  needs_human: boolean;
  handoff_reason: string | null;
  source: string;
  created_at: string;
}

export function useLeads() {
  const { tenantId } = useAuth();
  const cacheKey = tenantId ? `leads:${tenantId}` : null;
  const [leads, setLeads] = useCachedState<Lead[]>(cacheKey, []);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const load = useCallback(async () => {
    if (!tenantId) return;
    if (!hasCache(cacheKey)) setLoading(true);
    const { data } = await (supabase as any)
      .from("leads").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }, [tenantId, cacheKey, setLeads]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel("leads-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `tenant_id=eq.${tenantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, load]);

  return {
    leads, loading, refresh: load,
    update: async (id: string, patch: Partial<Lead>) => {
      const { error } = await (supabase as any).from("leads").update(patch).eq("id", id);
      if (error) toast.error(error.message);
      else await load();
    },
    remove: async (id: string) => {
      const { error } = await (supabase as any).from("leads").delete().eq("id", id);
      if (error) toast.error(error.message);
      else await load();
    },
  };
}
