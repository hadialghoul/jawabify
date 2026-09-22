import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ExternalLink, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Input } from '../ui';
import { colors, radius } from '../../theme';

interface Charge {
  id: string;
  environment: 'live' | 'sandbox';
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  refunded: boolean;
  description: string | null;
  created: string | null;
  receipt_url: string | null;
  failure_message: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  card: { brand: string; last4: string } | null;
}

interface StripeSub {
  id: string;
  environment: 'live' | 'sandbox';
  status: string;
  plan: string | null;
  amount: number;
  currency: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  customer_id: string | null;
  customer_email: string | null;
}

const money = (amount: number, currency: string) => `${Number(amount).toFixed(2)} ${String(currency || '').toUpperCase()}`;

export function SuperAdminPaymentsPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [subs, setSubs] = useState<StripeSub[]>([]);
  const [errors, setErrors] = useState<{ environment: string; message: string }[]>([]);
  const [envFilter, setEnvFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-payments', { body: { limit: 100 } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setCharges((data as any)?.charges ?? []);
      setSubs((data as any)?.subscriptions ?? []);
      setErrors((data as any)?.errors ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load payments');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: string, body: Record<string, unknown>, successMsg: string) => {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-payments', { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(typeof (data as any).error === 'string' ? (data as any).error : 'Action failed');
      toast.success(successMsg);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const term = q.trim().toLowerCase();
  const match = (values: (string | null | undefined)[]) => !term || values.some((v) => (v ?? '').toLowerCase().includes(term));

  const visibleCharges = useMemo(
    () =>
      charges
        .filter((c) => envFilter === 'all' || c.environment === envFilter)
        .filter((c) => match([c.customer_email, c.customer_name, c.customer_id, c.id])),
    [charges, envFilter, term],
  );

  const visibleSubs = useMemo(
    () =>
      subs
        .filter((s) => envFilter === 'all' || s.environment === envFilter)
        .filter((s) => match([s.customer_email, s.customer_id, s.id, s.plan])),
    [subs, envFilter, term],
  );

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.row}>
        {(['all', 'live', 'sandbox'] as const).map((e) => (
          <Button key={e} title={e === 'all' ? 'All' : e === 'live' ? 'Live' : 'Test'} variant={envFilter === e ? 'primary' : 'outline'} onPress={() => setEnvFilter(e)} />
        ))}
        <Pressable onPress={load} style={styles.icon}>
          <RefreshCw size={16} color={colors.primary} />
        </Pressable>
      </View>
      <Input placeholder="Search email, customer or charge id…" value={q} onChangeText={setQ} />

      {errors.map((e) => (
        <Text key={e.environment} style={styles.warn}>
          {e.environment} mode unavailable: {e.message}
        </Text>
      ))}

      <Text style={styles.h2}>Charges ({visibleCharges.length})</Text>
      {loading && charges.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && visibleCharges.length === 0 ? <Text style={styles.meta}>No charges found.</Text> : null}
      {visibleCharges.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{money(c.amount, c.currency)}</Text>
            <Badge label={c.status} tone={c.status === 'succeeded' ? 'success' : 'danger'} />
            <Badge label={c.environment} tone="muted" />
            {c.refunded ? <Badge label="refunded" tone="amber" /> : null}
          </View>
          <Text style={styles.meta}>{c.customer_email ?? c.customer_name ?? c.customer_id ?? 'Unknown customer'}</Text>
          <Text style={styles.meta}>
            {c.card ? `${c.card.brand} ····${c.card.last4} · ` : ''}
            {c.created ? format(new Date(c.created), 'MMM d, yyyy HH:mm') : '—'}
          </Text>
          {c.description ? <Text style={styles.meta}>{c.description}</Text> : null}
          {c.failure_message ? <Text style={styles.danger}>{c.failure_message}</Text> : null}
          <View style={styles.row}>
            {c.receipt_url ? (
              <Button
                title="Receipt"
                variant="outline"
                icon={<ExternalLink size={14} color={colors.foreground} />}
                onPress={() => Linking.openURL(c.receipt_url!)}
              />
            ) : null}
            {c.status === 'succeeded' && !c.refunded ? (
              <Button
                title={busy === c.id ? 'Refunding…' : 'Refund'}
                variant="destructive"
                loading={busy === c.id}
                onPress={() =>
                  Alert.alert('Refund charge?', `Refund ${money(c.amount, c.currency)} to ${c.customer_email ?? c.customer_id}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Refund',
                      style: 'destructive',
                      onPress: () => runAction(c.id, { action: 'refund', environment: c.environment, charge_id: c.id }, 'Refund issued'),
                    },
                  ])
                }
              />
            ) : null}
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Stripe subscriptions ({visibleSubs.length})</Text>
      {visibleSubs.length === 0 ? <Text style={styles.meta}>No subscriptions in Stripe.</Text> : null}
      {visibleSubs.map((s) => (
        <View key={s.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name}>{s.customer_email ?? s.customer_id}</Text>
            <Badge label={s.status} tone={['active', 'trialing'].includes(s.status) ? 'success' : 'muted'} />
            <Badge label={s.environment} tone="muted" />
            {s.cancel_at_period_end ? <Badge label="cancels" tone="danger" /> : null}
          </View>
          <Text style={styles.meta}>
            {s.plan ?? '—'} · {money(s.amount, s.currency)}
            {s.current_period_end ? ` · renews ${format(new Date(s.current_period_end), 'MMM d, yyyy')}` : ''}
          </Text>
          {!['canceled', 'incomplete_expired'].includes(s.status) ? (
            <View style={styles.row}>
              <Button
                title="Free days"
                variant="outline"
                loading={busy === s.id}
                onPress={() =>
                  Alert.alert(`Free days for ${s.customer_email ?? s.customer_id}`, 'How many free days?', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: '30 days',
                      onPress: () =>
                        runAction(s.id, { action: 'extend_trial', environment: s.environment, subscription_id: s.id, days: 30 }, 'Free period extended by 30 days'),
                    },
                    {
                      text: '60 days',
                      onPress: () =>
                        runAction(s.id, { action: 'extend_trial', environment: s.environment, subscription_id: s.id, days: 60 }, 'Free period extended by 60 days'),
                    },
                  ])
                }
              />
              <Button
                title="Cancel"
                variant="outline"
                loading={busy === s.id}
                onPress={() =>
                  Alert.alert('Cancel subscription?', `Cancel for ${s.customer_email ?? s.customer_id}?`, [
                    { text: 'No', style: 'cancel' },
                    {
                      text: 'Cancel sub',
                      style: 'destructive',
                      onPress: () => runAction(s.id, { action: 'cancel_subscription', environment: s.environment, subscription_id: s.id }, 'Subscription canceled'),
                    },
                  ])
                }
              />
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 10, paddingBottom: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  h2: { fontSize: 16, fontWeight: '800', color: colors.foreground, marginTop: 8 },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  danger: { fontSize: 12, color: colors.destructive },
  warn: { fontSize: 12, color: colors.amber, backgroundColor: colors.amberSoft, padding: 10, borderRadius: radius.md },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
