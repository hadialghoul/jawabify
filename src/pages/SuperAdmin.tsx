import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  Loader2, Search, Users, Building2, MessageSquare, ShoppingBag,
  LogOut, CreditCard, TrendingUp, UserPlus, AlertTriangle, RefreshCw, Mail, Inbox,
  Settings as SettingsIcon, User as UserIcon, BookOpen, LayoutGrid, Shield, Megaphone, Send, Eye,
} from 'lucide-react';
import { SuperAdminMessagesTab } from '@/components/superadmin/MessagesTab';
import { SuperAdminCampaignsTab } from '@/components/superadmin/CampaignsTab';
import { SuperAdminBroadcastTab } from '@/components/superadmin/BroadcastTab';
import { SuperAdminPaymentsTab } from '@/components/superadmin/PaymentsTab';

import { toast } from 'sonner';
import { format, startOfDay, eachDayOfInterval, subDays } from 'date-fns';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Overview {
  tenants: any[];
  members: any[];
  profiles: any[];
  creds: any[];
  subscriptions: any[];
  emailMap: Record<string, { email: string | null; last_sign_in_at: string | null; created_at: string }>;
  counts: Record<string, { contacts: number; messages: number }>;
  timeseries: {
    messages: { created_at: string; direction: string }[];
    contacts: { created_at: string }[];
    signups: { created_at: string }[];
  };
  totalAuthUsers: number;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))', 'hsl(152 60% 40%)', 'hsl(20 90% 55%)'];

function useManageAccount() {
  const { startActingAs } = useAuth();
  const navigate = useNavigate();
  return (tenantId: string | null, tenantName: string) => {
    if (!tenantId) return;
    startActingAs(tenantId, tenantName);
    navigate('/app');
  };
}

function GrantFreeAccessButton({ userId, tenantName }: { userId: string | null; tenantName: string }) {
  const [busy, setBusy] = useState(false);

  if (!userId) return null;

  const grant = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = window.prompt(`How many free days for ${tenantName}? (e.g. 90)`, '30');
    if (!input) return;
    const days = Number(input);
    if (!Number.isFinite(days) || days < 1) {
      toast.error('Enter a valid number of days');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-payments', {
        body: { action: 'grant_free_access', user_id: userId, days },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const until = (data as any)?.until ? format(new Date((data as any).until), 'MMM d, yyyy') : '';
      toast.success(`${tenantName} has free access${until ? ` until ${until}` : ''}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to grant free access');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={grant}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      Free days
    </Button>
  );
}


function ManageAccountButton({ tenantId, tenantName }: { tenantId: string | null; tenantName: string }) {
  const manage = useManageAccount();

  if (!tenantId) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        No account
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5"
      onClick={(e) => {
        e.stopPropagation();
        manage(tenantId, tenantName);
      }}
    >
      <Eye className="h-3.5 w-3.5" />
      Manage account
    </Button>
  );
}

export default function SuperAdmin() {
  const { session, user, loading: authLoading, isSuperAdmin, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState<AdminView>('analytics');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setChecking(false); return; }
    (async () => {
      const { data: row, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'super_admin')
        .maybeSingle();
      // On a transient lookup failure keep the admin view instead of bouncing.
      setIsAdmin(roleError ? isSuperAdmin : !!row);
      setChecking(false);
    })();
  }, [user, authLoading, isSuperAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? session?.access_token;
      if (!token) {
        setError('Please sign in again to refresh your admin session.');
        setLoading(false);
        return;
      }
      const { data: res, error } = await supabase.functions.invoke('super-admin-overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) setError(error.message);
      else setData(res as Overview);
      setLoading(false);
    })();
  }, [isAdmin, session?.access_token]);

  if (authLoading || checking) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="text-muted-foreground text-sm">You don't have super admin access.</p>
          <Button asChild variant="outline"><Link to="/">Back home</Link></Button>
        </Card>
      </div>
    );
  }

  const totalContacts = Object.values(data?.counts ?? {}).reduce((s, c) => s + c.contacts, 0);
  const totalMessages = Object.values(data?.counts ?? {}).reduce((s, c) => s + c.messages, 0);
  const activeSubs = (data?.subscriptions ?? []).filter((s) =>
    ['active', 'trialing'].includes(s.status) && (!s.current_period_end || new Date(s.current_period_end) > new Date())
  );
  const liveSubs = activeSubs.filter((s) => s.environment === 'live');

  return (
    <SidebarProvider>
      <div className="h-[100dvh] min-h-[100dvh] flex w-full bg-background overflow-hidden">
        <AdminSidebar view={view} setView={setView} onSignOut={signOut} />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <header className="min-h-14 shrink-0 border-b border-border/60 flex items-center gap-3 px-3 py-2 md:px-4 z-10 bg-background/80 backdrop-blur safe-top">
            <SidebarTrigger className="h-11 w-11 md:h-8 md:w-8" />
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold truncate">{VIEW_META[view].label}</h1>
              <p className="hidden text-xs text-muted-foreground truncate sm:block">{VIEW_META[view].hint}</p>
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
            <div className="max-w-6xl mx-auto p-3 sm:p-4 md:p-6 pb-24 space-y-4 md:space-y-6">

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
              ) : error ? (
                <Card className="p-6 text-destructive">{error}</Card>
              ) : data ? (
                <>
                  {view === 'analytics' && (
                    <>
                      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-5 gap-3">
                        <StatCard icon={<Users className="h-4 w-4" />} label="Total users" value={data.totalAuthUsers} />
                        <StatCard icon={<Building2 className="h-4 w-4" />} label="Tenants" value={data.tenants.length} />
                        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Active subs" value={activeSubs.length} hint={`${liveSubs.length} live`} />
                        <StatCard icon={<Users className="h-4 w-4" />} label="Contacts" value={totalContacts} />
                        <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Messages" value={totalMessages} />
                      </div>
                      <AnalyticsView data={data} />
                    </>
                  )}

                  {view === 'tenants' && (
                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by tenant or owner email..." className="pl-9" />
                      </div>
                      <TenantsList data={data} q={q} />
                    </div>
                  )}

                  {view === 'users' && <UsersList data={data} />}
                  {view === 'subscriptions' && <SubscriptionsList data={data} />}
                  {view === 'payments' && <SuperAdminPaymentsTab />}

                  {view === 'messages' && <SuperAdminMessagesTab />}
                  {view === 'campaigns' && <SuperAdminCampaignsTab />}
                  {view === 'broadcast' && <SuperAdminBroadcastTab />}
                  {view === 'leads' && <LeadsView />}
                  {view === 'alerts' && <AlertsView />}
                </>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

type AdminView = 'analytics' | 'tenants' | 'users' | 'subscriptions' | 'payments' | 'messages' | 'campaigns' | 'broadcast' | 'leads' | 'alerts';

const VIEW_META: Record<AdminView, { label: string; hint: string }> = {
  analytics:     { label: 'Overview',      hint: 'Platform-wide activity and trends' },
  tenants:       { label: 'Tenants',       hint: 'All businesses on the platform' },
  users:         { label: 'Users',         hint: 'Everyone who has signed up' },
  subscriptions: { label: 'Subscriptions', hint: 'Billing status across tenants' },
  payments:      { label: 'Payments',      hint: 'Live charges straight from Stripe, including deleted accounts' },
  messages:      { label: 'Admin inbox',   hint: 'WhatsApp messages to the Jawabify support number' },
  campaigns:     { label: 'Campaigns',     hint: 'Send WhatsApp broadcasts from the Jawabify support number' },
  broadcast:     { label: 'Broadcast',     hint: 'One-off ad-hoc message to hand-picked contacts (no template)' },
  leads:         { label: 'Consultation leads', hint: 'Submissions from the public site popup' },
  alerts:        { label: 'Alerts',        hint: 'System-wide errors and stuck jobs' },
};

const NAV_SECTIONS: { label: string; items: { id: AdminView; label: string; icon: any }[] }[] = [
  {
    label: 'Platform',
    items: [
      { id: 'analytics',     label: 'Overview',      icon: TrendingUp },
      { id: 'users',         label: 'Users',         icon: Users },
      { id: 'tenants',       label: 'Tenants',       icon: Building2 },
      { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
      { id: 'payments',      label: 'Payments',      icon: CreditCard },
      { id: 'alerts',        label: 'Alerts',        icon: AlertTriangle },
    ],
  },
  {
    label: 'Support',
    items: [
      { id: 'messages',  label: 'Admin inbox', icon: Inbox },
      { id: 'broadcast', label: 'Broadcast',   icon: Send },
      { id: 'campaigns', label: 'Campaigns',   icon: Megaphone },
      { id: 'leads',     label: 'Leads',       icon: Mail },
    ],
  },
];


const EXTERNAL_LINKS = [
  { to: '/settings',  label: 'Settings',   icon: SettingsIcon },
  { to: '/account',   label: 'Account',    icon: UserIcon },
  { to: '/tutorials', label: 'Tutorials',  icon: BookOpen },
];

function AdminSidebar({ view, setView, onSignOut }: { view: AdminView; setView: (v: AdminView) => void; onSignOut: () => void }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === 'collapsed';
  const chooseView = (next: AdminView) => {
    setView(next);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="z-30 [&_[data-mobile=true]]:w-[min(88vw,20rem)] [&_[data-mobile=true]>button]:flex">
      <SidebarHeader className="border-b border-border/60">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">Super Admin</div>
              <div className="text-[11px] text-muted-foreground truncate">Jawabify platform</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = view === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => chooseView(item.id)}
                        isActive={active}
                        tooltip={item.label}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>My workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {EXTERNAL_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <SidebarMenuItem key={link.to}>
                    <SidebarMenuButton asChild tooltip={link.label}>
                      <NavLink to={link.to} onClick={() => isMobile && setOpenMobile(false)}>
                        <Icon className="h-4 w-4" />
                        <span>{link.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-11 md:h-8" onClick={onSignOut} tooltip="Log out">
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AnalyticsView({ data }: { data: Overview }) {
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map((d) => {
      const key = startOfDay(d).getTime();
      const inDay = (iso: string) => startOfDay(new Date(iso)).getTime() === key;
      return {
        date: format(d, 'MMM d'),
        messages: data.timeseries.messages.filter((m) => inDay(m.created_at)).length,
        contacts: data.timeseries.contacts.filter((c) => inDay(c.created_at)).length,
        signups: data.timeseries.signups.filter((s) => inDay(s.created_at)).length,
      };
    });
  }, [data]);

  const businessTypes = useMemo(() => {
    const map = new Map<string, number>();
    data.profiles.forEach((p) => {
      const k = p.business_type || 'Unknown';
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const subStatusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    data.subscriptions.forEach((s) => map.set(s.status, (map.get(s.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data]);

  const topTenants = useMemo(() => {
    return [...data.tenants]
      .map((t) => ({
        name: t.name.length > 16 ? t.name.slice(0, 16) + '…' : t.name,
        messages: data.counts[t.id]?.messages ?? 0,
      }))
      .sort((a, b) => b.messages - a.messages)
      .slice(0, 10);
  }, [data]);

  const newSignups7d = data.timeseries.signups.filter((s) => new Date(s.created_at) >= subDays(new Date(), 7)).length;
  const messages7d = data.timeseries.messages.filter((m) => new Date(m.created_at) >= subDays(new Date(), 7)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<UserPlus className="h-4 w-4" />} label="New signups (7d)" value={newSignups7d} />
        <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Messages (7d)" value={messages7d} />
      </div>

      <Card className="p-3 sm:p-4">
        <h3 className="font-semibold mb-3">Activity — last 30 days</h3>
        <div className="h-64 sm:h-72 -ml-3 sm:ml-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Area type="monotone" dataKey="messages" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.2} />
              <Area type="monotone" dataKey="contacts" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.2} />
              <Area type="monotone" dataKey="signups" stroke={CHART_COLORS[4]} fill={CHART_COLORS[4]} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-3 sm:p-4">
          <h3 className="font-semibold mb-3">Top tenants by messages</h3>
          <div className="h-72 -ml-3 sm:ml-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTenants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={76} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="messages" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <h3 className="font-semibold mb-3">Business types</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={businessTypes} dataKey="value" nameKey="name" outerRadius="70%">
                  {businessTypes.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {subStatusBreakdown.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Subscription statuses</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subStatusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="value" fill={CHART_COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

function UsersList({ data }: { data: Overview }) {
  const [q, setQ] = useState('');
  const manage = useManageAccount();
  const rows = useMemo(() => {
    const entries = Object.entries(data.emailMap).map(([userId, info]) => {
      const profile = data.profiles.find((p: any) => p.user_id === userId);
      const member = data.members.find((m) => m.user_id === userId);
      const tenant = member ? data.tenants.find((t) => t.id === member.tenant_id) : null;
      const sub = data.subscriptions.find((s) => s.user_id === userId && ['active', 'trialing'].includes(s.status));
      return { userId, ...info, profile, tenant, sub };
    });
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!q) return entries;
    const ql = q.toLowerCase();
    return entries.filter((r) =>
      (r.email ?? '').toLowerCase().includes(ql) ||
      (r.profile?.display_name ?? '').toLowerCase().includes(ql) ||
      (r.profile?.business_name ?? '').toLowerCase().includes(ql) ||
      (r.tenant?.name ?? '').toLowerCase().includes(ql)
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by email, name, business..." className="pl-9" />
        </div>
        <div className="text-sm text-muted-foreground">{rows.length} of {data.totalAuthUsers} users</div>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <Card
            key={r.userId}
            role={r.tenant ? 'button' : undefined}
            tabIndex={r.tenant ? 0 : undefined}
            onClick={() => manage(r.tenant?.id ?? null, r.tenant?.name ?? r.email ?? 'Account')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                manage(r.tenant?.id ?? null, r.tenant?.name ?? r.email ?? 'Account');
              }
            }}
            className={`p-3 sm:p-4 ${r.tenant ? 'cursor-pointer transition-colors hover:bg-accent/40' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">{r.email ?? r.userId}</h3>
                  {r.profile?.business_type && <Badge variant="outline">{r.profile.business_type}</Badge>}
                  {r.tenant && <Badge variant="secondary">{r.tenant.name}</Badge>}
                  {r.sub && <Badge>{r.sub.status}</Badge>}
                  {!r.tenant && <Badge variant="outline" className="text-muted-foreground">No tenant</Badge>}
                </div>
                {r.profile?.display_name && (
                  <p className="text-sm text-muted-foreground mt-1">{r.profile.display_name}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Signed up {format(new Date(r.created_at), 'MMM d, yyyy')}
                  {r.last_sign_in_at
                    ? ` · Last sign-in ${format(new Date(r.last_sign_in_at), 'MMM d, yyyy')}`
                    : ' · Never signed in'}
                </p>
                {r.profile?.contact_phone && <p className="text-xs text-muted-foreground">📞 {r.profile.contact_phone}</p>}
              </div>
              <div className="w-full sm:w-auto [&>button]:w-full [&>button]:h-11 sm:[&>button]:w-auto sm:[&>button]:h-9">
                <ManageAccountButton tenantId={r.tenant?.id ?? null} tenantName={r.tenant?.name ?? r.email ?? 'Account'} />
              </div>
            </div>
          </Card>
        ))}
        {rows.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">No users match your search.</Card>
        )}
      </div>
    </div>
  );
}

function TenantsList({ data, q }: { data: Overview; q: string }) {
  const manage = useManageAccount();


  const filteredTenants = (data?.tenants ?? []).filter((t) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    const owner = data?.emailMap[t.owner_user_id]?.email ?? '';
    return t.name.toLowerCase().includes(ql) || owner.toLowerCase().includes(ql);
  });

  return (
    <div className="space-y-3">
      {filteredTenants.map((t) => {
        const owner = data.emailMap[t.owner_user_id];
        const ownerProfile = data.profiles.find((p: any) => p.user_id === t.owner_user_id);
        const c = data.counts[t.id] ?? { contacts: 0, messages: 0 };
        const tenantMembers = data.members.filter((m) => m.tenant_id === t.id);
        const wa = data.creds.find((cr) => cr.tenant_id === t.id && cr.provider === 'whatsapp_cloud' && cr.is_active);
        const shop = data.creds.find((cr) => cr.tenant_id === t.id && cr.provider === 'shopify' && cr.is_active);
        const sub = data.subscriptions.find((s) => s.user_id === t.owner_user_id && ['active', 'trialing'].includes(s.status));
        return (
          <Card
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => manage(t.id, t.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                manage(t.id, t.name);
              }
            }}
            className="p-3 sm:p-4 cursor-pointer transition-colors hover:bg-accent/40"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{t.name}</h3>
                  {ownerProfile?.business_type && <Badge variant="outline">{ownerProfile.business_type}</Badge>}
                  {wa && <Badge variant="secondary">WhatsApp</Badge>}
                  {shop && <Badge variant="secondary">Shopify</Badge>}
                  {sub && <Badge>{sub.status} · {sub.environment}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{owner?.email ?? t.owner_user_id}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {format(new Date(t.created_at), 'MMM d, yyyy')}
                  {owner?.last_sign_in_at && ` · Last sign-in ${format(new Date(owner.last_sign_in_at), 'MMM d, yyyy')}`}
                  {' · '}{tenantMembers.length} member{tenantMembers.length === 1 ? '' : 's'}
                </p>
                {(ownerProfile?.country || ownerProfile?.city || ownerProfile?.address) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 {[ownerProfile.address, ownerProfile.city, ownerProfile.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {ownerProfile?.contact_phone && <p className="text-xs text-muted-foreground">📞 {ownerProfile.contact_phone}</p>}
                {ownerProfile?.website && (
                  <p className="text-xs text-muted-foreground">
                    🌐 <a href={ownerProfile.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline hover:text-primary">{ownerProfile.website}</a>
                  </p>
                )}
                {wa?.phone_number && <p className="text-xs text-muted-foreground">WA: {wa.phone_number}</p>}
                {shop?.shop_domain && <p className="text-xs text-muted-foreground">Shop: {shop.shop_domain}</p>}
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                <div className="flex justify-start gap-6 text-sm sm:justify-end">
                  <Metric label="Contacts" value={c.contacts} />
                  <Metric label="Messages" value={c.messages} />
                </div>
                {sub?.current_period_end && (
                  <p className="text-xs text-muted-foreground">
                    Access until {format(new Date(sub.current_period_end), 'MMM d, yyyy')}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 [&>button]:h-11 sm:flex sm:[&>button]:h-9">
                  <GrantFreeAccessButton userId={t.owner_user_id} tenantName={t.name} />
                  <ManageAccountButton tenantId={t.id} tenantName={t.name} />
                </div>
              </div>

            </div>
          </Card>
        );
      })}
      {filteredTenants.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">No tenants found.</Card>
      )}
    </div>
  );
}

function SubscriptionsList({ data }: { data: Overview }) {
  const [envFilter, setEnvFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const subs = data.subscriptions.filter((s) => envFilter === 'all' || s.environment === envFilter);

  const extendTrial = async (s: any) => {
    const subId = s.stripe_subscription_id;
    if (!subId) {
      toast.error('No Stripe subscription linked to this record');
      return;
    }
    const input = prompt('How many free days to add? (e.g. 60 for 2 months)', '30');
    if (!input) return;
    const days = Number(input);
    if (!Number.isFinite(days) || days < 1) return;
    setBusy(s.id);
    try {
      const { data: res, error } = await supabase.functions.invoke('super-admin-payments', {
        body: { action: 'extend_trial', environment: s.environment ?? 'live', subscription_id: subId, days },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      toast.success(`Free access extended by ${days} days`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to extend');
    } finally {
      setBusy(null);
    }
  };


  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['all', 'live', 'sandbox'] as const).map((e) => (
          <Button key={e} variant={envFilter === e ? 'default' : 'outline'} size="sm" onClick={() => setEnvFilter(e)}>
            {e === 'all' ? 'All' : e === 'live' ? 'Live' : 'Sandbox'}
          </Button>
        ))}
      </div>
      {subs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No subscriptions.</Card>
      ) : (
        subs.map((s) => {
          const email = data.emailMap[s.user_id]?.email ?? s.user_id;
          const tenant = data.tenants.find((t) => t.owner_user_id === s.user_id);
          const isActive = ['active', 'trialing'].includes(s.status);
          return (
            <Card key={s.id} className="p-4">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{tenant?.name ?? email}</h3>
                    <Badge variant={isActive ? 'default' : 'secondary'}>{s.status}</Badge>
                    <Badge variant="outline">{s.environment}</Badge>
                    {s.cancel_at_period_end && <Badge variant="destructive">Cancels</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{email}</p>
                  <p className="text-xs text-muted-foreground mt-1">Plan: {s.price_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.current_period_start && `Period: ${format(new Date(s.current_period_start), 'MMM d')} – `}
                    {s.current_period_end && format(new Date(s.current_period_end), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">Customer: {s.stripe_customer_id}</p>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <div className="text-xs text-muted-foreground sm:text-right">
                    Started {format(new Date(s.created_at), 'MMM d, yyyy')}
                  </div>
                  <Button size="sm" className="h-11 sm:h-9" variant="outline" disabled={busy === s.id} onClick={() => extendTrial(s)}>
                    {busy === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Free days'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

interface AlertsData {
  counts: { aiIncidents: number; shopifyFails: number; campaignFails: number; emailFails: number; suppressed: number; stuckSessions: number };
  aiIncidents: any[];
  shopifyFails: any[];
  campaignFails: any[];
  emailFails: any[];
  suppressed: any[];
  stuckSessions: any[];
  tenantMap: Record<string, string>;
}

function AlertsView() {
  const { session } = useAuth();
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? session?.access_token;
    if (!token) {
      setError('Please sign in again to refresh your admin session.');
      setLoading(false);
      return;
    }
    const { data: res, error } = await supabase.functions.invoke('super-admin-alerts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) setError(error.message);
    else setData(res as AlertsData);
    setLoading(false);
  };

  useEffect(() => { load(); }, [session?.access_token]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>;
  if (error) return <Card className="p-6 text-destructive">{error}</Card>;
  if (!data) return null;

  const tName = (id: string | null) => (id && data.tenantMap[id]) || '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">System-wide errors, silent fails, and stuck jobs (last 7 days for logs; all-time for failed jobs).</p>
        <Button variant="outline" size="sm" onClick={load} className="h-11 gap-2 sm:h-9"><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="AI incidents (7d)" value={data.counts.aiIncidents} />
        <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Shopify sync fails" value={data.counts.shopifyFails} />
        <StatCard icon={<MessageSquare className="h-4 w-4" />} label="Campaign fails" value={data.counts.campaignFails} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Email fails (7d)" value={data.counts.emailFails} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Suppressed (7d)" value={data.counts.suppressed} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Stuck sessions" value={data.counts.stuckSessions} />
      </div>

      <AlertSection title="AI incidents" empty="No AI incidents." items={data.aiIncidents} render={(i) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={i.incident_type === 'failure' ? 'destructive' : 'secondary'}>{i.incident_type}</Badge>
            {i.resolved && <Badge variant="outline">resolved</Badge>}
            <span className="text-xs text-muted-foreground">{tName(i.tenant_id)} · {format(new Date(i.created_at), 'MMM d, HH:mm')}</span>
          </div>
          {i.reason && <p className="text-sm">{i.reason}</p>}
          {i.user_message && <p className="text-xs text-muted-foreground truncate">User: {i.user_message}</p>}
          {i.ai_reply && <p className="text-xs text-muted-foreground truncate">AI: {i.ai_reply}</p>}
        </div>
      )} />

      <AlertSection title="Shopify sync failures" empty="No Shopify sync failures." items={data.shopifyFails} render={(o) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="destructive">failed</Badge>
            <span className="text-sm font-medium">#{o.order_number ?? o.id.slice(0, 8)}</span>
            <span className="text-xs text-muted-foreground">{o.customer_name ?? '—'} · {tName(o.tenant_id)} · attempts: {o.shopify_sync_attempts ?? 0}</span>
          </div>
          {o.shopify_sync_error && <p className="text-xs text-destructive/80 break-words">{o.shopify_sync_error}</p>}
          <p className="text-xs text-muted-foreground">Last try: {o.shopify_last_attempt_at ? format(new Date(o.shopify_last_attempt_at), 'MMM d, HH:mm') : '—'}</p>
        </div>
      )} />

      <AlertSection title="Campaign send failures" empty="No campaign failures." items={data.campaignFails} render={(r) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="destructive">failed</Badge>
            <span className="text-sm">{r.phone_number}</span>
            {r.error_code && <Badge variant="outline">{r.error_code}</Badge>}
            <span className="text-xs text-muted-foreground">attempts: {r.attempts ?? 0}</span>
          </div>
          {r.error && <p className="text-xs text-destructive/80 break-words">{r.error}</p>}
          <p className="text-xs text-muted-foreground">Campaign: {r.campaign_id?.slice(0, 8)} · {r.last_error_at ? format(new Date(r.last_error_at), 'MMM d, HH:mm') : '—'}</p>
        </div>
      )} />

      <AlertSection title="Email send failures" empty="No email failures." items={data.emailFails} render={(e) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="destructive">{e.status}</Badge>
            <span className="text-sm">{e.recipient_email}</span>
            <span className="text-xs text-muted-foreground">{e.template_name} · {format(new Date(e.created_at), 'MMM d, HH:mm')}</span>
          </div>
          {e.error_message && <p className="text-xs text-destructive/80 break-words">{e.error_message}</p>}
        </div>
      )} />

      <AlertSection title="Suppressed emails" empty="No suppressions." items={data.suppressed} render={(s) => (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{s.reason}</Badge>
          <span className="text-sm">{s.email}</span>
          <span className="text-xs text-muted-foreground ml-auto">{format(new Date(s.created_at), 'MMM d, HH:mm')}</span>
        </div>
      )} />

      <AlertSection title="Stuck order/flow sessions" empty="No stuck sessions." items={data.stuckSessions} render={(s) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{s.state}</Badge>
            {s.flow_kind && <Badge variant="secondary">{s.flow_kind}</Badge>}
            <span className="text-xs text-muted-foreground">{tName(s.tenant_id)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Expired {s.expires_at ? format(new Date(s.expires_at), 'MMM d, HH:mm') : '—'} · updated {format(new Date(s.updated_at), 'MMM d, HH:mm')}</p>
        </div>
      )} />
    </div>
  );
}

function AlertSection<T extends { id: string }>({ title, items, empty, render }: { title: string; items: T[]; empty: string; render: (item: T) => React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="outline">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{empty}</p>
      ) : (
        <div className="space-y-2 md:max-h-96 md:overflow-y-auto">
          {items.map((it) => (
            <div key={it.id} className="rounded-md border border-border/60 bg-muted/30 p-3">
              {render(it)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function LeadsView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'form' | 'popup'>('all');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('consultation_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) setErr(error.message);
    else setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const isAdForm = (r: any) => String(r.source_path || '').includes('/form');
  const visible = rows.filter((r) => filter === 'all' ? true : filter === 'form' ? isAdForm(r) : !isAdForm(r));
  const formCount = rows.filter(isAdForm).length;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold">Consultation leads</h3>
          <p className="text-xs text-muted-foreground">Ad form submissions and site popup submissions</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="h-11 gap-2 sm:h-9">
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {([
          { id: 'all' as const, label: `All (${rows.length})` },
          { id: 'form' as const, label: `Ad form (${formCount})` },
          { id: 'popup' as const, label: `Popup (${rows.length - formCount})` },
        ]).map((t) => (
          <Button key={t.id} size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none" variant={filter === t.id ? 'default' : 'outline'} onClick={() => setFilter(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
      ) : err ? (
        <div className="text-destructive text-sm">{err}</div>
      ) : visible.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No leads yet.</div>
      ) : (
        <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {format(new Date(r.created_at), 'MMM d, HH:mm')}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant={isAdForm(r) ? 'default' : 'secondary'}>{isAdForm(r) ? 'Ad form' : 'Popup'}</Badge>
                  </td>
                  <td className="py-2 pr-3 font-medium">{r.full_name}</td>
                  <td className="py-2 pr-3"><a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-col gap-1">
                      <a className="text-primary hover:underline" href={`tel:${r.phone}`}>{r.phone}</a>
                      {r.phone && (
                        <a
                          className="text-xs text-muted-foreground hover:underline"
                          href={`https://wa.me/${String(r.phone).replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[26rem] break-words">{r.source_path || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {visible.map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium break-words">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'MMM d, HH:mm')}</p>
                </div>
                <Badge variant={isAdForm(r) ? 'default' : 'secondary'}>{isAdForm(r) ? 'Ad form' : 'Popup'}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <a className="min-h-11 flex items-center rounded-md border px-3 text-primary break-all" href={`mailto:${r.email}`}>{r.email}</a>
                <div className="grid grid-cols-2 gap-2">
                  <a className="min-h-11 flex items-center justify-center rounded-md border text-primary" href={`tel:${r.phone}`}>Call</a>
                  <a className="min-h-11 flex items-center justify-center rounded-md border text-primary" href={`https://wa.me/${String(r.phone || '').replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
                </div>
                {(r.business_name || r.business_type) && <p className="text-muted-foreground">{[r.business_name, r.business_type].filter(Boolean).join(' · ')}</p>}
                {r.needs && <p className="break-words">{r.needs}</p>}
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </Card>
  );
}


