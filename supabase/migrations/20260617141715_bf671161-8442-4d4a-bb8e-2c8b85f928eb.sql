ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS order_confirmation_template_name text,
  ADD COLUMN IF NOT EXISTS order_confirmation_template_language text NOT NULL DEFAULT 'en_US';