
-- Add a short display_id to orders (4-digit auto-increment)
CREATE SEQUENCE IF NOT EXISTS public.orders_display_id_seq START WITH 1001 INCREMENT BY 1;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS display_id INTEGER UNIQUE DEFAULT nextval('public.orders_display_id_seq');

-- Backfill existing orders
UPDATE public.orders SET display_id = nextval('public.orders_display_id_seq') WHERE display_id IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE public.orders ALTER COLUMN display_id SET NOT NULL;
