
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'en_US',
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_tenant ON public.campaigns(tenant_id, created_at DESC);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members insert campaigns" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  whatsapp_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(campaign_id, status);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view campaign_recipients" ON public.campaign_recipients
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.tenant_id = get_user_tenant_id(auth.uid()))
  );
CREATE POLICY "Tenant members insert campaign_recipients" ON public.campaign_recipients
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.tenant_id = get_user_tenant_id(auth.uid()))
  );
CREATE POLICY "Tenant members update campaign_recipients" ON public.campaign_recipients
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.tenant_id = get_user_tenant_id(auth.uid()))
  );
CREATE POLICY "Tenant members delete campaign_recipients" ON public.campaign_recipients
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_recipients.campaign_id AND c.tenant_id = get_user_tenant_id(auth.uid()))
  );
