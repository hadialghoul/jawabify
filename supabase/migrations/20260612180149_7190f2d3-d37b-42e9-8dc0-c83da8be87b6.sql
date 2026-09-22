
CREATE TABLE public.ai_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  incident_type text NOT NULL CHECK (incident_type IN ('failure','low_confidence','handoff','escalation')),
  reason text,
  user_message text,
  ai_reply text,
  model text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_incidents TO authenticated;
GRANT ALL ON public.ai_incidents TO service_role;

ALTER TABLE public.ai_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view incidents"
ON public.ai_incidents FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Tenant members can update incidents"
ON public.ai_incidents FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Tenant members can delete incidents"
ON public.ai_incidents FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE INDEX ai_incidents_tenant_created_idx
  ON public.ai_incidents (tenant_id, created_at DESC);

CREATE TRIGGER ai_incidents_set_updated_at
BEFORE UPDATE ON public.ai_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
