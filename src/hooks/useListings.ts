import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedState, hasCache } from "@/lib/dataCache";
import { toast } from "sonner";

export interface Listing {
  id: string;
  tenant_id: string;
  kind: "buy" | "rent";
  property_type: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqm: number | null;
  area_name: string | null;
  region: string | null;
  images: any[];
  agent_id: string | null;
  status: "active" | "pending" | "sold" | "rented" | "archived";
  external_source: "manual" | "sheet";
  external_ref: string | null;
  created_at: string;
  updated_at: string;
}

export function useListings() {
  const { tenantId } = useAuth();
  const cacheKey = tenantId ? `listings:${tenantId}` : null;
  const [listings, setListings] = useCachedState<Listing[]>(cacheKey, []);
  const [loading, setLoading] = useState(() => !hasCache(cacheKey));

  const load = useCallback(async () => {
    if (!tenantId) return;
    if (!hasCache(cacheKey)) setLoading(true);
    const { data } = await (supabase as any)
      .from("listings").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
    setListings((data ?? []) as Listing[]);
    setLoading(false);
  }, [tenantId, cacheKey, setListings]);

  useEffect(() => { load(); }, [load]);

  return {
    listings, loading, refresh: load,
    create: async (l: Partial<Listing>) => {
      if (!tenantId) return null;
      const { data, error } = await (supabase as any)
        .from("listings").insert({ ...l, tenant_id: tenantId }).select().single();
      if (error) { toast.error(error.message); return null; }
      await load();
      return data;
    },
    update: async (id: string, patch: Partial<Listing>) => {
      const { error } = await (supabase as any).from("listings").update(patch).eq("id", id);
      if (error) toast.error(error.message);
      else await load();
    },
    remove: async (id: string) => {
      const { error } = await (supabase as any).from("listings").delete().eq("id", id);
      if (error) toast.error(error.message);
      else await load();
    },
  };
}
