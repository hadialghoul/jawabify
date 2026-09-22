import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CreditCard, Store } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Card } from '../ui';
import { colors } from '../../theme';
import { WEB_ORIGIN } from '../../config';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function BillingCard() {
  const { user } = useAuth();
  const { subscription, loading, refetch } = useSubscription();
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const status = subscription?.status ?? 'none';
  const isShopify = subscription?.billing_provider === 'shopify';
  const willCancel = subscription?.cancel_at_period_end;
  const periodEnd = subscription?.current_period_end ?? null;

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {
        body: { environment: 'live', returnUrl: `${WEB_ORIGIN}/settings` },
      });
      if (error || !data?.url) throw new Error(error?.message || 'Could not open billing portal');
      await WebBrowser.openBrowserAsync(data.url);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Could not open billing');
    } finally {
      setOpening(false);
    }
  };

  const cancelPlan = async () => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', { body: { environment: 'live' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.current_period_end
          ? `Plan canceled. You keep access until ${formatDate(data.current_period_end)}.`
          : 'Plan canceled at the end of the current period.',
      );
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <CreditCard size={16} color={colors.primary} />
        <Text style={styles.title}>Subscription & billing</Text>
      </View>
      <Text style={styles.sub}>Manage your Jawabify Pro subscription, payment method, and invoices.</Text>
      {loading ? (
        <Text style={styles.sub}>Loading subscription…</Text>
      ) : !subscription ? (
        <>
          <Text style={styles.sub}>You don't have an active subscription.</Text>
          <Button title="Start 7-day free trial" onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/subscribe`)} />
        </>
      ) : (
        <>
          <Text style={styles.plan}>Jawabify Pro · $45/month</Text>
          <View style={styles.row}>
            <Badge
              label={status}
              tone={['active', 'trialing'].includes(status) ? 'success' : status === 'past_due' ? 'danger' : 'muted'}
            />
            {willCancel ? <Badge label="Cancels at period end" tone="amber" /> : null}
            {isShopify ? <Badge label="Shopify" tone="muted" /> : <Badge label="Stripe" tone="muted" />}
          </View>
          {isShopify && subscription.shop_domain ? (
            <View style={styles.row}>
              <Store size={14} color={colors.mutedForeground} />
              <Text style={styles.sub}>{subscription.shop_domain}</Text>
            </View>
          ) : null}
          <Text style={styles.sub}>
            {status === 'trialing' ? 'Trial ends' : willCancel ? 'Access until' : 'Next charge'}: {formatDate(periodEnd)}
          </Text>
          {!isShopify ? (
            <Button title={opening ? 'Opening…' : 'Manage payment & invoices'} loading={opening} variant="outline" onPress={openPortal} />
          ) : null}
          {['active', 'trialing', 'past_due'].includes(status) && !willCancel ? (
            <Button
              title={cancelling ? 'Canceling…' : 'Cancel plan'}
              variant="destructive"
              loading={cancelling}
              onPress={() =>
                Alert.alert('Cancel your subscription?', `Your plan stays active until ${formatDate(periodEnd)}.`, [
                  { text: 'Keep plan', style: 'cancel' },
                  { text: 'Cancel plan', style: 'destructive', onPress: cancelPlan },
                ])
              }
            />
          ) : null}
        </>
      )}
      {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground },
  plan: { fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, color: colors.mutedForeground },
});
