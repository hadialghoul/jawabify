import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedState, hasCache } from "@/lib/dataCache";
import { toast } from "sonner";

export interface Agent {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  areas: string[];
  property_types: string[];
  active: boolean;
}

export function useAgents() {
  const { tenantId } = useAuth();
  const cacheKey = tenantId ? `agents:${tenantId}` : null;
  const [agents, setAgents] = useCachedState<Agent[]>(cacheKey, []);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const load = useCallback(async () => {
    if (!tenantId) return;
    if (!hasCache(cacheKey)) setLoading(true);
    const { data } = await (supabase as any)
      .from("agents").select("*").eq("tenant_id", tenantId).order("name");
    setAgents((data ?? []) as Agent[]);
    setLoading(false);
  }, [tenantId, cacheKey, setAgents]);

  useEffect(() => { load(); }, [load]);

  return {
    agents, loading, refresh: load,
    create: async (a: Partial<Agent>) => {
      if (!tenantId) return null;
      const { error } = await (supabase as any).from("agents").insert({ ...a, tenant_id: tenantId });
      if (error) toast.error(error.message);
      else await load();
    },
    update: async (id: string, patch: Partial<Agent>) => {
      const { error } = await (supabase as any).from("agents").update(patch).eq("id", id);
      if (error) toast.error(error.message);
      else await load();
    },
    remove: async (id: string) => {
      const { error } = await (supabase as any).from("agents").delete().eq("id", id);
      if (error) toast.error(error.message);
      else await load();
    },
  };
}
