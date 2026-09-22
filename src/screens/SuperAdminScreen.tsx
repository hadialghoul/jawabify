import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CreditCard,
  Inbox,
  LogOut,
  Mail,
  Megaphone,
  RefreshCw,
  Send,
  Settings as SettingsIcon,
  TrendingUp,
  UserRound,
  Users,
  Eye,
  Trash2,
} from 'lucide-react-native';
import { format, startOfDay, eachDayOfInterval, subDays } from 'date-fns';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Badge, Button, Input } from '../components/ui';
import { colors, radius } from '../theme';
import { WEB_ORIGIN } from '../config';
import { ScreenHeader } from '../components/ScreenHeader';
import { AreaLineChart, BarChartView, ChartCard, ChartLegend, CHART_COLORS, DonutChart, HorizontalBarChart } from '../components/charts';
import { SuperAdminInbox } from '../components/superadmin/SuperAdminInbox';
import { SuperAdminPaymentsPanel } from '../components/superadmin/PaymentsPanel';
import { SuperAdminAlertsPanel } from '../components/superadmin/AlertsPanel';
import { SuperAdminBroadcastPanel } from '../components/superadmin/BroadcastPanel';
import { SuperAdminLeadsPanel } from '../components/superadmin/LeadsPanel';
import { invalidateCache } from '../lib/dataCache';

type AdminView =
  | 'analytics'
  | 'users'
  | 'tenants'
  | 'subscriptions'
  | 'payments'
  | 'alerts'
  | 'messages'
  | 'broadcast'
  | 'campaigns'
  | 'leads';

const TABS: { id: AdminView; label: string; icon: typeof Users }[] = [
  { id: 'analytics', label: 'Overview', icon: TrendingUp },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'tenants', label: 'Tenants', icon: Building2 },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'messages', label: 'Inbox', icon: Inbox },
  { id: 'broadcast', label: 'Broadcast', icon: Send },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'leads', label: 'Leads', icon: Mail },
];

interface Overview {
  tenants: any[];
  members: any[];
  profiles: any[];
  creds: any[];
  subscriptions: any[];
  emailMap: Record<string, { email: string | null; last_sign_in_at: string | null; created_at: string }>;
  counts: Record<string, { contacts: number; messages: number }>;
  timeseries: {
    messages: { created_at: string }[];
    contacts: { created_at: string }[];
    signups: { created_at: string }[];
  };
  totalAuthUsers: number;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.meta}>{hint}</Text> : null}
    </View>
  );
}

export function SuperAdminScreen({
  onOpenSettings,
  onOpenAccount,
}: {
  onOpenSettings: () => void;
  onOpenAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { session, isSuperAdmin, signOut, startActingAs } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<AdminView>('analytics');
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? session?.access_token;
    if (!token) {
      setError('Please sign in again to refresh your admin session.');
      setLoading(false);
      return;
    }
    const { data: res, error: err } = await supabase.functions.invoke('super-admin-overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (err) setError(err.message);
    else setData(res as Overview);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) loadOverview();
  }, [isSuperAdmin, session?.access_token]);

  useEffect(() => {
    if (view === 'payments') {
      supabase.functions.invoke('super-admin-payments', { body: { limit: 100 } }).then(({ data: res }) => {
        setPayments(res?.charges ?? []);
      });
    }
    if (view === 'alerts') {
      supabase.auth.getSession().then(({ data: sessionData }) => {
        const token = sessionData.session?.access_token;
        if (!token) return;
        supabase.functions
          .invoke('super-admin-alerts', { headers: { Authorization: `Bearer ${token}` } })
          .then(({ data: res }) => setAlerts(res));
      });
    }
    if (view === 'leads') {
      supabase
        .from('consultation_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
        .then(({ data: rows }) => setLeads(rows ?? []));
    }
    if (view === 'campaigns') {
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }).limit(50).then(({ data: rows }) => {
        setCampaigns(rows ?? []);
      });
    }
  }, [view]);

  const manage = (tenantId: string | null, name: string) => {
    if (!tenantId) {
      toast.error('No account to manage - this user has no tenant yet');
      return;
    }
    invalidateCache();
    startActingAs(tenantId, name);
    toast.success('Managing ' + name);
  };

  const grantDays = (userId: string | null, tenantName: string) => {
    if (!userId) return;
    const apply = async (days: number) => {
      const { error: err } = await supabase.functions.invoke('super-admin-payments', {
        body: { action: 'grant_free_access', user_id: userId, days },
      });
      if (err) toast.error(err.message);
      else toast.success(`${tenantName} has ${days} free days`);
    };
    Alert.alert(`Free days for ${tenantName}`, 'How many free days should this account get?', [
      { text: 'Cancel', style: 'cancel' },
      { text: '7 days', onPress: () => apply(7) },
      { text: '30 days', onPress: () => apply(30) },
    ]);
  };

  const activeSubs = (data?.subscriptions ?? []).filter(
    (s) => ['active', 'trialing'].includes(s.status) && (!s.current_period_end || new Date(s.current_period_end) > new Date()),
  );
  const totalContacts = Object.values(data?.counts ?? {}).reduce((s, c) => s + c.contacts, 0);
  const totalMessages = Object.values(data?.counts ?? {}).reduce((s, c) => s + c.messages, 0);

  const users = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.emailMap).map(([userId, info]) => {
      const profile = data.profiles.find((p: any) => p.user_id === userId);
      const member = data.members.find((m) => m.user_id === userId);
      const tenantFromMember = member ? data.tenants.find((t) => t.id === member.tenant_id) : null;
      const tenantOwned = data.tenants.find((t) => t.owner_user_id === userId) || null;
      const tenant = tenantFromMember || tenantOwned;
      const sub = data.subscriptions.find((s) => s.user_id === userId && ['active', 'trialing'].includes(s.status));
      const counts = tenant ? data.counts[tenant.id] : null;
      return { userId, ...info, profile, tenant, sub, counts };
    });
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const ql = q.toLowerCase();
    if (!ql) return entries;
    return entries.filter(
      (r) =>
        (r.email ?? '').toLowerCase().includes(ql) ||
        (r.profile?.display_name ?? '').toLowerCase().includes(ql) ||
        (r.profile?.business_name ?? '').toLowerCase().includes(ql) ||
        (r.tenant?.name ?? '').toLowerCase().includes(ql),
    );
  }, [data, q]);

  const tenants = useMemo(() => {
    if (!data) return [];
    const ql = q.toLowerCase();
    return data.tenants.filter((t) => {
      if (!ql) return true;
      const owner = data.emailMap[t.owner_user_id]?.email ?? '';
      return t.name?.toLowerCase().includes(ql) || owner.toLowerCase().includes(ql);
    });
  }, [data, q]);

  const tab = TABS.find((t) => t.id === view)!;

  const dailyData = useMemo(() => {
    if (!data) return [];
    const messages = data.timeseries?.messages ?? [];
    const contacts = data.timeseries?.contacts ?? [];
    const signups = data.timeseries?.signups ?? [];
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map((d) => {
      const key = startOfDay(d).getTime();
      const inDay = (iso: string) => startOfDay(new Date(iso)).getTime() === key;
      return {
        date: format(d, 'MMM d'),
        messages: messages.filter((m) => inDay(m.created_at)).length,
        contacts: contacts.filter((c) => inDay(c.created_at)).length,
        signups: signups.filter((s) => inDay(s.created_at)).length,
      };
    });
  }, [data]);

  const businessTypes = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    data.profiles.forEach((p) => {
      const k = p.business_type || 'Unknown';
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const subStatusBreakdown = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    data.subscriptions.forEach((s) => map.set(s.status, (map.get(s.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const topTenants = useMemo(() => {
    if (!data) return [];
    return [...data.tenants]
      .map((t) => ({
        name: t.name.length > 16 ? t.name.slice(0, 16) + '…' : t.name,
        messages: data.counts[t.id]?.messages ?? 0,
      }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 10);
  }, [data]);

  const newSignups7d = (data?.timeseries?.signups ?? []).filter((s) => new Date(s.created_at) >= subDays(new Date(), 7)).length;
  const messages7d = (data?.timeseries?.messages ?? []).filter((m) => new Date(m.created_at) >= subDays(new Date(), 7)).length;

  return (
    <View style={styles.wrap}>
      <ScreenHeader
        title="Super Admin"
        subtitle={tab.label}
        right={
          <Pressable onPress={signOut} hitSlop={12} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={18} color="#fff" />
          </Pressable>
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabBar}>
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <Pressable key={item.id} onPress={() => setView(item.id)} style={[styles.tab, active && styles.tabOn]}>
              <Icon size={14} color={active ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.tabText, active && { color: '#fff' }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive, textAlign: 'center', padding: 16 }}>{error}</Text>
          <Button title="Retry" onPress={loadOverview} />
        </View>
      ) : ['messages', 'payments', 'alerts', 'broadcast', 'leads'].includes(view) ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
          {view === 'messages' ? <SuperAdminInbox /> : null}
          {view === 'payments' ? <SuperAdminPaymentsPanel /> : null}
          {view === 'alerts' ? <SuperAdminAlertsPanel /> : null}
          {view === 'broadcast' ? <SuperAdminBroadcastPanel /> : null}
          {view === 'leads' ? <SuperAdminLeadsPanel /> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 24) + 72 }]} keyboardShouldPersistTaps="handled">
          {view === 'analytics' && data ? (
            <>
              <View style={styles.grid}>
                <Stat label="Total users" value={data.totalAuthUsers} />
                <Stat label="Tenants" value={data.tenants.length} />
                <Stat label="Active subs" value={activeSubs.length} />
                <Stat label="Contacts" value={totalContacts} />
                <Stat label="Messages" value={totalMessages} />
                <Stat label="New signups (7d)" value={newSignups7d} />
                <Stat label="Messages (7d)" value={messages7d} />
              </View>
              <Button title="Refresh" variant="outline" icon={<RefreshCw size={14} color={colors.foreground} />} onPress={loadOverview} />

              <ChartCard title="Activity — last 30 days" subtitle="Messages, new contacts, and signups">
                <AreaLineChart
                  data={dailyData}
                  xKey="date"
                  series={[
                    { key: 'messages', color: CHART_COLORS[0], type: 'area' },
                    { key: 'contacts', color: CHART_COLORS[1], type: 'area' },
                    { key: 'signups', color: CHART_COLORS[4], type: 'area' },
                  ]}
                />
                <ChartLegend
                  items={[
                    { label: 'Messages', color: CHART_COLORS[0] },
                    { label: 'Contacts', color: CHART_COLORS[1] },
                    { label: 'Signups', color: CHART_COLORS[4] },
                  ]}
                />
              </ChartCard>

              <ChartCard title="Top tenants by messages">
                {topTenants.length === 0 ? (
                  <Text style={styles.meta}>No tenant activity yet.</Text>
                ) : (
                  <HorizontalBarChart data={topTenants} labelKey="name" valueKey="messages" />
                )}
              </ChartCard>

              <ChartCard title="Business types">
                {businessTypes.length === 0 ? (
                  <Text style={styles.meta}>No business types yet.</Text>
                ) : (
                  <DonutChart data={businessTypes} />
                )}
              </ChartCard>

              {subStatusBreakdown.length > 0 ? (
                <ChartCard title="Subscription statuses">
                  <BarChartView data={subStatusBreakdown} xKey="name" yKey="value" />
                </ChartCard>
              ) : null}
            </>
          ) : null}

          {(view === 'users' || view === 'tenants') && (
            <Input placeholder={view === 'users' ? 'Search users…' : 'Search tenants…'} value={q} onChangeText={setQ} />
          )}

          {view === 'users' &&
            users.map((r) => (
              <Pressable
                key={r.userId}
                style={styles.card}
                onPress={() => manage(r.tenant?.id ?? null, r.tenant?.name ?? r.email ?? 'Account')}
              >
                <Text style={styles.name}>{r.email ?? r.userId}</Text>
                {r.profile?.display_name ? <Text style={styles.meta}>{r.profile.display_name}</Text> : null}
                <View style={styles.row}>
                  {r.tenant ? <Badge label={r.tenant.name} /> : <Badge label="No tenant" tone="muted" />}
                  {r.sub ? <Badge label={r.sub.status} tone="success" /> : null}
                </View>
                <Text style={styles.meta}>Signed up {format(new Date(r.created_at), 'MMM d, yyyy')}</Text>
                {r.counts ? (
                  <Text style={styles.meta}>
                    {r.counts.contacts} contacts · {r.counts.messages} messages
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <Button
                    title={r.tenant ? 'Manage account' : 'No account'}
                    variant="outline"
                    icon={<Eye size={14} color={colors.foreground} />}
                    disabled={!r.tenant}
                    onPress={() => manage(r.tenant?.id ?? null, r.tenant?.name ?? r.email ?? 'Account')}
                  />
                </View>
              </Pressable>
            ))}

          {view === 'tenants' &&
            tenants.map((t) => {
              const owner = data?.emailMap[t.owner_user_id]?.email;
              const c = data?.counts[t.id] ?? { contacts: 0, messages: 0 };
              return (
                <Pressable key={t.id} style={styles.card} onPress={() => manage(t.id, t.name)}>
                  <Text style={styles.name}>{t.name}</Text>
                  <Text style={styles.meta}>{owner}</Text>
                  <Text style={styles.meta}>
                    {c.contacts} contacts · {c.messages} messages
                  </Text>
                  <View style={styles.row}>
                    <Button title="Free days" variant="outline" onPress={() => grantDays(t.owner_user_id, t.name)} />
                    <Button
                      title="Manage account"
                      icon={<Eye size={14} color="#fff" />}
                      onPress={() => manage(t.id, t.name)}
                    />
                  </View>
                </Pressable>
              );
            })}

          {view === 'subscriptions' &&
            (data?.subscriptions ?? []).map((s) => (
              <View key={s.id} style={styles.card}>
                <Text style={styles.name}>{data?.emailMap[s.user_id]?.email ?? s.user_id}</Text>
                <View style={styles.row}>
                  <Badge label={s.status} tone={['active', 'trialing'].includes(s.status) ? 'success' : 'muted'} />
                  <Badge label={s.environment || 'live'} tone="muted" />
                </View>
                {s.current_period_end ? (
                  <Text style={styles.meta}>Until {format(new Date(s.current_period_end), 'MMM d, yyyy')}</Text>
                ) : null}
              </View>
            ))}

          {view === 'payments' ? (
            <SuperAdminPaymentsPanel />
          ) : null}

          {view === 'alerts' ? (
            <SuperAdminAlertsPanel />
          ) : null}

          {view === 'leads' ? (
            <SuperAdminLeadsPanel />
          ) : null}

          {view === 'campaigns' &&
            campaigns.map((c) => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>
                  {c.status} · {c.sent_count}/{c.total_recipients}
                </Text>
              </View>
            ))}

          {view === 'broadcast' ? (
            <SuperAdminBroadcastPanel />
          ) : null}

          <View style={styles.row}>
            <Button title="Account" variant="outline" icon={<UserRound size={14} color={colors.foreground} />} onPress={onOpenAccount} />
            <Button title="Settings" variant="outline" icon={<SettingsIcon size={14} color={colors.foreground} />} onPress={onOpenSettings} />
            <Button title="Tutorials" variant="outline" icon={<BookOpen size={14} color={colors.foreground} />} onPress={() => WebBrowser.openBrowserAsync(`${WEB_ORIGIN}/tutorials`)} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  tabBar: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.foreground },
  body: { padding: 16, gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 14,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.foreground },
  statLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    gap: 6,
  },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
