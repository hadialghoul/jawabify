import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BillItem {
  id?: string;
  menu_item_id?: string | null;
  name: string;
  qty: number;
  unit_price: number;
}
export interface Bill {
  id: string;
  table_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  currency: string;
  status: "new" | "in_kitchen" | "served" | "paid" | "cancelled";
  source: "manual" | "ai" | "whatsapp";
  notes: string | null;
  created_at: string;
  order_type: "dine_in" | "pickup" | "delivery" | null;
  delivery_fee: number;
  delivery_address: string | null;
  payment_method: "cod" | "link" | null;
  items: BillItem[];
}

export function useBills() {
  const { tenantId } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("bills")
      .select("id,table_id,customer_name,customer_phone,total,currency,status,source,notes,created_at,order_type,delivery_fee,delivery_address,payment_method, bill_items(id,menu_item_id,name,qty,unit_price)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    setBills(((rows ?? []) as any[]).map((b) => ({
      ...b,
      total: Number(b.total),
      delivery_fee: Number(b.delivery_fee ?? 0),
      items: (b.bill_items ?? []).map((i: any) => ({ ...i, unit_price: Number(i.unit_price) })),
    })));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel("bills-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "bills", filter: `tenant_id=eq.${tenantId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "bill_items" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, fetchAll]);

  const createBill = async (params: {
    table_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    contact_id?: string | null;
    items: BillItem[];
    currency: string;
    notes?: string;
    order_type?: "dine_in" | "pickup" | "delivery";
    delivery_fee?: number;
    delivery_address?: string | null;
    payment_method?: "cod" | "link" | null;
  }) => {
    if (!tenantId) return null;
    const subtotal = params.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
    const deliveryFee = params.order_type === "delivery" ? (params.delivery_fee ?? 0) : 0;
    const total = subtotal + deliveryFee;
    const { data: bill, error } = await supabase.from("bills").insert({
      tenant_id: tenantId,
      table_id: params.table_id,
      contact_id: params.contact_id ?? null,
      customer_name: params.customer_name,
      customer_phone: params.customer_phone,
      total,
      currency: params.currency,
      status: "new",
      source: "manual",
      notes: params.notes ?? null,
      order_type: params.order_type ?? null,
      delivery_fee: deliveryFee,
      delivery_address: params.delivery_address ?? null,
      payment_method: params.payment_method ?? null,
    } as any).select().single();
    if (error) throw error;
    if (params.items.length) {
      await supabase.from("bill_items").insert(params.items.map((i) => ({
        bill_id: bill.id,
        menu_item_id: i.menu_item_id ?? null,
        name: i.name,
        qty: i.qty,
        unit_price: i.unit_price,
      })));
    }
    return bill;
  };

  const updateStatus = async (id: string, status: Bill["status"]) =>
    supabase.from("bills").update({ status }).eq("id", id);

  const removeBill = async (id: string) => supabase.from("bills").delete().eq("id", id);

  return { bills, loading, createBill, updateStatus, removeBill, refetch: fetchAll };
}
