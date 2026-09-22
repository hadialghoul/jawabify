ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'stripe' CHECK (billing_provider IN ('stripe', 'shopify')),
  ADD COLUMN IF NOT EXISTS shopify_subscription_id text,
  ADD COLUMN IF NOT EXISTS shop_domain text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_shopify_sub
  ON public.subscriptions (shopify_subscription_id)
  WHERE shopify_subscription_id IS NOT NULL;

ALTER TABLE public.subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN price_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
      and (
        (billing_provider = 'stripe' and environment = check_env)
        or billing_provider = 'shopify'
      )
      and (
        (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
        or (status = 'canceled' and current_period_end > now())
      )
  );
$$;