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
  user_id?: string | null;
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
  const { user, tenantId, isActingAs } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [plan, setPlan] = useState<'starter' | 'growth' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = async () => {
    if (!user?.id && !tenantId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const live = (rows: SubscriptionRecord[] | null | undefined) =>
      (rows ?? []).filter((s) => s.environment === 'live');
    if (tenantId) {
      const { data: rows } = await supabase.rpc('get_tenant_subscription', { p_tenant_id: tenantId });
      const list = live(rows as SubscriptionRecord[] | null).filter(
        (row) => !(isActingAs && user?.id && row.user_id === user.id),
      );
      setSubscription(list.find(isRecordActive) ?? list[0] ?? null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const ownRows = live(data as SubscriptionRecord[] | null);
    setSubscription(ownRows.find(isRecordActive) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchSub();
  }, [user?.id, tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setPlan(null);
    supabase.rpc('get_tenant_subscription', { p_tenant_id: tenantId }).then(({ data, error }) => {
      if (cancelled) return;
      const rows = ((data as SubscriptionRecord[] | null) ?? []).filter((row) => {
        if (row.environment && row.environment !== 'live') return false;
        if (isActingAs && user?.id && row.user_id === user.id) return false;
        return true;
      });
      const active = rows.find(isRecordActive) ?? null;
      if (error) setPlan('starter');
      else setPlan(isGrowthSubscription(active) ? 'growth' : 'starter');
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId, isActingAs, user?.id]);

  const isGrowth = plan === 'growth';

  return {
    subscription,
    loading: loading || (tenantId != null && plan === null),
    isActive: !!subscription && isRecordActive(subscription),
    isGrowth,
    refetch: fetchSub,
  };
}
