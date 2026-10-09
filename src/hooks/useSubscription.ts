import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface SubscriptionRecord {
  id: string;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id?: string | null;
  billing_provider?: 'stripe' | 'shopify' | string | null;
  shopify_subscription_id?: string | null;
  shop_domain?: string | null;
  environment?: string | null;
}


const GROWTH_PRICE_IDS = new Set(['jawabify_growth_monthly']);

export function isGrowthSubscription(sub: SubscriptionRecord | null | undefined): boolean {
  if (!sub) return false;
  const price = (sub.price_id || '').toLowerCase();
  if (GROWTH_PRICE_IDS.has(price) || price.includes('growth')) return true;
  // Shopify sometimes stores plan in shopify fields
  const shop = String((sub as any).shopify_subscription_id || (sub as any).shop_domain || '');
  void shop;
  return false; // price_id is the source of truth
}

function isRecordActive(s: SubscriptionRecord): boolean {
  return (
    (['active', 'trialing', 'past_due'].includes(s.status) &&
      (!s.current_period_end || new Date(s.current_period_end) > new Date())) ||
    (s.status === 'canceled' && !!s.current_period_end && new Date(s.current_period_end) > new Date())
  );
}

export function useSubscription() {
  const { user, tenantId } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const live = (rows: SubscriptionRecord[] | null | undefined) =>
      (rows ?? []).filter((s) => s.environment === 'live');
    const ownRows = live(data as SubscriptionRecord[] | null);
    let own = ownRows.find(isRecordActive) ?? null;
    if (!own && tenantId) {
      const { data: rows } = await supabase.rpc('get_tenant_subscription', { p_tenant_id: tenantId });
      const list = live(rows as SubscriptionRecord[] | null);
      own = list.find(isRecordActive) ?? null;
    }
    setSubscription(own);
    setLoading(false);
  };

  useEffect(() => {
    fetchSub();
  }, [user?.id, tenantId]);

  return {
    subscription,
    loading,
    isActive: !!subscription && isRecordActive(subscription),
    isGrowth: isGrowthSubscription(subscription),
    refetch: fetchSub,
  };
}
