import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface HCSpecialty {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  triage_questions: string[] | any;
  urgency_keywords: string[];
  active: boolean;
}
export interface HCDoctor {
  id: string;
  tenant_id: string;
  specialty_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  bio: string | null;
  availability: any;
  active: boolean;
}
export interface HCLead {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  intent: "appointment" | "lab_result" | "question" | "prescription" | "other";
  status: "new" | "triaged" | "booked" | "completed" | "urgent" | "cancelled";
  specialty_id: string | null;
  assigned_doctor_id: string | null;
  urgency_level: "low" | "medium" | "high" | "emergency" | null;
  needs_human: boolean;
  handoff_reason: string | null;
  reason: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}
export interface HCAppointment {
  id: string;
  tenant_id: string;
  doctor_id: string | null;
  specialty_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  scheduled_at: string;
  duration_min: number;
  status: "booked" | "completed" | "cancelled" | "no_show";
  urgency_level: "low" | "medium" | "high" | "emergency" | null;
  triage_notes: string | null;
  reason: string | null;
  notes: string | null;
  source: string;
}
export interface HCLabResult {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  doctor_id: string | null;
  patient_name: string | null;
  result_url: string | null;
  notes: string | null;
  status: "pending" | "ready" | "delivered";
  delivered_at: string | null;
  created_at: string;
}
export interface HCSettings {
  tenant_id: string;
  currency: string;
  bot_tone: string;
  languages: string[];
  appointment_duration_min: number;
  reminder_hours_before: number;
  followup_hours_after: number;
  lab_message_template: string;
  calendly_url: string | null;
  google_calendar_url: string | null;
  google_sheet_url: string | null;
  lab_webhook_url: string | null;
  crm_webhook_url: string | null;
  meta_ads_pixel: string | null;
  human_transfer_phone: string | null;
}

function makeCrud<T extends { id?: string }>(table: string) {
  return function useThing() {
    const { tenantId } = useAuth();
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const load = useCallback(async () => {
      if (!tenantId) return;
      setLoading(true);
      const { data } = await (supabase as any).from(table).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      setItems((data ?? []) as T[]);
      setLoading(false);
    }, [tenantId]);
    useEffect(() => { load(); }, [load]);
    return {
      items, loading, refresh: load,
      create: async (v: Partial<T>) => {
        if (!tenantId) return null;
        const { data, error } = await (supabase as any).from(table).insert({ ...v, tenant_id: tenantId }).select().single();
        if (error) { toast.error(error.message); return null; }
        await load(); return data;
      },
      update: async (id: string, patch: Partial<T>) => {
        const { error } = await (supabase as any).from(table).update(patch).eq("id", id);
        if (error) toast.error(error.message); else await load();
      },
      remove: async (id: string) => {
        const { error } = await (supabase as any).from(table).delete().eq("id", id);
        if (error) toast.error(error.message); else await load();
      },
    };
  };
}

export const useHCSpecialties = makeCrud<HCSpecialty>("healthcare_specialties");
export const useHCDoctors = makeCrud<HCDoctor>("healthcare_doctors");
export const useHCLeads = makeCrud<HCLead>("healthcare_leads");
export const useHCLabResults = makeCrud<HCLabResult>("healthcare_lab_results");

export function useHCAppointments(rangeStart: Date, rangeEnd: Date) {
  const { tenantId } = useAuth();
  const [appts, setAppts] = useState<HCAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();
  const fetchAll = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("healthcare_appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at");
    setAppts((data ?? []) as HCAppointment[]);
    setLoading(false);
  }, [tenantId, startIso, endIso]);
  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel("hcappt-" + tenantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "healthcare_appointments", filter: `tenant_id=eq.${tenantId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, fetchAll]);
  return {
    appts, loading,
    update: async (id: string, patch: Partial<HCAppointment>) =>
      (supabase as any).from("healthcare_appointments").update(patch).eq("id", id),
    remove: async (id: string) =>
      (supabase as any).from("healthcare_appointments").delete().eq("id", id),
  };
}

export function useHCSettings() {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<HCSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let { data } = await (supabase as any).from("healthcare_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (!data) {
      const { data: ins } = await (supabase as any).from("healthcare_settings").insert({ tenant_id: tenantId }).select().single();
      data = ins;
    }
    setSettings(data as HCSettings);
    setLoading(false);
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);
  return {
    settings, loading,
    save: async (patch: Partial<HCSettings>) => {
      if (!tenantId) return;
      const { error } = await (supabase as any).from("healthcare_settings").update(patch).eq("tenant_id", tenantId);
      if (error) { toast.error(error.message); return; }
      toast.success("Saved");
      await load();
    },
  };
}
