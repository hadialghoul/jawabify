import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Vertical } from "@/lib/verticals";

export function useTenantVertical() {
  const { tenantId } = useAuth();
  const [vertical, setVertical] = useState<Vertical>("ecommerce");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("tenants")
        .select("vertical")
        .eq("id", tenantId)
        .maybeSingle();
      if (data?.vertical) setVertical(data.vertical as Vertical);
      setLoading(false);
    })();
  }, [tenantId]);

  return { vertical, loading };
}
