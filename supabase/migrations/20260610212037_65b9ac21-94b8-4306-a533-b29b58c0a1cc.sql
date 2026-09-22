
-- ============ Education vertical (isolated from all other verticals) ============

CREATE OR REPLACE FUNCTION public.guard_education_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.assert_tenant_vertical(NEW.tenant_id, 'education'); RETURN NEW; END;
$$;

-- Courses (catalog) -----------------------------------------------------------
CREATE TABLE public.education_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text,
  level text,
  age_group text,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  schedule text,                          -- free text e.g. "Mon/Wed 5–6pm"
  start_date date,
  capacity int NOT NULL DEFAULT 20,
  payment_options text[] NOT NULL DEFAULT ARRAY['full']::text[],   -- full | installment | trial
  trial_available boolean NOT NULL DEFAULT false,
  payment_link_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_courses TO authenticated;
GRANT ALL ON public.education_courses TO service_role;
ALTER TABLE public.education_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage edu courses" ON public.education_courses FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_edu_courses_only BEFORE INSERT OR UPDATE ON public.education_courses
  FOR EACH ROW EXECUTE FUNCTION public.guard_education_only();
CREATE TRIGGER trg_edu_courses_updated BEFORE UPDATE ON public.education_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leads (parent enquiries) ----------------------------------------------------
CREATE TABLE public.education_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  course_id uuid REFERENCES public.education_courses(id) ON DELETE SET NULL,
  student_name text,
  student_age text,
  parent_name text,
  parent_phone text,
  preferred_schedule text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','interested','trial_booked','enrolled','completed','lost')),
  needs_human boolean NOT NULL DEFAULT false,
  handoff_reason text,
  notes text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_leads TO authenticated;
GRANT ALL ON public.education_leads TO service_role;
ALTER TABLE public.education_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage edu leads" ON public.education_leads FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_edu_leads_only BEFORE INSERT OR UPDATE ON public.education_leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_education_only();
CREATE TRIGGER trg_edu_leads_updated BEFORE UPDATE ON public.education_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enrollments ----------------------------------------------------------------
CREATE TABLE public.education_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.education_courses(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.education_leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  student_age text,
  parent_name text,
  parent_phone text,
  plan_type text NOT NULL DEFAULT 'full' CHECK (plan_type IN ('full','installment','trial')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','partial','refunded','failed')),
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','dropped','cancelled')),
  start_date date,
  reminder_at timestamptz, reminder_sent_at timestamptz,
  progress_next_at timestamptz, progress_last_sent_at timestamptz,
  notes text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_enrollments TO authenticated;
GRANT ALL ON public.education_enrollments TO service_role;
ALTER TABLE public.education_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage edu enrollments" ON public.education_enrollments FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_edu_enrollments_only BEFORE INSERT OR UPDATE ON public.education_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.guard_education_only();
CREATE TRIGGER trg_edu_enrollments_updated BEFORE UPDATE ON public.education_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Settings -------------------------------------------------------------------
CREATE TABLE public.education_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  bot_tone text NOT NULL DEFAULT 'friendly',
  languages text[] NOT NULL DEFAULT ARRAY['en','ar','fr']::text[],
  reminder_hours_before int NOT NULL DEFAULT 1,
  day_before_reminder boolean NOT NULL DEFAULT true,
  progress_day_of_week int NOT NULL DEFAULT 5,                  -- 0=Sun..6=Sat (Fri default)
  progress_message_template text NOT NULL DEFAULT
    'Hi {parent}, weekly update on {student}: attended classes, learning is going well. Reply for more.',
  trial_class_minutes int NOT NULL DEFAULT 30,
  enrollment_confirmation_template text NOT NULL DEFAULT
    'Welcome {student}! Your spot in {course} is confirmed. First class on {start_date}.',
  calendly_url text, google_calendar_url text, google_sheet_url text,
  payment_link_template text, crm_webhook_url text,
  meta_ads_pixel text, human_transfer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_settings TO authenticated;
GRANT ALL ON public.education_settings TO service_role;
ALTER TABLE public.education_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage edu settings" ON public.education_settings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE TRIGGER trg_edu_settings_only BEFORE INSERT OR UPDATE ON public.education_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_education_only();
CREATE TRIGGER trg_edu_settings_updated BEFORE UPDATE ON public.education_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- When an enrollment is marked completed, close its lead ----------------------
CREATE OR REPLACE FUNCTION public.education_enrollment_close_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.education_leads SET status = 'completed', updated_at = now()
     WHERE id = NEW.lead_id AND status NOT IN ('completed','lost');
  ELSIF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.education_leads SET status = 'enrolled', updated_at = now()
     WHERE id = NEW.lead_id AND status NOT IN ('completed','lost');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_edu_enrollment_close_lead
  AFTER INSERT OR UPDATE ON public.education_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.education_enrollment_close_lead();

-- Switch test tenant to education (vertical lock trigger needs disabling) ----
ALTER TABLE public.tenants DISABLE TRIGGER USER;
UPDATE public.tenants
   SET vertical = 'education', name = 'Test Education'
 WHERE id = 'e3b121f1-449e-42f6-ab3c-988963513d06';
ALTER TABLE public.tenants ENABLE TRIGGER USER;
