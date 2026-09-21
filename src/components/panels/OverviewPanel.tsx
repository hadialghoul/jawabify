import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RefreshCw, Users, MessageSquare, Package, Sparkles, AlertCircle } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { useAnalytics, useTodayStats } from '../hooks/useAppData';

function Stat({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function OverviewPanel() {
  const { data: today, loading: todayLoading, refetch: refetchToday } = useTodayStats();
  const { data, loading, refetch } = useAnalytics();

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
        <View>
          <Text style={styles.h1}>Overview</Text>
          <Text style={styles.sub}>Today at a glance</Text>
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
      <View style={styles.grid}>
        <Stat label="Customers talked" value={today?.contactsTalked ?? 0} icon={<Users size={16} color={colors.primary} />} />
        <Stat label="New contacts" value={today?.newContacts ?? 0} icon={<Sparkles size={16} color={colors.primary} />} />
        <Stat label="Incoming" value={today?.incoming ?? 0} icon={<MessageSquare size={16} color={colors.primary} />} />
        <Stat label="Outgoing" value={today?.outgoing ?? 0} icon={<MessageSquare size={16} color={colors.primary} />} />
        <Stat label="Orders today" value={today?.orders ?? 0} icon={<Package size={16} color={colors.primary} />} />
        <Stat label="Flagged" value={today?.flagged ?? 0} icon={<AlertCircle size={16} color={colors.destructive} />} />
      </View>
      <Text style={[styles.h1, { marginTop: 20 }]}>Last 30 days</Text>
      <View style={styles.grid}>
        <Stat label="Contacts" value={data?.totals.contacts ?? 0} icon={<Users size={16} color={colors.primary} />} />
        <Stat label="Messages" value={data?.totals.messages ?? 0} icon={<MessageSquare size={16} color={colors.primary} />} />
        <Stat label="Orders" value={data?.totals.orders ?? 0} icon={<Package size={16} color={colors.primary} />} />
        <Stat label="Interested" value={data?.totals.interested ?? 0} icon={<Sparkles size={16} color={colors.primary} />} />
        <Stat label="Revenue" value={data?.totals.revenue ?? 0} icon={<Package size={16} color={colors.primary} />} />
        <Stat label="Returning" value={`${data?.totals.returningRate ?? 0}%`} icon={<Users size={16} color={colors.primary} />} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  h1: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, marginTop: 2 },
  refresh: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '47%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  statIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  statLabel: { fontSize: 12, color: colors.mutedForeground, fontWeight: '600' },
});
