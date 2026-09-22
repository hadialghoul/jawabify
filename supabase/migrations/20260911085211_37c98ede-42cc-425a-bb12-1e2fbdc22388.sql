
-- Keep tenants.ai_replies_enabled in sync when the per-tenant setting row changes.
CREATE OR REPLACE FUNCTION public.sync_tenant_ai_flag_from_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'ai_replies_enabled' AND NEW.tenant_id IS NOT NULL THEN
    UPDATE public.tenants
       SET ai_replies_enabled = (NEW.value = 'true'::jsonb OR NEW.value = '"true"'::jsonb)
     WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tenant_ai_flag ON public.app_settings;
CREATE TRIGGER trg_sync_tenant_ai_flag
AFTER INSERT OR UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_tenant_ai_flag_from_settings();

-- Reverse direction: keep the setting row in sync when the tenant flag changes.
CREATE OR REPLACE FUNCTION public.sync_settings_ai_flag_from_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ai_replies_enabled IS DISTINCT FROM OLD.ai_replies_enabled THEN
    UPDATE public.app_settings
       SET value = to_jsonb(NEW.ai_replies_enabled), updated_at = now()
     WHERE tenant_id = NEW.id AND key = 'ai_replies_enabled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_settings_ai_flag ON public.tenants;
CREATE TRIGGER trg_sync_settings_ai_flag
AFTER UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.sync_settings_ai_flag_from_tenant();

-- Backfill: the settings row is the source of truth where it exists.
UPDATE public.tenants t
   SET ai_replies_enabled = (s.value = 'true'::jsonb OR s.value = '"true"'::jsonb)
  FROM public.app_settings s
 WHERE s.tenant_id = t.id
   AND s.key = 'ai_replies_enabled'
   AND t.ai_replies_enabled IS DISTINCT FROM (s.value = 'true'::jsonb OR s.value = '"true"'::jsonb);
