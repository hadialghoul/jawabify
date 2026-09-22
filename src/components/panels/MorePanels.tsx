import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Check } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { colors, radius } from '../../theme';
import { Badge, Button } from '../ui';
import { useToast } from '../../hooks/useToast';

interface Incident {
  id: string;
  incident_type: string;
  reason: string | null;
  user_message: string | null;
  ai_reply: string | null;
  resolved: boolean;
  created_at: string;
  contacts?: { name: string | null; phone_number: string | null } | null;
}

export function AIIssuesPanel({ onSelectByPhone }: { onSelectByPhone?: (phone: string) => void }) {
  const { tenantId } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const load = useCallback(async () => {
    if (!tenantId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('ai_incidents' as any)
      .select('*, contacts(name, phone_number)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error(`Failed to load AI issues: ${error.message}`);
    else setItems((data as unknown as Incident[]) || []);
    setLoading(false);
  }, [tenantId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const markResolved = async (id: string, resolved: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, resolved } : i)));
    const { error } = await supabase.from('ai_incidents' as any).update({ resolved }).eq('id', id);
    if (error) toast.error('Could not update issue');
  };

  const filtered = items.filter((i) => (filter === 'all' ? true : !i.resolved));

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <Text style={styles.h1}>AI Issues</Text>
        <View style={styles.row}>
          <Button title="Open" variant={filter === 'open' ? 'primary' : 'outline'} onPress={() => setFilter('open')} />
          <Button title="All" variant={filter === 'all' ? 'primary' : 'outline'} onPress={() => setFilter('all')} />
        </View>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {filtered.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.row}>
            <AlertCircle size={16} color={colors.destructive} />
            <Text style={styles.name}>{item.incident_type.replace('_', ' ')}</Text>
            {item.resolved ? <Badge label="Resolved" tone="success" /> : <Badge label="Open" tone="danger" />}
          </View>
          {item.reason ? <Text style={styles.sub}>{item.reason}</Text> : null}
          {item.user_message ? <Text style={styles.meta}>Customer: {item.user_message}</Text> : null}
          {item.ai_reply ? <Text style={styles.meta}>AI: {item.ai_reply}</Text> : null}
          <View style={styles.row}>
            {item.contacts?.phone_number ? (
              <Button title={item.contacts.name || 'Open chat'} variant="outline" onPress={() => onSelectByPhone?.(item.contacts!.phone_number!)} />
            ) : null}
            <Button
              title={item.resolved ? 'Reopen' : 'Resolve'}
              variant="outline"
              icon={<Check size={14} color={colors.foreground} />}
              onPress={() => markResolved(item.id, !item.resolved)}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function VerticalRecordsPanel({ table, title, fields }: { table: string; title: string; fields: string[] }) {
  const { tenantId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const first = await supabase.from(table as any).select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
      if (first.error) {
        const fallback = await supabase.from(table as any).select('*').eq('tenant_id', tenantId).limit(100);
        setRows(fallback.data || []);
      } else {
        setRows(first.data || []);
      }
      setLoading(false);
    })();
  }, [tenantId, table]);

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={styles.h1}>{title}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {rows.length === 0 && !loading ? <Text style={styles.emptyTitle}>Nothing here yet.</Text> : null}
      {rows.map((row) => (
        <View key={row.id} style={styles.card}>
          {fields.map((f) =>
            row[f] != null ? (
              <Text key={f} style={f === fields[0] ? styles.name : styles.meta}>
                {String(row[f])}
              </Text>
            ) : null,
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 48, gap: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontWeight: '700', color: colors.foreground, textAlign: 'center', marginTop: 24 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6 },
  name: { fontWeight: '700', color: colors.foreground, textTransform: 'capitalize' },
  meta: { fontSize: 12, color: colors.mutedForeground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
