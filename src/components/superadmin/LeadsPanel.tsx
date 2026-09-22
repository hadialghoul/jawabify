import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { Badge, Button } from '../ui';
import { colors, radius } from '../../theme';

export function SuperAdminLeadsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'form' | 'popup'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('consultation_leads').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) setErr(error.message);
    else {
      setErr(null);
      setRows(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdForm = (r: any) => String(r.source_path || '').includes('/form');
  const formCount = useMemo(() => rows.filter(isAdForm).length, [rows]);
  const visible = rows.filter((r) => (filter === 'all' ? true : filter === 'form' ? isAdForm(r) : !isAdForm(r)));

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Consultation leads</Text>
          <Text style={styles.meta}>Ad form submissions and site popup submissions</Text>
        </View>
        <Button title="Refresh" variant="outline" icon={<RefreshCw size={14} color={colors.foreground} />} onPress={load} />
      </View>

      <View style={styles.row}>
        <Button title={`All (${rows.length})`} variant={filter === 'all' ? 'primary' : 'outline'} onPress={() => setFilter('all')} />
        <Button title={`Ad form (${formCount})`} variant={filter === 'form' ? 'primary' : 'outline'} onPress={() => setFilter('form')} />
        <Button title={`Popup (${rows.length - formCount})`} variant={filter === 'popup' ? 'primary' : 'outline'} onPress={() => setFilter('popup')} />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {err ? <Text style={styles.danger}>{err}</Text> : null}
      {!loading && visible.length === 0 ? <Text style={styles.meta}>No leads yet.</Text> : null}

      {visible.map((r) => (
        <View key={r.id} style={styles.card}>
          <View style={styles.row}>
            <Badge label={isAdForm(r) ? 'Ad form' : 'Popup'} tone={isAdForm(r) ? 'primary' : 'muted'} />
            <Text style={styles.meta}>{format(new Date(r.created_at), 'MMM d, HH:mm')}</Text>
          </View>
          <Text style={styles.name}>{r.full_name || r.name || 'Lead'}</Text>
          {r.email ? (
            <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${r.email}`)}>
              {r.email}
            </Text>
          ) : null}
          {r.phone ? (
            <View style={styles.row}>
              <Text style={styles.link} onPress={() => Linking.openURL(`tel:${r.phone}`)}>
                {r.phone}
              </Text>
              <Button
                title="WhatsApp"
                variant="outline"
                onPress={() => Linking.openURL(`https://wa.me/${String(r.phone).replace(/[^0-9]/g, '')}`)}
              />
            </View>
          ) : null}
          {r.source_path ? <Text style={styles.meta}>{r.source_path}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 10, paddingBottom: 24 },
  head: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  link: { color: colors.primary, fontWeight: '600' },
  danger: { color: colors.destructive },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6 },
});
