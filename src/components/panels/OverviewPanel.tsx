import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RefreshCw,
  Users,
  MessageSquare,
  Package,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  TrendingUp,
} from 'lucide-react-native';
import { format, subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { colors, radius } from '../../theme';
import { useAnalytics, useTodayStats, type AnalyticsRange } from '../../hooks/useAppData';
import { AreaLineChart, BarChartView, ChartCard, ChartLegend, CHART_COLORS, DonutChart, HorizontalBarChart } from '../charts';

const STATUS_COLORS: Record<string, string> = {
  completed: '#059669',
  processing: '#3B82F6',
  pending: '#D97706',
  cancelled: '#F04444',
};

const PRESETS: { label: string; get: () => AnalyticsRange }[] = [
  { label: 'Today', get: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: '7d', get: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: '30d', get: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: '90d', get: () => ({ from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }) },
  { label: 'Month', get: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
];

function Stat({ label, value, icon, sub }: { label: string; value: number | string; icon: ReactNode; sub?: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function OverviewPanel({ onSelectByPhone }: { onSelectByPhone?: (phone: string) => void }) {
  const [range, setRange] = useState<AnalyticsRange>(() => PRESETS[2].get());
  const { data: today, loading: todayLoading, refetch: refetchToday } = useTodayStats();
  const { data, loading, refetch } = useAnalytics(range);
  const activePreset = PRESETS.find(
    (p) => format(p.get().from, 'yyyy-MM-dd') === format(range.from, 'yyyy-MM-dd') && format(p.get().to, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd'),
  )?.label;
  const rangeLabel =
    format(range.from, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd')
      ? format(range.from, 'MMM d, yyyy')
      : `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`;

  const conversionRate = data && data.totals.contacts > 0 ? Math.round((data.totals.orders / data.totals.contacts) * 100) : 0;
  const responseRate = data && data.totals.incoming > 0 ? Math.round((data.totals.outgoing / data.totals.incoming) * 100) : 0;
  const hourly = useMemo(
    () => (data?.hourlyHeatmap?.length ? data.hourlyHeatmap : Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))),
    [data],
  );
  const orderStatus = useMemo(() => {
    if (data?.ordersByStatus?.length) return data.ordersByStatus;
    if (!data) return [];
    return [
      { name: 'pending', value: data.totals.pendingOrders },
      { name: 'processing', value: data.totals.processingOrders },
      { name: 'completed', value: data.totals.completedOrders },
      { name: 'cancelled', value: data.totals.cancelledOrders },
    ].filter((s) => s.value > 0);
  }, [data]);

  if ((todayLoading && !today) || (loading && !data)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Overview</Text>
          <Text style={styles.sub}>{rangeLabel}</Text>
        </View>
        <Pressable
          onPress={() => {
            refetchToday();
            refetch();
          }}
          style={styles.refresh}
        >
          <RefreshCw size={16} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {PRESETS.map((p) => {
          const on = activePreset === p.label;
          return (
            <Pressable key={p.label} onPress={() => setRange(p.get())} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: colors.primary }]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.todayCard}>
        <Text style={styles.todayTitle}>Today</Text>
        <Text style={styles.sub}>{format(new Date(), 'EEEE, MMM d')} · live snapshot</Text>
        <View style={[styles.grid, { marginTop: 10 }]}>
          <Stat label="Contacts talked" value={today?.contactsTalked ?? 0} icon={<Users size={16} color={colors.primary} />} />
          <Stat label="New contacts" value={today?.newContacts ?? 0} icon={<Sparkles size={16} color={colors.primary} />} />
          <Stat label="Incoming" value={today?.incoming ?? 0} icon={<MessageSquare size={16} color={colors.primary} />} />
          <Stat label="Outgoing" value={today?.outgoing ?? 0} icon={<MessageSquare size={16} color={colors.primary} />} />
          <Stat label="Pending" value={today?.pendingOrders ?? 0} icon={<Clock size={16} color={colors.amber} />} />
          <Stat label="Processing" value={today?.processingOrders ?? 0} icon={<Loader2 size={16} color="#3B82F6" />} />
          <Stat label="Completed" value={today?.completedOrders ?? 0} icon={<CheckCircle2 size={16} color={colors.success} />} />
          <Stat label="Cancelled" value={today?.cancelledOrders ?? 0} icon={<XCircle size={16} color={colors.destructive} />} />
        </View>
      </View>

      <View style={styles.grid}>
        <Stat label="Contacts" value={data?.totals.contacts ?? 0} icon={<Users size={16} color={colors.primary} />} />
        <Stat
          label="Messages"
          value={data?.totals.messages ?? 0}
          sub={`${data?.totals.incoming ?? 0} in · ${data?.totals.outgoing ?? 0} out`}
          icon={<MessageSquare size={16} color={colors.success} />}
        />
        <Stat label="Orders" value={data?.totals.orders ?? 0} sub={`${conversionRate}% of contacts`} icon={<Package size={16} color={colors.amber} />} />
        <Stat label="Reply rate" value={`${responseRate}%`} sub="Outgoing ÷ incoming" icon={<TrendingUp size={16} color="#7C3AED" />} />
      </View>

      <ChartCard title="Message volume" subtitle="Incoming vs. outgoing per day, with order count overlay">
        <AreaLineChart
          data={data?.daily ?? []}
          xKey="label"
          series={[
            { key: 'incoming', color: CHART_COLORS[0], type: 'area' },
            { key: 'outgoing', color: CHART_COLORS[1], type: 'area' },
            { key: 'orders', color: CHART_COLORS[2], type: 'line' },
          ]}
        />
        <ChartLegend
          items={[
            { label: 'Incoming', color: CHART_COLORS[0] },
            { label: 'Outgoing', color: CHART_COLORS[1] },
            { label: 'Orders', color: CHART_COLORS[2] },
          ]}
        />
      </ChartCard>

      <ChartCard title="Orders by status" subtitle="Distribution within selected range">
        {orderStatus.length === 0 ? (
          <Text style={styles.empty}>No orders in this range</Text>
        ) : (
          <DonutChart
            data={orderStatus}
            colors={orderStatus.map((s) => STATUS_COLORS[s.name] || colors.mutedForeground)}
          />
        )}
      </ChartCard>

      <ChartCard title="Busiest hours" subtitle="Incoming messages by hour of day">
        <BarChartView data={hourly} xKey="hour" yKey="count" formatX={(h) => `${h}h`} />
      </ChartCard>

      <ChartCard title="Top products" subtitle="By order count">
        {(data?.topProducts?.length ?? 0) === 0 ? (
          <Text style={styles.empty}>No orders yet</Text>
        ) : (
          <HorizontalBarChart data={data!.topProducts} labelKey="name" valueKey="orders" />
        )}
      </ChartCard>

      <ChartCard title="Most engaged customers" subtitle="By message count">
        {(data?.topCustomers?.length ?? 0) === 0 ? (
          <Text style={styles.empty}>No activity yet</Text>
        ) : (
          (data?.topCustomers ?? []).map((c, i) => (
            <Pressable
              key={c.phone + i}
              onPress={() => c.phone && onSelectByPhone?.(c.phone)}
              style={styles.customer}
            >
              <View style={styles.rank}>
                <Text style={styles.rankText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{c.name}</Text>
                <Text style={styles.statSub}>{c.phone}</Text>
              </View>
              <Text style={styles.statValue}>{c.messages}</Text>
            </Pressable>
          ))
        )}
      </ChartCard>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Returning customer rate</Text>
        <Text style={styles.sub}>Customers who messaged again after placing an order</Text>
        <Text style={[styles.statValue, { marginTop: 8 }]}>{data?.totals.returningRate ?? 0}%</Text>
        <Text style={styles.statSub}>
          {data?.totals.returningCustomers ?? 0} of {data?.totals.customersWithOrders ?? 0} customers
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.min(100, data?.totals.returningRate ?? 0)}%` }]} />
        </View>
      </View>

      {(data?.totals.interested ?? 0) > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.primarySoft, borderColor: 'rgba(79,70,229,0.25)' }]}>
          <Text style={styles.customerName}>
            {data?.totals.interested} customers flagged as interested — open the Interested tab for conversion charts.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16, paddingBottom: 40, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, marginTop: 2, fontSize: 13 },
  refresh: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  presets: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  todayCard: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.2)',
    borderRadius: radius.xl,
    padding: 14,
  },
  todayTitle: { fontSize: 16, fontWeight: '800', color: colors.foreground },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  statIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  statLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '600' },
  statSub: { fontSize: 11, color: colors.mutedForeground },
  empty: { textAlign: 'center', color: colors.mutedForeground, paddingVertical: 20 },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  customerName: { fontWeight: '700', color: colors.foreground },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.foreground },
  barTrack: { height: 8, backgroundColor: colors.muted, borderRadius: 99, overflow: 'hidden', marginTop: 10 },
  barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 99 },
});
