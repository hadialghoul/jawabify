
-- Restaurant settings table
CREATE TABLE public.restaurant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  eta_text text DEFAULT '30-45 min',
  daily_specials text,
  opening_hours jsonb DEFAULT '{}'::jsonb,
  max_party_size integer DEFAULT 10,
  reminder_hours_before integer DEFAULT 2,
  kitchen_notify_phone text,
  human_transfer_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_settings TO authenticated;
GRANT ALL ON public.restaurant_settings TO service_role;

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read restaurant_settings"
  ON public.restaurant_settings FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "tenant members write restaurant_settings"
  ON public.restaurant_settings FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_restaurant_settings_updated
  BEFORE UPDATE ON public.restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reservation reminders
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Human handoff flag on bills
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_reason text;

-- Vertical guard: prevent restaurant rows on non-restaurant tenants and vice-versa
CREATE OR REPLACE FUNCTION public.assert_tenant_vertical(p_tenant_id uuid, p_expected text)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v text;
BEGIN
  SELECT vertical INTO v FROM public.tenants WHERE id = p_tenant_id;
  IF v IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'tenant_vertical_mismatch: expected %, got %', p_expected, COALESCE(v,'(null)') USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_restaurant_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_tenant_vertical(NEW.tenant_id, 'restaurant');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bills_restaurant_only ON public.bills;
CREATE TRIGGER trg_bills_restaurant_only BEFORE INSERT OR UPDATE OF tenant_id ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_only();

DROP TRIGGER IF EXISTS trg_reservations_restaurant_only ON public.reservations;
CREATE TRIGGER trg_reservations_restaurant_only BEFORE INSERT OR UPDATE OF tenant_id ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_only();

DROP TRIGGER IF EXISTS trg_menu_items_restaurant_only ON public.menu_items;
CREATE TRIGGER trg_menu_items_restaurant_only BEFORE INSERT OR UPDATE OF tenant_id ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_only();

DROP TRIGGER IF EXISTS trg_restaurant_settings_only ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_only BEFORE INSERT OR UPDATE OF tenant_id ON public.restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_only();
