
CREATE OR REPLACE FUNCTION public.guard_real_estate_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_tenant_vertical(NEW.tenant_id, 'real_estate');
  RETURN NEW;
END;
$$;

-- agents
CREATE TABLE public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  areas text[] NOT NULL DEFAULT '{}',
  property_types text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_tenant_all" ON public.agents FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_agents_real_estate_only BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.guard_real_estate_only();
CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_agents_tenant ON public.agents(tenant_id);

-- listings
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('buy','rent')),
  property_type text NOT NULL,
  title text NOT NULL,
  description text,
  price numeric(14,2),
  currency text NOT NULL DEFAULT 'USD',
  bedrooms int,
  bathrooms int,
  area_sqm numeric(10,2),
  area_name text,
  region text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','sold','rented','archived')),
  external_source text NOT NULL DEFAULT 'manual' CHECK (external_source IN ('manual','sheet')),
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_tenant_all" ON public.listings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_listings_real_estate_only BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_real_estate_only();
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_listings_tenant_status ON public.listings(tenant_id, status);
CREATE INDEX idx_listings_tenant_kind ON public.listings(tenant_id, kind);
CREATE UNIQUE INDEX idx_listings_external_ref ON public.listings(tenant_id, external_ref) WHERE external_ref IS NOT NULL;

-- leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  intent text CHECK (intent IN ('buy','rent')),
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  preferred_areas text[] NOT NULL DEFAULT '{}',
  property_type text,
  bedrooms_min int,
  score int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','qualified','viewing_booked','closed_won','closed_lost')),
  assigned_agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  notes text,
  needs_human boolean NOT NULL DEFAULT false,
  handoff_reason text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_tenant_all" ON public.leads FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_leads_real_estate_only BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_real_estate_only();
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_leads_tenant_status ON public.leads(tenant_id, status);
CREATE INDEX idx_leads_contact ON public.leads(contact_id);

-- viewings
CREATE TABLE public.viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text,
  scheduled_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled','no_show')),
  notes text,
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  followup_at timestamptz,
  followup_sent_at timestamptz,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewings TO authenticated;
GRANT ALL ON public.viewings TO service_role;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewings_tenant_all" ON public.viewings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_viewings_real_estate_only BEFORE INSERT OR UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.guard_real_estate_only();
CREATE TRIGGER trg_viewings_updated BEFORE UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_viewings_tenant_time ON public.viewings(tenant_id, scheduled_at);
CREATE INDEX idx_viewings_reminder ON public.viewings(reminder_at) WHERE reminder_sent_at IS NULL;
CREATE INDEX idx_viewings_followup ON public.viewings(followup_at) WHERE followup_sent_at IS NULL;

-- real_estate_settings
CREATE TABLE public.real_estate_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  budget_brackets jsonb NOT NULL DEFAULT '[]'::jsonb,
  areas_covered text[] NOT NULL DEFAULT '{}',
  viewing_duration_min int NOT NULL DEFAULT 30,
  followup_hours_after int NOT NULL DEFAULT 24,
  reminder_hours_before int NOT NULL DEFAULT 2,
  languages text[] NOT NULL DEFAULT ARRAY['en','ar','fr'],
  google_sheet_url text,
  calendly_url text,
  crm_webhook_url text,
  human_transfer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.real_estate_settings TO authenticated;
GRANT ALL ON public.real_estate_settings TO service_role;
ALTER TABLE public.real_estate_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "re_settings_tenant_all" ON public.real_estate_settings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_re_settings_real_estate_only BEFORE INSERT OR UPDATE ON public.real_estate_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_real_estate_only();
CREATE TRIGGER trg_re_settings_updated BEFORE UPDATE ON public.real_estate_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
