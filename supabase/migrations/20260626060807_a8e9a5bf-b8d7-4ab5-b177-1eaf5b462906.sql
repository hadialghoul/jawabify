
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz;

CREATE INDEX IF NOT EXISTS contacts_tenant_opted_out_idx
  ON public.contacts (tenant_id, opted_out);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS append_opt_out boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS opt_out_variable_index integer;
