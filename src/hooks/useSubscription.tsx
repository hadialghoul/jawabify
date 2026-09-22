import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


export interface SubscriptionRecord {
  id: string;
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
  billing_provider: "stripe" | "shopify";
  shopify_subscription_id: string | null;
  shop_domain: string | null;
}

function isRecordActive(s: SubscriptionRecord): boolean {
  return (
    (["active", "trialing", "past_due"].includes(s.status) &&
      (!s.current_period_end || new Date(s.current_period_end) > new Date())) ||
    (s.status === "canceled" &&
      !!s.current_period_end &&
      new Date(s.current_period_end) > new Date())
  );
}

export function useSubscription(userId: string | undefined, tenantId?: string | null) {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [tenantActive, setTenantActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setTenantActive(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchSub = async () => {
      // Fetch recent subscription rows across providers/environments and prefer an
      // active one. Environment (Stripe test vs live) must not gate access — the
      // preview build uses test keys while real customers are billed live.
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      const rows = (data as SubscriptionRecord[] | null) ?? [];
      const own = rows.find(isRecordActive) ?? rows[0] ?? null;
      setSubscription(own);

      // Employees (and admins added to someone else's account) have no
      // subscription row of their own — the account owner pays, via Stripe or
      // Shopify. Fall back to a workspace-level check.
      if (tenantId && !(own && isRecordActive(own))) {
        const { data: active } = await supabase.rpc("tenant_subscription_active", {
          p_tenant_id: tenantId,
        });
        if (!cancelled) setTenantActive(!!active);
      } else if (!cancelled) {
        setTenantActive(false);
      }
      if (!cancelled) setLoading(false);
    };

    fetchSub();

    const channel = supabase
      .channel(`subscriptions:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => fetchSub(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, tenantId]);

  const isActive = (!!subscription && isRecordActive(subscription)) || tenantActive;


  return { subscription, loading, isActive };
}

