ALTER TABLE public.wellness_settings
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Beirut',
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb;