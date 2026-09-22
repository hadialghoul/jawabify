
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_replies_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.contacts_apply_tenant_ai_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_enabled boolean;
BEGIN
  SELECT ai_replies_enabled INTO v_enabled FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_enabled = false THEN
    NEW.ai_enabled := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_apply_tenant_ai_default_trg ON public.contacts;
CREATE TRIGGER contacts_apply_tenant_ai_default_trg
BEFORE INSERT ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.contacts_apply_tenant_ai_default();
