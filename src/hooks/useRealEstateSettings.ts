import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type RealEstateSettings = {
  tenant_id: string;
  currency: string;
  budget_brackets: any[];
  areas_covered: string[];
  viewing_duration_min: number;
  followup_hours_after: number;
  reminder_hours_before: number;
  languages: string[];
  google_sheet_url: string | null;
  calendly_url: string | null;
  crm_webhook_url: string | null;
  human_transfer_phone: string | null;
};

const DEFAULTS = (tenantId: string): RealEstateSettings => ({
  tenant_id: tenantId,
  currency: "USD",
  budget_brackets: [],
  areas_covered: [],
  viewing_duration_min: 30,
  followup_hours_after: 24,
  reminder_hours_before: 2,
  languages: ["en", "ar", "fr"],
  google_sheet_url: null,
  calendly_url: null,
  crm_webhook_url: null,
  human_transfer_phone: null,
});

export function useRealEstateSettings() {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<RealEstateSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("real_estate_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
    setSettings(data ?? DEFAULTS(tenantId));
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<RealEstateSettings>) => {
    if (!tenantId || !settings) return;
    const next = { ...settings, ...patch, tenant_id: tenantId };
    const { error } = await (supabase as any)
      .from("real_estate_settings").upsert(next, { onConflict: "tenant_id" });
    if (error) { toast.error(error.message); return; }
    setSettings(next);
    toast.success("Saved");
  }, [tenantId, settings]);

  return { settings, loading, save };
}
