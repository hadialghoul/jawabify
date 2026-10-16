import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { refreshInsights } from '../../lib/jawabifyOctUpdates';
import { Button } from '../ui';
import { colors } from '../../theme';

const LABELS: Record<string, string> = {
  summary: 'Summary',
  interests: 'Interests',
  orders: 'Orders',
  address: 'Address',
  next_step: 'Next step',
  nextStep: 'Next step',
};

function displayValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

export function CustomerInsightsCard({ contactId }: { contactId: string }) {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apply = (row: { profile?: Record<string, unknown> | null; updated_at?: string | null } | null) => {
    setProfile(row?.profile && typeof row.profile === 'object' ? row.profile : null);
    setUpdatedAt(row?.updated_at ?? null);
  };

  const loadCached = async () => {
    const { data, error: readError } = await supabase
      .from('enterprise_customer_profiles')
      .select('profile, updated_at')
      .eq('contact_id', contactId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    apply(data as any);
    return data;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    loadCached()
      .catch((e: any) => {
        if (!cancelled) setError(e?.message || 'Could not load insights');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await refreshInsights(contactId);
      apply(data);
    } catch (e: any) {
      setError(e?.message || 'Could not refresh insights');
    } finally {
      setLoading(false);
    }
  };

  const entries = profile
    ? Object.entries(profile).filter(([, value]) => displayValue(value))
    : [];
  const ordered = [
    ...['summary', 'interests', 'orders', 'address', 'next_step', 'nextStep']
      .map((key) => entries.find(([entryKey]) => entryKey === key))
      .filter(Boolean),
    ...entries.filter(([key]) => !['summary', 'interests', 'orders', 'address', 'next_step', 'nextStep'].includes(key)),
  ] as [string, unknown][];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>AI Customer Insights</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && ordered.length === 0 ? (
        <Text style={styles.muted}>No insights yet. Refresh to analyze this customer.</Text>
      ) : null}
      {ordered.map(([key, value]) => {
        const text = displayValue(value);
        return (
          <View key={key}>
            <Text style={styles.label}>{LABELS[key] || key.replace(/_/g, ' ')}</Text>
            <Text style={[styles.value, isArabic(text) && styles.rtl]}>{text}</Text>
          </View>
        );
      })}
      {updatedAt ? (
        <Text style={styles.muted}>Updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}</Text>
      ) : null}
      <Button title={loading ? 'Refreshing…' : 'Refresh'} variant="outline" onPress={refresh} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  title: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  label: { fontSize: 12, fontWeight: '700', color: colors.mutedForeground, textTransform: 'capitalize' },
  value: { fontSize: 15, color: colors.foreground, lineHeight: 20 },
  muted: { fontSize: 13, color: colors.mutedForeground },
  error: { fontSize: 14, color: colors.destructive },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
});
