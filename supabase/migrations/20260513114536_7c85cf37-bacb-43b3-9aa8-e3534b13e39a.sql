ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;