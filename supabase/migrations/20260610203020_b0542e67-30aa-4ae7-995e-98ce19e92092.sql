
-- ====== Wellness vertical schema ======

CREATE OR REPLACE FUNCTION public.guard_wellness_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_tenant_vertical(NEW.tenant_id, 'wellness');
  RETURN NEW;
END;
$$;

-- staff
CREATE TABLE public.wellness_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  specialties text[] NOT NULL DEFAULT '{}',
  bio text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_staff TO authenticated;
GRANT ALL ON public.wellness_staff TO service_role;
ALTER TABLE public.wellness_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_staff_tenant_all" ON public.wellness_staff FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_wstaff_wellness_only BEFORE INSERT OR UPDATE ON public.wellness_staff
  FOR EACH ROW EXECUTE FUNCTION public.guard_wellness_only();
CREATE TRIGGER trg_wstaff_updated BEFORE UPDATE ON public.wellness_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wstaff_tenant ON public.wellness_staff(tenant_id);

-- services
CREATE TABLE public.wellness_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  duration_min int NOT NULL DEFAULT 60,
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_services TO authenticated;
GRANT ALL ON public.wellness_services TO service_role;
ALTER TABLE public.wellness_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_services_tenant_all" ON public.wellness_services FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_wsvc_wellness_only BEFORE INSERT OR UPDATE ON public.wellness_services
  FOR EACH ROW EXECUTE FUNCTION public.guard_wellness_only();
CREATE TRIGGER trg_wsvc_updated BEFORE UPDATE ON public.wellness_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wsvc_tenant ON public.wellness_services(tenant_id);

-- packages
CREATE TABLE public.wellness_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.wellness_services(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sessions_count int NOT NULL DEFAULT 5,
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_packages TO authenticated;
GRANT ALL ON public.wellness_packages TO service_role;
ALTER TABLE public.wellness_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_packages_tenant_all" ON public.wellness_packages FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_wpkg_wellness_only BEFORE INSERT OR UPDATE ON public.wellness_packages
  FOR EACH ROW EXECUTE FUNCTION public.guard_wellness_only();
CREATE TRIGGER trg_wpkg_updated BEFORE UPDATE ON public.wellness_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wpkg_tenant ON public.wellness_packages(tenant_id);

-- leads
CREATE TABLE public.wellness_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','qualified','booked','closed_won','closed_lost')),
  interest text,
  service_id uuid REFERENCES public.wellness_services(id) ON DELETE SET NULL,
  assigned_staff_id uuid REFERENCES public.wellness_staff(id) ON DELETE SET NULL,
  needs_human boolean NOT NULL DEFAULT false,
  handoff_reason text,
  notes text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_leads TO authenticated;
GRANT ALL ON public.wellness_leads TO service_role;
ALTER TABLE public.wellness_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_leads_tenant_all" ON public.wellness_leads FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_wleads_wellness_only BEFORE INSERT OR UPDATE ON public.wellness_leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_wellness_only();
CREATE TRIGGER trg_wleads_updated BEFORE UPDATE ON public.wellness_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wleads_tenant ON public.wellness_leads(tenant_id);
CREATE INDEX idx_wleads_contact ON public.wellness_leads(contact_id);

-- sessions (bookings)
CREATE TABLE public.wellness_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.wellness_services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.wellness_staff(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.wellness_leads(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.wellness_packages(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled','no_show')),
  notes text,
  source text NOT NULL DEFAULT 'ai',
  reminder_at timestamptz,
  followup_at timestamptz,
  reminder_sent_at timestamptz,
  followup_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_sessions TO authenticated;
GRANT ALL ON public.wellness_sessions TO service_role;
ALTER TABLE public.wellness_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_sessions_tenant_all" ON public.wellness_sessions FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_wsess_wellness_only BEFORE INSERT OR UPDATE ON public.wellness_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_wellness_only();
CREATE TRIGGER trg_wsess_updated BEFORE UPDATE ON public.wellness_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_wsess_tenant ON public.wellness_sessions(tenant_id);
CREATE INDEX idx_wsess_scheduled ON public.wellness_sessions(tenant_id, scheduled_at);

-- settings
CREATE TABLE public.wellness_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  bot_tone text NOT NULL DEFAULT 'calm' CHECK (bot_tone IN ('calm','energetic','luxury')),
  languages text[] NOT NULL DEFAULT ARRAY['en','ar','fr'],
  session_duration_min int NOT NULL DEFAULT 60,
  reminder_hours_before int NOT NULL DEFAULT 24,
  second_reminder_hours_before int NOT NULL DEFAULT 2,
  followup_hours_after int NOT NULL DEFAULT 24,
  calendly_url text,
  google_sheet_url text,
  crm_webhook_url text,
  payment_link text,
  human_transfer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_settings TO authenticated;
GRANT ALL ON public.wellness_settings TO service_role;
ALTER TABLE public.wellness_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wellness_settings_tenant_all" ON public.wellness_settings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_wset_wellness_only BEFORE INSERT OR UPDATE ON public.wellness_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_wellness_only();
CREATE TRIGGER trg_wset_updated BEFORE UPDATE ON public.wellness_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-close lead when session completes
CREATE OR REPLACE FUNCTION public.wellness_session_close_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.wellness_leads
       SET status = 'closed_won',
           notes = COALESCE(notes,'') || E'\nSession completed ' || to_char(now(),'YYYY-MM-DD')
     WHERE id = NEW.lead_id
       AND status NOT IN ('closed_won','closed_lost');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_wsess_close_lead AFTER UPDATE ON public.wellness_sessions
  FOR EACH ROW EXECUTE FUNCTION public.wellness_session_close_lead();

-- ====== Switch test tenant to wellness ======
ALTER TABLE public.tenants DISABLE TRIGGER USER;
UPDATE public.tenants
   SET vertical = 'wellness',
       name = 'Test Wellness'
 WHERE id = 'e3b121f1-449e-42f6-ab3c-988963513d06';
ALTER TABLE public.tenants ENABLE TRIGGER USER;

-- Seed a default settings row
INSERT INTO public.wellness_settings (tenant_id) VALUES ('e3b121f1-449e-42f6-ab3c-988963513d06')
ON CONFLICT (tenant_id) DO NOTHING;
