import { supabase } from '@/integrations/supabase/client';
import { readShopFromUrl } from '@/lib/shopifyEmbedded';

/**
 * Attach a Shopify App Store install to the tenant.
 *
 * Shop identity comes from the URL (or an explicit argument) — never from
 * localStorage / cookies, so the flow works in incognito with third-party
 * cookies blocked (Shopify policy 1.1.1).
 * Safe to call on every load: it no-ops when no shop is present.
 */
export async function claimShopifyInstall(
  tenantId: string,
  shop?: string | null,
): Promise<boolean> {
  const shopDomain = shop ?? readShopFromUrl();
  if (!shopDomain) return false;
  try {
    const { data, error } = await supabase.functions.invoke('shopify-claim-install', {
      body: { shop: shopDomain, tenant_id: tenantId },
    });
    if (error) return false;
    return !!data?.connected;
  } catch {
    return false;
  }
}
