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
    let own = ((data as SubscriptionRecord[] | null) ?? []).find(isRecordActive) ?? (data as any)?.[0] ?? null;
    if (!own && tenantId) {
      const { data: rows } = await supabase.rpc('get_tenant_subscription', { p_tenant_id: tenantId });
      const list = (rows as SubscriptionRecord[] | null) ?? [];
      own = list.find(isRecordActive) ?? list[0] ?? null;
    }
    setSubscription(own);
    setLoading(false);
  };

  useEffect(() => {
    fetchSub();
  }, [user?.id, tenantId]);

  return { subscription, loading, isActive: !!subscription && isRecordActive(subscription), refetch: fetchSub };
}
