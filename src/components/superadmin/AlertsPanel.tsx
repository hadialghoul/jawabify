import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { AlertTriangle, MessageSquare, RefreshCw, ShoppingBag } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Badge, Button } from '../ui';
import { colors, radius } from '../../theme';

interface AlertsData {
  counts: {
    aiIncidents: number;
    shopifyFails: number;
    campaignFails: number;
    emailFails: number;
    suppressed: number;
    stuckSessions: number;
  };
  tenantMap: Record<string, string>;
  aiIncidents: any[];
  shopifyFails: any[];
  campaignFails: any[];
  emailFails: any[];
  suppressed: any[];
  stuckSessions: any[];
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, empty, children, count }: { title: string; empty: string; children: React.ReactNode; count: number }) {
  return (
    <View style={styles.section}>
      <Text style={styles.h2}>
        {title} ({count})
      </Text>
      {count === 0 ? <Text style={styles.meta}>{empty}</Text> : children}
    </View>
  );
}

export function SuperAdminAlertsPanel() {
  const { session } = useAuth();
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? session?.access_token;
    if (!token) {
      setError('Please sign in again to refresh your admin session.');
      setLoading(false);
      return;
    }
    const { data: res, error: err } = await supabase.functions.invoke('super-admin-alerts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (err) setError(err.message);
    else setData(res as AlertsData);
    setLoading(false);
  }, [session?.access_token]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.danger}>{error}</Text>
        <Button title="Retry" onPress={load} />
      </View>
    );
  }
  if (!data) return null;

  const tName = (id: string | null) => (id && data.tenantMap[id]) || '—';

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <Text style={styles.sub}>System-wide errors, silent fails, and stuck jobs (last 7 days for logs).</Text>
        <Button title="Refresh" variant="outline" icon={<RefreshCw size={14} color={colors.foreground} />} onPress={load} />
      </View>

      <View style={styles.grid}>
        <Stat label="AI incidents (7d)" value={data.counts.aiIncidents} icon={<AlertTriangle size={14} color={colors.destructive} />} />
        <Stat label="Shopify sync fails" value={data.counts.shopifyFails} icon={<ShoppingBag size={14} color={colors.destructive} />} />
        <Stat label="Campaign fails" value={data.counts.campaignFails} icon={<MessageSquare size={14} color={colors.destructive} />} />
        <Stat label="Email fails (7d)" value={data.counts.emailFails} icon={<AlertTriangle size={14} color={colors.destructive} />} />
        <Stat label="Suppressed (7d)" value={data.counts.suppressed} icon={<AlertTriangle size={14} color={colors.amber} />} />
        <Stat label="Stuck sessions" value={data.counts.stuckSessions} icon={<AlertTriangle size={14} color={colors.destructive} />} />
      </View>

      <Section title="AI incidents" empty="No AI incidents." count={data.aiIncidents?.length ?? 0}>
        {(data.aiIncidents || []).map((i) => (
          <View key={i.id} style={styles.card}>
            <View style={styles.row}>
              <Badge label={i.incident_type} tone={i.incident_type === 'failure' ? 'danger' : 'muted'} />
              {i.resolved ? <Badge label="resolved" tone="success" /> : null}
            </View>
            <Text style={styles.meta}>
              {tName(i.tenant_id)} · {format(new Date(i.created_at), 'MMM d, HH:mm')}
            </Text>
            {i.reason ? <Text style={styles.body}>{i.reason}</Text> : null}
            {i.user_message ? <Text style={styles.meta}>User: {i.user_message}</Text> : null}
            {i.ai_reply ? <Text style={styles.meta}>AI: {i.ai_reply}</Text> : null}
          </View>
        ))}
      </Section>

      <Section title="Shopify sync failures" empty="No Shopify sync failures." count={data.shopifyFails?.length ?? 0}>
        {(data.shopifyFails || []).map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.row}>
              <Badge label="failed" tone="danger" />
              <Text style={styles.body}>#{o.order_number ?? String(o.id).slice(0, 8)}</Text>
            </View>
            <Text style={styles.meta}>
              {o.customer_name ?? '—'} · {tName(o.tenant_id)} · attempts: {o.shopify_sync_attempts ?? 0}
            </Text>
            {o.shopify_sync_error ? <Text style={styles.danger}>{o.shopify_sync_error}</Text> : null}
            <Text style={styles.meta}>
              Last try: {o.shopify_last_attempt_at ? format(new Date(o.shopify_last_attempt_at), 'MMM d, HH:mm') : '—'}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Campaign send failures" empty="No campaign failures." count={data.campaignFails?.length ?? 0}>
        {(data.campaignFails || []).map((r, idx) => (
          <View key={r.id || idx} style={styles.card}>
            <View style={styles.row}>
              <Badge label="failed" tone="danger" />
              <Text style={styles.body}>{r.phone_number}</Text>
              {r.error_code ? <Badge label={String(r.error_code)} tone="muted" /> : null}
            </View>
            {r.error ? <Text style={styles.danger}>{r.error}</Text> : null}
            <Text style={styles.meta}>
              Campaign: {r.campaign_id?.slice?.(0, 8)} · attempts: {r.attempts ?? 0}
              {r.last_error_at ? ` · ${format(new Date(r.last_error_at), 'MMM d, HH:mm')}` : ''}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Email send failures" empty="No email failures." count={data.emailFails?.length ?? 0}>
        {(data.emailFails || []).map((e) => (
          <View key={e.id} style={styles.card}>
            <View style={styles.row}>
              <Badge label={e.status} tone="danger" />
              <Text style={styles.body}>{e.recipient_email}</Text>
            </View>
            <Text style={styles.meta}>
              {e.template_name} · {format(new Date(e.created_at), 'MMM d, HH:mm')}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Suppressed emails" empty="No suppressed emails." count={data.suppressed?.length ?? 0}>
        {(data.suppressed || []).map((e, idx) => (
          <View key={e.id || idx} style={styles.card}>
            <Text style={styles.body}>{e.email || e.recipient_email || '—'}</Text>
            <Text style={styles.meta}>{e.reason || e.status || 'suppressed'}</Text>
          </View>
        ))}
      </Section>

      <Section title="Stuck order/flow sessions" empty="No stuck sessions." count={data.stuckSessions?.length ?? 0}>
        {(data.stuckSessions || []).map((s) => (
          <View key={s.id} style={styles.card}>
            <View style={styles.row}>
              <Badge label={s.status || 'stuck'} tone="danger" />
              <Text style={styles.body}>{tName(s.tenant_id)}</Text>
            </View>
            <Text style={styles.meta}>
              {s.flow_key || s.session_type || 'session'} · {s.updated_at ? format(new Date(s.updated_at), 'MMM d, HH:mm') : '—'}
            </Text>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 12, paddingBottom: 24 },
  center: { padding: 24, alignItems: 'center', gap: 12 },
  head: { gap: 8 },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  h2: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  statLabel: { fontSize: 11, color: colors.mutedForeground },
  section: { gap: 8 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  body: { fontSize: 13, fontWeight: '600', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  danger: { fontSize: 12, color: colors.destructive },
});
