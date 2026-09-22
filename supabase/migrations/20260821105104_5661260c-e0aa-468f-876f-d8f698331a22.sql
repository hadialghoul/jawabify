ALTER TABLE public.tenant_credentials
  ADD COLUMN IF NOT EXISTS install_source text NOT NULL DEFAULT 'settings';

ALTER TABLE public.tenant_credentials
  DROP CONSTRAINT IF EXISTS tenant_credentials_install_source_check;
ALTER TABLE public.tenant_credentials
  ADD CONSTRAINT tenant_credentials_install_source_check CHECK (install_source IN ('settings','app_store'));

GRANT SELECT ON public.tenants TO authenticated;
GRANT UPDATE (billing_origin) ON public.tenants TO service_role;