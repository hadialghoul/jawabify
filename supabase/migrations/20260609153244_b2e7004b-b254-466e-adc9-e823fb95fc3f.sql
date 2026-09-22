ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_tenant_key_unique ON public.app_settings (tenant_id, key);