import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCachedState, hasCache } from "@/lib/dataCache";

export interface MenuCategory { id: string; name: string; sort_order: number; }
export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  is_available: boolean;
  image_url: string | null;
  sort_order: number;
}

export function useMenu() {
  const { tenantId } = useAuth();
  const catKey = tenantId ? `menu-categories:${tenantId}` : null;
  const itemsKey = tenantId ? `menu-items:${tenantId}` : null;
  const [categories, setCategories] = useCachedState<MenuCategory[]>(catKey, []);
  const [items, setItems] = useCachedState<MenuItem[]>(itemsKey, []);
  const [loading, setLoading] = useState(() => !hasCache(itemsKey));

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    if (!hasCache(itemsKey)) setLoading(true);
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase.from("menu_categories").select("id,name,sort_order").eq("tenant_id", tenantId).order("sort_order"),
      supabase.from("menu_items").select("id,category_id,name,description,price,currency,is_available,image_url,sort_order").eq("tenant_id", tenantId).order("sort_order"),
    ]);
    setCategories((cats ?? []) as MenuCategory[]);
    setItems(((its ?? []) as any[]).map((i) => ({ ...i, price: Number(i.price) })) as MenuItem[]);
    setLoading(false);
  }, [tenantId, catKey, itemsKey, setCategories, setItems]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel("menu-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `tenant_id=eq.${tenantId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_categories", filter: `tenant_id=eq.${tenantId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, fetchAll]);

  const handle = async <T,>(p: PromiseLike<{ error: any; data?: T }>, label: string) => {
    const { error } = await p;
    if (error) { console.error(label, error); throw error; }
    await fetchAll();
  };

  return {
    categories,
    items,
    loading,
    refetch: fetchAll,
    addCategory: async (name: string) => {
      if (!tenantId) return;
      const sort_order = (categories[categories.length - 1]?.sort_order ?? 0) + 1;
      await handle(supabase.from("menu_categories").insert({ tenant_id: tenantId, name, sort_order }) as any, "addCategory");
    },
    deleteCategory: async (id: string) => {
      // Categories never leave orphaned items behind: remove the items first.
      const { error } = await supabase.from("menu_items").delete().eq("category_id", id);
      if (error) { console.error("deleteCategoryItems", error); throw error; }
      await handle(supabase.from("menu_categories").delete().eq("id", id) as any, "deleteCategory");
    },
    addItem: async (item: { category_id: string | null; name: string; price: number; currency: string; description?: string }) => {
      if (!tenantId) return;
      const sort_order = (items[items.length - 1]?.sort_order ?? 0) + 1;
      await handle(
        supabase.from("menu_items").insert({ tenant_id: tenantId, sort_order, is_available: true, ...item }) as any,
        "addItem",
      );
    },
    updateItem: async (id: string, patch: Partial<MenuItem>) =>
      handle(supabase.from("menu_items").update(patch).eq("id", id) as any, "updateItem"),
    deleteItem: async (id: string) =>
      handle(supabase.from("menu_items").delete().eq("id", id) as any, "deleteItem"),
  };
}
