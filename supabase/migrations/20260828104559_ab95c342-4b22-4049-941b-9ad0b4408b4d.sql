ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;