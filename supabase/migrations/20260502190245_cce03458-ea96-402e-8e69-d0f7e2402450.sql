ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS is_interested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interest_reason text,
  ADD COLUMN IF NOT EXISTS interested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_interested ON public.contacts (tenant_id, is_interested) WHERE is_interested = true;