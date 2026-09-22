ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS billing_origin text NOT NULL DEFAULT 'direct';

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_billing_origin_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_billing_origin_check CHECK (billing_origin IN ('direct','shopify'));

ALTER TABLE public.shopify_pending_installs
  ADD COLUMN IF NOT EXISTS install_source text NOT NULL DEFAULT 'app_store';

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_shopify_subscription_id_key
  ON public.subscriptions (shopify_subscription_id)
  WHERE shopify_subscription_id IS NOT NULL;