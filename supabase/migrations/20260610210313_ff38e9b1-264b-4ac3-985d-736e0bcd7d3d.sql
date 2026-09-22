
CREATE OR REPLACE FUNCTION public.guard_healthcare_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.assert_tenant_vertical(NEW.tenant_id, 'healthcare'); RETURN NEW; END;
$$;

CREATE TABLE public.healthcare_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  triage_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  urgency_keywords text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_specialties TO authenticated;
GRANT ALL ON public.healthcare_specialties TO service_role;
ALTER TABLE public.healthcare_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hc specialties" ON public.healthcare_specialties FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_hc_specialties_only BEFORE INSERT OR UPDATE ON public.healthcare_specialties
  FOR EACH ROW EXECUTE FUNCTION public.guard_healthcare_only();
CREATE TRIGGER trg_hc_specialties_updated BEFORE UPDATE ON public.healthcare_specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.healthcare_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  specialty_id uuid REFERENCES public.healthcare_specialties(id) ON DELETE SET NULL,
  name text NOT NULL, phone text, email text, bio text,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_doctors TO authenticated;
GRANT ALL ON public.healthcare_doctors TO service_role;
ALTER TABLE public.healthcare_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hc doctors" ON public.healthcare_doctors FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_hc_doctors_only BEFORE INSERT OR UPDATE ON public.healthcare_doctors
  FOR EACH ROW EXECUTE FUNCTION public.guard_healthcare_only();
CREATE TRIGGER trg_hc_doctors_updated BEFORE UPDATE ON public.healthcare_doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.healthcare_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  intent text NOT NULL DEFAULT 'question' CHECK (intent IN ('appointment','lab_result','question','prescription','other')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','booked','completed','urgent','cancelled')),
  specialty_id uuid REFERENCES public.healthcare_specialties(id) ON DELETE SET NULL,
  assigned_doctor_id uuid REFERENCES public.healthcare_doctors(id) ON DELETE SET NULL,
  urgency_level text DEFAULT 'low' CHECK (urgency_level IN ('low','medium','high','emergency')),
  needs_human boolean NOT NULL DEFAULT false,
  handoff_reason text, reason text, notes text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_leads TO authenticated;
GRANT ALL ON public.healthcare_leads TO service_role;
ALTER TABLE public.healthcare_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hc leads" ON public.healthcare_leads FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_hc_leads_only BEFORE INSERT OR UPDATE ON public.healthcare_leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_healthcare_only();
CREATE TRIGGER trg_hc_leads_updated BEFORE UPDATE ON public.healthcare_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.healthcare_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.healthcare_doctors(id) ON DELETE SET NULL,
  specialty_id uuid REFERENCES public.healthcare_specialties(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.healthcare_leads(id) ON DELETE SET NULL,
  patient_name text NOT NULL, patient_phone text,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled','no_show')),
  urgency_level text DEFAULT 'low' CHECK (urgency_level IN ('low','medium','high','emergency')),
  triage_notes text, reason text, notes text,
  reminder_at timestamptz, reminder_sent_at timestamptz,
  followup_at timestamptz, followup_sent_at timestamptz,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_appointments TO authenticated;
GRANT ALL ON public.healthcare_appointments TO service_role;
ALTER TABLE public.healthcare_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hc appts" ON public.healthcare_appointments FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_hc_appts_only BEFORE INSERT OR UPDATE ON public.healthcare_appointments
  FOR EACH ROW EXECUTE FUNCTION public.guard_healthcare_only();
CREATE TRIGGER trg_hc_appts_updated BEFORE UPDATE ON public.healthcare_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.healthcare_lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  doctor_id uuid REFERENCES public.healthcare_doctors(id) ON DELETE SET NULL,
  patient_name text, result_url text, notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','delivered')),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_lab_results TO authenticated;
GRANT ALL ON public.healthcare_lab_results TO service_role;
ALTER TABLE public.healthcare_lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hc labs" ON public.healthcare_lab_results FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_hc_lab_only BEFORE INSERT OR UPDATE ON public.healthcare_lab_results
  FOR EACH ROW EXECUTE FUNCTION public.guard_healthcare_only();
CREATE TRIGGER trg_hc_lab_updated BEFORE UPDATE ON public.healthcare_lab_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.healthcare_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  bot_tone text NOT NULL DEFAULT 'professional',
  languages text[] NOT NULL DEFAULT ARRAY['en','ar'],
  appointment_duration_min int NOT NULL DEFAULT 30,
  reminder_hours_before int NOT NULL DEFAULT 24,
  followup_hours_after int NOT NULL DEFAULT 48,
  lab_message_template text NOT NULL DEFAULT 'Hello {name}, your lab results are ready. Your doctor will contact you shortly.',
  calendly_url text, google_calendar_url text, google_sheet_url text,
  lab_webhook_url text, crm_webhook_url text, meta_ads_pixel text, human_transfer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.healthcare_settings TO authenticated;
GRANT ALL ON public.healthcare_settings TO service_role;
ALTER TABLE public.healthcare_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage hc settings" ON public.healthcare_settings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_hc_settings_only BEFORE INSERT OR UPDATE ON public.healthcare_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_healthcare_only();
CREATE TRIGGER trg_hc_settings_updated BEFORE UPDATE ON public.healthcare_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.healthcare_appt_close_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.healthcare_leads SET status = 'completed', updated_at = now()
     WHERE id = NEW.lead_id AND status NOT IN ('completed','cancelled');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_hc_appt_close_lead AFTER UPDATE ON public.healthcare_appointments
  FOR EACH ROW EXECUTE FUNCTION public.healthcare_appt_close_lead();

-- Switch test tenant: temporarily disable the vertical-lock trigger.
ALTER TABLE public.tenants DISABLE TRIGGER USER;
UPDATE public.tenants
   SET vertical = 'healthcare', name = 'Test Healthcare'
 WHERE id = 'e3b121f1-449e-42f6-ab3c-988963513d06';
ALTER TABLE public.tenants ENABLE TRIGGER USER;
