
-- Modifiers table
CREATE TABLE IF NOT EXISTS public.menu_item_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  max_select integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_modifiers TO authenticated;
GRANT ALL ON public.menu_item_modifiers TO service_role;

ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage modifiers"
  ON public.menu_item_modifiers FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_item ON public.menu_item_modifiers(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_tenant ON public.menu_item_modifiers(tenant_id);

CREATE TRIGGER update_menu_item_modifiers_updated_at
  BEFORE UPDATE ON public.menu_item_modifiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contacts: flow state
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS vertical_flow_state jsonb;

-- Bills: restaurant order fields
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS order_type text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS payment_method text;
