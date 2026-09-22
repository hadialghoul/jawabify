
CREATE TABLE public.order_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'picking_product',
  draft jsonb NOT NULL DEFAULT '{"items":[],"delivery_fee":3,"total":0}'::jsonb,
  pending_hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  last_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_sessions TO authenticated;
GRANT ALL ON public.order_sessions TO service_role;

ALTER TABLE public.order_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read their sessions"
  ON public.order_sessions FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant members modify their sessions"
  ON public.order_sessions FOR UPDATE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members delete their sessions"
  ON public.order_sessions FOR DELETE
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE UNIQUE INDEX order_sessions_one_active_per_contact
  ON public.order_sessions (tenant_id, contact_id)
  WHERE state NOT IN ('done', 'cancelled');

CREATE INDEX order_sessions_expires_at_idx
  ON public.order_sessions (expires_at)
  WHERE state NOT IN ('done', 'cancelled');

CREATE TRIGGER update_order_sessions_updated_at
  BEFORE UPDATE ON public.order_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add app setting flags for guided flow
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS guided_order_flow_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guided_order_flow_ai_hints_enabled boolean NOT NULL DEFAULT true;

-- Track source of programmatic orders on the orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS line_items jsonb;
