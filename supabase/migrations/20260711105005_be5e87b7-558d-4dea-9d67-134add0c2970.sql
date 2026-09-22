-- Deduplicate any existing rows before adding unique constraint
DELETE FROM public.tenant_credentials a
USING public.tenant_credentials b
WHERE a.tenant_id = b.tenant_id
  AND a.provider = b.provider
  AND a.ctid < b.ctid;

ALTER TABLE public.tenant_credentials
  ADD CONSTRAINT tenant_credentials_tenant_provider_key UNIQUE (tenant_id, provider);