ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS handle text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'whatsapp';

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_platform_check CHECK (platform IN ('whatsapp','instagram'));

ALTER TABLE public.messages
  ADD CONSTRAINT messages_platform_check CHECK (platform IN ('whatsapp','instagram'));

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_platform_updated
  ON public.contacts (tenant_id, platform, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_tenant_platform_external_key
  ON public.contacts (tenant_id, platform, external_id)
  WHERE tenant_id IS NOT NULL AND external_id IS NOT NULL;

ALTER TABLE public.tenant_credentials
  ADD COLUMN IF NOT EXISTS ig_account_id text,
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS ig_username text;

CREATE INDEX IF NOT EXISTS idx_tenant_credentials_ig_account
  ON public.tenant_credentials (ig_account_id);