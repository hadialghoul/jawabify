ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_needs_human
  ON public.contacts (tenant_id, needs_human)
  WHERE needs_human = true;