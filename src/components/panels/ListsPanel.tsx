import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCheck, Mail, Percent, ShoppingCart, Sparkles, TrendingUp, UserRound, Users } from 'lucide-react-native';
import { format, isToday, isYesterday, subDays, startOfDay } from 'date-fns';
import type { Contact, Order } from '../../types';
import { colors, radius } from '../../theme';
import { Badge, Button, Input } from '../ui';
import { digitsOnly, normalizePhoneQuery, sanitizeQuery } from '../../lib/utils';
import type { FlaggedContact } from '../../hooks/useAppData';
import { AreaLineChart, ChartCard, CHART_COLORS, DonutChart, HorizontalBarChart } from '../charts';

export function CrmPanel({
  contacts,
  orders,
  onSelectContact,
}: {
  contacts: Contact[];
  orders: Order[];
  onSelectContact: (c: Contact) => void;
}) {
  const [query, setQuery] = useState('');
  const ordersByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.contactId) m.set(o.contactId, (m.get(o.contactId) || 0) + 1);
    return m;
  }, [orders]);
  const rows = useMemo(() => {
    const q = sanitizeQuery(query).toLowerCase();
    const phoneQuery = normalizePhoneQuery(query);
    return contacts.filter((c) => {
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        (!!phoneQuery && digitsOnly(c.phoneNumber || '').includes(phoneQuery)) ||
        c.email?.toLowerCase().includes(q)
      );
    });
  }, [contacts, query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <Text style={styles.h1}>CRM</Text>
        <Input placeholder="Search customers" value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item: c }) => (
          <Pressable onPress={() => onSelectContact(c)} style={styles.card}>
            <View style={styles.avatar}>
              <UserRound size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.phoneNumber}</Text>
              {c.email ? (
                <View style={styles.row}>
                  <Mail size={12} color={colors.mutedForeground} />
                  <Text style={styles.meta}>{c.email}</Text>
                </View>
              ) : null}
            </View>
            <Badge label={`${ordersByContact.get(c.id) || 0} orders`} tone="muted" />
          </Pressable>
        )}
      />
    </View>
  );
}

export function InterestedPanel({
  contacts,
  orders,
  onSelectContact,
  onUnflag,
}: {
  contacts: Contact[];
  orders: Order[];
  onSelectContact: (c: Contact) => void;
  onUnflag: (id: string) => void;
}) {
  const interested = useMemo(
    () =>
      contacts
        .filter((c) => c.isInterested)
        .sort((a, b) => (b.interestedAt?.getTime() ?? 0) - (a.interestedAt?.getTime() ?? 0)),
    [contacts],
  );
  const totalInterested = interested.length;
  const phoneSet = useMemo(() => new Set(orders.map((o) => o.customerPhone)), [orders]);
  const converted = interested.filter((c) => phoneSet.has(c.phoneNumber)).length;
  const conversionRate = totalInterested > 0 ? Math.round((converted / totalInterested) * 100) : 0;
  const last7 = interested.filter((c) => c.interestedAt && c.interestedAt >= subDays(new Date(), 7)).length;

  const trendData = useMemo(() => {
    const days: { label: string; date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({ date: d.toISOString(), label: format(d, 'MMM d'), count: 0 });
    }
    interested.forEach((c) => {
      if (!c.interestedAt) return;
      const day = startOfDay(c.interestedAt).toISOString();
      const bucket = days.find((x) => x.date === day);
      if (bucket) bucket.count += 1;
    });
    return days;
  }, [interested]);

  const reasonsData = useMemo(() => {
    const map = new Map<string, number>();
    interested.forEach((c) => {
      const raw = (c.interestReason || 'Unspecified').trim();
      const key = raw.length > 28 ? raw.slice(0, 28) + '…' : raw;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [interested]);

  const conversionData = [
    { name: 'Converted to order', value: converted },
    { name: 'Still interested', value: Math.max(totalInterested - converted, 0) },
  ];

  const formatTime = (d?: Date) => {
    if (!d) return '';
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'dd MMM, HH:mm');
  };

  if (totalInterested === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Sparkles size={40} color={colors.mutedForeground} />
        <Text style={styles.h1}>No interested customers yet</Text>
        <Text style={styles.sub}>When customers ask multiple product questions, the AI flags them here with engagement charts.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
      <Text style={styles.h1}>Interested customers</Text>
      <View style={styles.kpiGrid}>
        <View style={styles.kpi}>
          <Users size={16} color={colors.primary} />
          <Text style={styles.kpiVal}>{totalInterested}</Text>
          <Text style={styles.kpiLabel}>Total interested</Text>
        </View>
        <View style={styles.kpi}>
          <TrendingUp size={16} color={colors.success} />
          <Text style={styles.kpiVal}>{last7}</Text>
          <Text style={styles.kpiLabel}>New (7 days)</Text>
        </View>
        <View style={styles.kpi}>
          <ShoppingCart size={16} color={colors.amber} />
          <Text style={styles.kpiVal}>{converted}</Text>
          <Text style={styles.kpiLabel}>Converted to order</Text>
        </View>
        <View style={styles.kpi}>
          <Percent size={16} color="#7C3AED" />
          <Text style={styles.kpiVal}>{conversionRate}%</Text>
          <Text style={styles.kpiLabel}>Conversion rate</Text>
        </View>
      </View>

      <ChartCard title="Interest trend" subtitle="New interested customers per day (last 14 days)">
        <AreaLineChart data={trendData} xKey="label" series={[{ key: 'count', color: CHART_COLORS[0], type: 'area' }]} />
      </ChartCard>

      <ChartCard title="Conversion" subtitle="Interested → placed order">
        <DonutChart data={conversionData} colors={[CHART_COLORS[1], CHART_COLORS[0]]} />
      </ChartCard>

      <ChartCard title="Top interest reasons" subtitle="What's catching customers' attention">
        {reasonsData.length === 0 ? <Text style={styles.empty}>No reasons yet</Text> : <HorizontalBarChart data={reasonsData} labelKey="name" valueKey="value" />}
      </ChartCard>

      <Text style={[styles.h1, { marginTop: 4 }]}>All interested customers</Text>
      {interested.map((c) => (
        <Pressable key={c.id} onPress={() => onSelectContact(c)} style={styles.card}>
          <Sparkles size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>{c.interestReason || c.phoneNumber}</Text>
            {c.interestedAt ? <Text style={styles.meta}>{formatTime(c.interestedAt)}</Text> : null}
          </View>
          <Button title="Unflag" variant="outline" onPress={() => onUnflag(c.id)} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function FlaggedPanel({
  flagged,
  onOpen,
  onResolve,
  onUnresolve,
}: {
  flagged: FlaggedContact[];
  onOpen: (phone: string) => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
}) {
  const unresolved = flagged.filter((c) => c.needsHuman);
  const resolved = flagged.filter((c) => !c.needsHuman);
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.h1}>Flagged for human</Text>
      <Text style={styles.sub}>Customers the AI escalated.</Text>
      <Text style={styles.section}>Unresolved ({unresolved.length})</Text>
      {unresolved.length === 0 ? <Text style={styles.empty}>No unresolved flagged conversations.</Text> : null}
      {unresolved.map((c) => (
        <View key={c.id} style={styles.card}>
          <AlertCircle size={18} color={colors.destructive} />
          <Pressable onPress={() => onOpen(c.phoneNumber)} style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>{c.phoneNumber}</Text>
          </Pressable>
          <Button title="Resolve" variant="outline" onPress={() => onResolve(c.id)} />
        </View>
      ))}
      <Text style={styles.section}>Resolved ({resolved.length})</Text>
      {resolved.map((c) => (
        <View key={c.id} style={[styles.card, { opacity: 0.8 }]}>
          <CheckCheck size={18} color={colors.primary} />
          <Pressable onPress={() => onOpen(c.phoneNumber)} style={{ flex: 1 }}>
            <Text style={[styles.name, { textDecorationLine: 'line-through' }]}>{c.name}</Text>
            <Text style={styles.meta}>{c.phoneNumber}</Text>
          </Pressable>
          <Button title="Unresolve" variant="outline" onPress={() => onUnresolve(c.id)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, gap: 10 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { textAlign: 'center', color: colors.mutedForeground, padding: 24 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: colors.destructive },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
  },
  kpiVal: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  kpiLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '600' },
});
