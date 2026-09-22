import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RTable {
  id: string;
  label: string;
  seats: number;
  notes: string | null;
  sort_order: number;
}

export function useRestaurantTables() {
  const { tenantId } = useAuth();
  const [tables, setTables] = useState<RTable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from("restaurant_tables")
      .select("id,label,seats,notes,sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true });
    setTables((data ?? []) as RTable[]);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase
      .channel("rtables-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter: `tenant_id=eq.${tenantId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, fetch]);

  const addTable = async (label: string, seats: number) => {
    if (!tenantId) return;
    const sort_order = (tables[tables.length - 1]?.sort_order ?? 0) + 1;
    await supabase.from("restaurant_tables").insert({ tenant_id: tenantId, label, seats, sort_order });
  };
  const updateTable = async (id: string, patch: Partial<RTable>) => {
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("restaurant_tables").update(patch).eq("id", id);
    if (error) {
      await fetch();
      throw error;
    }
  };
  const deleteTable = async (id: string) => {
    const snapshot = tables;
    setTables((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) {
      setTables(snapshot);
      throw error;
    }
  };

  return { tables, loading, addTable, updateTable, deleteTable, refetch: fetch };
}
