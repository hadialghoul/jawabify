CREATE TABLE IF NOT EXISTS public.shopify_pending_installs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.shopify_pending_installs TO service_role;
ALTER TABLE public.shopify_pending_installs ENABLE ROW LEVEL SECURITY;