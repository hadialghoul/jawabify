import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CreditCard, ShieldCheck, Store } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { invokeErrorMessage } from '../../lib/functionError';
import { actingHeaders } from '../../lib/actingTenant';
import {
  createPortalUrl,
  openStartTrialSession,
  openStripeBillingSession,
  SUBSCRIBE_PLANS,
  type SubscribePlanKey,
} from '../../lib/billingSession';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Card } from '../ui';
import { colors, radius } from '../../theme';

function formatDate(iso: string | null) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function portalEnvs(subscription: { environment?: string | null } | null | undefined): Array<'live' | 'sandbox'> {
  const env = subscription?.environment;
  if (env === 'live' || env === 'sandbox') return [env];
  return ['live', 'sandbox'];
}

const NO_STRIPE_PORTAL_MSG =
  "This plan isn't linked to a Stripe payment method, so there's no invoices portal. Start or upgrade a Stripe subscription to manage payments.";

const NO_SUB_PORTAL_FRIENDLY =
  'No Stripe billing on this account. Use Upgrade to Growth or Start trial to add a payment method.';

const TRIAL_PERKS = [
  'Full access to every feature during trial',
  'No charge for 7 days',
  'Cancel anytime — no questions asked',
] as const;

export function BillingCard({ highlight = false }: { highlight?: boolean }) {
  const { user } = useAuth();
  const { subscription, loading, isGrowth, refetch } = useSubscription();
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [plan, setPlan] = useState<SubscribePlanKey>('starter');
  const status = subscription?.status ?? 'none';
  const isShopify = subscription?.billing_provider === 'shopify';
  const hasStripeCustomer = Boolean(subscription?.stripe_customer_id);
  const willCancel = subscription?.cancel_at_period_end;
  const periodEnd = subscription?.current_period_end ?? null;
  const canUpgradeToGrowth =
    !!subscription && ['active', 'trialing'].includes(status) && !isGrowth;

  const selected = SUBSCRIBE_PLANS[plan];
  const continueLabel = `Continue with ${selected.label} — $${selected.price}/month`;

  const finishBillingSession = async (
    result: Awaited<ReturnType<typeof openStripeBillingSession>>,
    successMessage: string,
  ) => {
    if (result.status === 'cancel') {
      toast.error('Billing was cancelled.');
      return;
    }
    if (result.status === 'dismissed') {
      refetch();
      return;
    }
    toast.success(successMessage);
    refetch();
  };

  const openPortal = async () => {
    setOpening(true);
    try {
      if (subscription?.billing_provider === 'shopify') {
        toast.error(
          'Billing for this store is managed by Shopify. Open Settings \u2192 Apps and sales channels in your Shopify admin.',
        );
        return;
      }

      if (!hasStripeCustomer) {
        toast.error(NO_STRIPE_PORTAL_MSG);
        return;
      }

      const envs = portalEnvs(subscription);
      let lastMessage = 'Could not open billing portal';

      for (const environment of envs) {
        const { url, error } = await createPortalUrl(environment);
        if (url) {
          const result = await openStripeBillingSession(url);
          await finishBillingSession(result, 'Billing updated.');
          return;
        }
        lastMessage = error || lastMessage;
      }

      if (lastMessage.includes('No subscription found') || lastMessage.includes('No Stripe subscription')) {
        toast.error(NO_SUB_PORTAL_FRIENDLY);
      } else {
        toast.error(lastMessage);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not open billing');
    } finally {
      setOpening(false);
    }
  };

  const continueWithPlan = async () => {
    setStarting(true);
    try {
      const result = await openStartTrialSession(selected.priceId);
      await finishBillingSession(result, 'Subscription activated — welcome to Jawabify!');
    } catch (e: any) {
      toast.error(e?.message || 'Could not start trial');
    } finally {
      setStarting(false);
    }
  };

  const cancelPlan = async () => {
    setCancelling(true);
    try {
      const envs = portalEnvs(subscription);
      let lastMessage = 'Could not cancel';
      let lastData: any = null;

      for (const environment of envs) {
        const { data, error } = await supabase.functions.invoke('cancel-subscription', {
          body: { environment },
          headers: actingHeaders(),
        });
        lastData = data;
        if (!error && !data?.error) {
          toast.success(
            data?.current_period_end
              ? `Plan canceled. You keep access until ${formatDate(data.current_period_end)}.`
              : 'Plan canceled at the end of the current period.',
          );
          refetch();
          return;
        }
        lastMessage = await invokeErrorMessage(error, data);
      }

      toast.error(lastMessage || lastData?.error || 'Could not cancel');
    } catch (e: any) {
      toast.error(e?.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  };

  const planLabel = isGrowth
    ? "Jawabify Growth \u00B7 $90/month"
    : "Jawabify Starter \u00B7 $45/month";

  return (
    <Card style={highlight ? styles.highlight : undefined}>
      <View style={styles.head}>
        <CreditCard size={16} color={colors.primary} />
        <Text style={styles.title}>Subscription & billing</Text>
      </View>
      <Text style={styles.sub}>Manage your Jawabify plan, payment method, and invoices.</Text>
      {loading ? (
        <Text style={styles.sub}>Loading subscription\u2026</Text>
      ) : !subscription ? (
        <View style={styles.subscribe}>
          <View style={styles.pill}>
            <ShieldCheck size={14} color={colors.primary} />
            <Text style={styles.pillText}>Final step — start your free trial</Text>
          </View>
          <Text style={styles.hero}>7 days free, then ${selected.price}/month</Text>
          <Text style={styles.sub}>
            Pick your plan and add a payment method. You won't be charged until your 7-day trial ends. Cancel anytime
            from Settings.
          </Text>

          <View style={styles.planRow}>
            {(Object.keys(SUBSCRIBE_PLANS) as SubscribePlanKey[]).map((key) => {
              const p = SUBSCRIBE_PLANS[key];
              const selectedPlan = plan === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPlan(key)}
                  style={[styles.planCard, selectedPlan && styles.planCardSelected]}
                >
                  <Text style={styles.planName}>{p.label}</Text>
                  <Text style={styles.planPrice}>
                    ${p.price}
                    <Text style={styles.planPriceUnit}>/mo</Text>
                  </Text>
                  <Text style={styles.planTrial}>7-day free trial</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.perks}>
            {TRIAL_PERKS.map((line) => (
              <View key={line} style={styles.perkRow}>
                <Check size={16} color={colors.primary} />
                <Text style={styles.perkText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.billedBox}>
            <Text style={styles.billedTitle}>Billed directly by Jawabify</Text>
            <Text style={styles.billedBody}>
              Your subscription is managed and charged by Jawabify, not through Shopify or any third-party marketplace.
            </Text>
          </View>

          <Button
            title={starting ? 'Opening checkout\u2026' : continueLabel}
            loading={starting}
            onPress={continueWithPlan}
          />
        </View>
      ) : (
        <>
          <Text style={styles.plan}>{planLabel}</Text>
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
          {canUpgradeToGrowth ? (
            <>
              <Button
                title={opening ? 'Opening\u2026' : 'Upgrade to Growth'}
                loading={opening}
                onPress={openPortal}
              />
              <Text style={styles.sub}>
                Opens your billing portal so you can switch to Growth ($90/month) without signing in again.
              </Text>
            </>
          ) : null}
          {!isShopify && hasStripeCustomer ? (
            <Button
              title={opening ? 'Opening\u2026' : 'Manage payment & invoices'}
              loading={opening}
              variant="outline"
              onPress={openPortal}
            />
          ) : null}
          {!isShopify && !hasStripeCustomer ? (
            <Text style={styles.sub}>{NO_STRIPE_PORTAL_MSG}</Text>
          ) : null}
          {['active', 'trialing', 'past_due'].includes(status) && !willCancel ? (
            <Button
              title={cancelling ? 'Canceling\u2026' : 'Cancel plan'}
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
  highlight: { borderWidth: 2, borderColor: colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  sub: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  plan: { fontWeight: '700', color: colors.foreground },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, color: colors.mutedForeground },
  subscribe: { gap: 12 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.3)',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  hero: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  planRow: { flexDirection: 'row', gap: 10 },
  planCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 2,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
  },
  planName: { fontSize: 13, fontWeight: '700', color: colors.foreground },
  planPrice: { fontSize: 24, fontWeight: '800', color: colors.foreground },
  planPriceUnit: { fontSize: 13, fontWeight: '500', color: colors.mutedForeground },
  planTrial: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  perks: { gap: 8 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { flex: 1, fontSize: 13, color: colors.mutedForeground },
  billedBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    backgroundColor: colors.primarySoft,
    padding: 12,
    gap: 4,
  },
  billedTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  billedBody: { fontSize: 12, color: colors.primary, lineHeight: 17 },
});
