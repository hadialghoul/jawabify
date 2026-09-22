CREATE TABLE IF NOT EXISTS public.shopify_oauth_states (
  state TEXT PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  shop_domain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
  used_at TIMESTAMPTZ
);
GRANT ALL ON public.shopify_oauth_states TO service_role;
ALTER TABLE public.shopify_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shopify_webhook_events (
  webhook_id TEXT PRIMARY KEY,
  topic TEXT,
  shop_domain TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.shopify_webhook_events TO service_role;
ALTER TABLE public.shopify_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS shopify_webhook_events_received_at_idx ON public.shopify_webhook_events (received_at);