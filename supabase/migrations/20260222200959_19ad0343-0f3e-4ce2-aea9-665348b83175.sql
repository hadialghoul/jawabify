-- Add shop_domain to tenant_credentials for Shopify integration
ALTER TABLE public.tenant_credentials 
ADD COLUMN shop_domain TEXT;

-- Create an index for faster shop lookups
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_shop_domain ON public.tenant_credentials(shop_domain);

-- Add a comment for clarity
COMMENT ON COLUMN public.tenant_credentials.shop_domain IS 'The .myshopify.com domain for Shopify stores';