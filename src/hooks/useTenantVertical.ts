import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Vertical } from "@/lib/verticals";

export function useTenantVertical() {
  const { tenantId } = useAuth();
  const [vertical, setVertical] = useState<Vertical>("ecommerce");
  const [loading, setLoading] = useState(true);

  const fetchVertical = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("tenants")
      .select("vertical")
      .eq("id", tenantId)
      .maybeSingle();
    if (data?.vertical) setVertical(data.vertical as Vertical);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    void fetchVertical();
  }, [fetchVertical]);

  // Re-read when the native app returns to the foreground so a server-side
  // vertical change (e.g. Service → Restaurant) shows up without a stale cache.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void fetchVertical();
    });
    return () => {
      void handle.then((l) => l.remove());
    };
  }, [fetchVertical]);

  // Browser / PWA: refresh when the tab becomes visible again.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchVertical();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchVertical]);

  return { vertical, loading };
}
