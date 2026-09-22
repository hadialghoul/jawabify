ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS financial_status text,
  ADD COLUMN IF NOT EXISTS fulfillment_status text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS tracking_company text,
  ADD COLUMN IF NOT EXISTS shopify_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_shopify_order_id ON public.orders (shopify_order_id);