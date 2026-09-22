import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const KEY = "default_delivery_fee";
const FALLBACK = 3;

export function useDefaultDeliveryFee() {
  const { tenantId } = useAuth();
  const [defaultFee, setDefaultFee] = useState<number>(FALLBACK);
  const [loading, setLoading] = useState(true);

  const fetchFee = useCallback(async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("tenant_id", tenantId)
      .eq("key", KEY)
      .maybeSingle();
    const raw = (data?.value as any);
    const n = typeof raw === "number" ? raw : parseFloat(raw?.amount ?? raw);
    setDefaultFee(isNaN(n) ? FALLBACK : n);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchFee(); }, [fetchFee]);

  const saveDefault = useCallback(async (fee: number) => {
    if (!tenantId) return;
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { tenant_id: tenantId, key: KEY, value: fee as any },
        { onConflict: "tenant_id,key" },
      );
    if (error) {
      toast.error("Failed to save default delivery fee");
      return;
    }
    setDefaultFee(fee);
    toast.success(`Default delivery fee set to $${fee.toFixed(2)}`);
  }, [tenantId]);

  return { defaultFee, loading, saveDefault };
}
