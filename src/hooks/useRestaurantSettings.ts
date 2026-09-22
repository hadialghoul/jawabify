import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type OpeningHour = { open: string; close: string; closed?: boolean };
export type OpeningHours = Record<string, OpeningHour>; // mon..sun

export type RestaurantSettings = {
  tenant_id: string;
  eta_text: string;
  daily_specials: string | null;
  opening_hours: OpeningHours;
  max_party_size: number;
  reminder_hours_before: number;
  kitchen_notify_phone: string | null;
  human_transfer_phone: string | null;
};

const DEFAULT_HOURS: OpeningHours = {
  mon: { open: "11:00", close: "23:00" },
  tue: { open: "11:00", close: "23:00" },
  wed: { open: "11:00", close: "23:00" },
  thu: { open: "11:00", close: "23:00" },
  fri: { open: "11:00", close: "00:00" },
  sat: { open: "11:00", close: "00:00" },
  sun: { open: "11:00", close: "23:00" },
};

export function useRestaurantSettings() {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("restaurant_settings")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    setSettings(
      data ?? {
        tenant_id: tenantId,
        eta_text: "30-45 min",
        daily_specials: null,
        opening_hours: DEFAULT_HOURS,
        max_party_size: 10,
        reminder_hours_before: 2,
        kitchen_notify_phone: null,
        human_transfer_phone: null,
      },
    );
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<RestaurantSettings>) => {
      if (!tenantId || !settings) return;
      const next = { ...settings, ...patch, tenant_id: tenantId };
      const { error } = await (supabase as any)
        .from("restaurant_settings")
        .upsert(next, { onConflict: "tenant_id" });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSettings(next);
      toast.success("Saved");
    },
    [tenantId, settings],
  );

  return { settings, loading, save, defaultHours: DEFAULT_HOURS };
}
