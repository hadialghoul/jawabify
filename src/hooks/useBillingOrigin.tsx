import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isEmbeddedShopify, readShopFromUrl } from "@/lib/shopifyEmbedded";

/**
 * Resolves whether the signed-in user's tenant is billed through Shopify
 * (App Store install) or directly via Stripe. Shopify-billed tenants must never
 * see Stripe checkout, the Stripe billing portal, or the test-mode banner
 * (Shopify App Store policy 1.2.1).
 *
 * Anything rendered inside the Shopify Admin is treated as Shopify-billed
 * regardless of the tenant row, so no card path can ever leak into the frame.
 */
export function useBillingOrigin(userId: string | undefined) {
  const embedded = isEmbeddedShopify();
  const [isShopifyBilled, setIsShopifyBilled] = useState(embedded);
  const [shopDomain, setShopDomain] = useState<string | null>(embedded ? readShopFromUrl() : null);
  const [loading, setLoading] = useState(!embedded);

  useEffect(() => {
    if (!userId) {
      setIsShopifyBilled(embedded);
      setShopDomain(embedded ? readShopFromUrl() : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      let { data: tenant } = await supabase
        .from("tenants")
        .select("id, billing_origin")
        .eq("owner_user_id", userId)
        .limit(1)
        .maybeSingle();
      if (!tenant) {
        // Reviewer / staff accounts may be members rather than owners.
        const { data: member } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (member?.tenant_id) {
          const { data: memberTenant } = await supabase
            .from("tenants")
            .select("id, billing_origin")
            .eq("id", member.tenant_id)
            .maybeSingle();
          tenant = memberTenant ?? null;
        }
      }
      if (cancelled) return;
      // Also treat a live Shopify-provider subscription row as Shopify-billed,
      // so legacy tenants whose `billing_origin` was never backfilled still
      // never see a card path.
      let shopify = tenant?.billing_origin === "shopify" || embedded;
      if (!shopify) {
        const { data: shopSub } = await supabase
          .from("subscriptions")
          .select("shop_domain, status")
          .eq("user_id", userId)
          .eq("billing_provider", "shopify")
          .limit(1)
          .maybeSingle();
        if (shopSub) {
          shopify = true;
          if (!cancelled && shopSub.shop_domain) setShopDomain(shopSub.shop_domain);
        }
      }
      setIsShopifyBilled(shopify);
      if (shopify && tenant?.id) {
        const { data: cred } = await supabase
          .from("tenant_credentials")
          .select("shop_domain")
          .eq("tenant_id", tenant.id)
          .eq("provider", "shopify")
          .eq("is_active", true)
          .maybeSingle();
        if (!cancelled && cred?.shop_domain) setShopDomain(cred.shop_domain);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, embedded]);


  return { isShopifyBilled, shopDomain, loading };
}
