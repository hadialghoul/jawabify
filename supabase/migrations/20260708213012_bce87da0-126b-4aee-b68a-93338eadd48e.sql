
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shopify_sync_status text,
  ADD COLUMN IF NOT EXISTS shopify_sync_error text,
  ADD COLUMN IF NOT EXISTS shopify_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shopify_last_attempt_at timestamptz;

-- Backfill: rows with a shopify id are synced; rows without one that were never attempted → 'failed' so the retry worker picks them up.
UPDATE public.orders
   SET shopify_sync_status = CASE
     WHEN shopify_order_id IS NOT NULL THEN 'synced'
     ELSE 'failed'
   END
 WHERE shopify_sync_status IS NULL;

-- Index for retry worker scanning failed/unmatched rows quickly.
CREATE INDEX IF NOT EXISTS idx_orders_shopify_retry
  ON public.orders (tenant_id, shopify_last_attempt_at)
  WHERE shopify_order_id IS NULL
    AND shopify_sync_status IN ('failed','unmatched','pending');
