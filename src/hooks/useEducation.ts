import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface EduCourse {
  id: string;
  tenant_id: string;
  name: string;
  subject: string | null;
  level: string | null;
  age_group: string | null;
  description: string | null;
  price: number;
  currency: string;
  schedule: string | null;
  start_date: string | null;
  capacity: number;
  payment_options: string[];
  trial_available: boolean;
  payment_link_url: string | null;
  active: boolean;
  created_at: string;
}
export interface EduLead {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  course_id: string | null;
  student_name: string | null;
  student_age: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  preferred_schedule: string | null;
  status: "new" | "interested" | "trial_booked" | "enrolled" | "completed" | "lost";
  needs_human: boolean;
  handoff_reason: string | null;
  notes: string | null;
  source: string;
  created_at: string;
}
export interface EduEnrollment {
  id: string;
  tenant_id: string;
  course_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  student_name: string;
  student_age: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  plan_type: "full" | "installment" | "trial";
  payment_status: "pending" | "paid" | "partial" | "refunded" | "failed";
  amount_paid: number;
  status: "active" | "completed" | "dropped" | "cancelled";
  start_date: string | null;
  notes: string | null;
  created_at: string;
}
export interface EduSettings {
  tenant_id: string;
  currency: string;
  bot_tone: string;
  languages: string[];
  reminder_hours_before: number;
  day_before_reminder: boolean;
  progress_day_of_week: number;
  progress_message_template: string;
  trial_class_minutes: number;
  enrollment_confirmation_template: string;
  calendly_url: string | null;
  google_calendar_url: string | null;
  google_sheet_url: string | null;
  payment_link_template: string | null;
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
      const { data } = await (supabase as any)
        .from(table).select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      setItems((data ?? []) as T[]);
      setLoading(false);
    }, [tenantId]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
      if (!tenantId) return;
      const ch = supabase.channel(`${table}-${tenantId}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter: `tenant_id=eq.${tenantId}` }, () => load())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }, [tenantId, load]);
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

export const useEduCourses = makeCrud<EduCourse>("education_courses");
export const useEduLeads = makeCrud<EduLead>("education_leads");
export const useEduEnrollments = makeCrud<EduEnrollment>("education_enrollments");

export function useEduSettings() {
  const { tenantId } = useAuth();
  const [settings, setSettings] = useState<EduSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    let { data } = await (supabase as any).from("education_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
    if (!data) {
      const { data: ins } = await (supabase as any).from("education_settings").insert({ tenant_id: tenantId }).select().single();
      data = ins;
    }
    setSettings(data as EduSettings);
    setLoading(false);
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);
  return {
    settings, loading,
    save: async (patch: Partial<EduSettings>) => {
      if (!tenantId) return;
      const { error } = await (supabase as any).from("education_settings").update(patch).eq("tenant_id", tenantId);
      if (error) { toast.error(error.message); return; }
      toast.success("Saved");
      await load();
    },
  };
}
