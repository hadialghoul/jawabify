import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ModifierOption { name: string; price_delta: number }
export interface MenuItemModifier {
  id: string;
  menu_item_id: string;
  group_name: string;
  required: boolean;
  max_select: number;
  sort_order: number;
  options: ModifierOption[];
}

export function useMenuModifiers() {
  const { tenantId } = useAuth();
  const [modifiers, setModifiers] = useState<MenuItemModifier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("menu_item_modifiers")
      .select("id,menu_item_id,group_name,required,max_select,sort_order,options")
      .eq("tenant_id", tenantId)
      .order("sort_order");
    setModifiers(((data ?? []) as any[]).map((m) => ({
      ...m,
      options: Array.isArray(m.options) ? m.options : [],
    })));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addGroup = async (menu_item_id: string, group_name: string) => {
    if (!tenantId) return;
    await supabase.from("menu_item_modifiers").insert({
      tenant_id: tenantId,
      menu_item_id,
      group_name,
      required: false,
      max_select: 1,
      sort_order: 0,
      options: [],
    });
    await fetchAll();
  };
  const updateGroup = async (id: string, patch: Partial<MenuItemModifier>) => {
    await supabase.from("menu_item_modifiers").update(patch as any).eq("id", id);
    await fetchAll();
  };
  const deleteGroup = async (id: string) => {
    await supabase.from("menu_item_modifiers").delete().eq("id", id);
    await fetchAll();
  };

  return { modifiers, loading, addGroup, updateGroup, deleteGroup, refetch: fetchAll };
}
