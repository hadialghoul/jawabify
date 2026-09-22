import { useMemo } from 'react';
import { Contact } from '@/types/chat';
import { Order } from '@/types/order';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sparkles, X, TrendingUp, Users, ShoppingCart, Percent } from 'lucide-react';
import { format, isToday, isYesterday, subDays, startOfDay } from 'date-fns';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface InterestedDashboardProps {
  contacts: Contact[];
  orders: Order[];
  selectedContactId: string | null;
  onSelectContact: (contact: Contact) => void;
  onUnflag: (contactId: string) => void;
}

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(152 60% 55%)',
  'hsl(152 40% 70%)',
  'hsl(40 90% 60%)',
  'hsl(280 60% 60%)',
  'hsl(0 70% 65%)',
];

export function InterestedDashboard({
  contacts,
  orders,
  selectedContactId,
  onSelectContact,
  onUnflag,
}: InterestedDashboardProps) {
  const interested = useMemo(
    () =>
      contacts
        .filter((c) => c.isInterested)
        .sort(
          (a, b) =>
            (b.interestedAt?.getTime() ?? 0) - (a.interestedAt?.getTime() ?? 0),
        ),
    [contacts],
  );

  // KPIs
  const totalInterested = interested.length;
  const phoneSet = new Set(orders.map((o) => o.customerPhone));
  const converted = interested.filter((c) => phoneSet.has(c.phoneNumber)).length;
  const conversionRate =
    totalInterested > 0 ? Math.round((converted / totalInterested) * 100) : 0;
  const last7 = interested.filter(
    (c) => c.interestedAt && c.interestedAt >= subDays(new Date(), 7),
  ).length;

  // Trend: last 14 days
  const trendData = useMemo(() => {
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({
        date: d.toISOString(),
        label: format(d, 'MMM d'),
        count: 0,
      });
    }
    interested.forEach((c) => {
      if (!c.interestedAt) return;
      const day = startOfDay(c.interestedAt).toISOString();
      const bucket = days.find((d) => d.date === day);
      if (bucket) bucket.count += 1;
    });
    return days;
  }, [interested]);

  // Top reasons (extract first keyword/phrase)
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

  // Conversion donut
  const conversionData = [
    { name: 'Converted to order', value: converted },
    { name: 'Still interested', value: Math.max(totalInterested - converted, 0) },
  ];

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const formatTime = (d?: Date) => {
    if (!d) return '';
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'dd MMM, HH:mm');
  };

  if (totalInterested === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Sparkles className="h-12 w-12 mb-3 opacity-40" />
        <p className="font-medium text-foreground">No interested customers yet</p>
        <p className="text-sm mt-1 max-w-md">
          When customers ask multiple product questions, the AI will flag them here
          and you'll see analytics on engagement and conversion.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="Total interested"
            value={totalInterested}
            icon={<Users className="h-4 w-4" />}
            accent="text-primary"
          />
          <KpiCard
            label="New (7 days)"
            value={last7}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="text-emerald-500"
          />
          <KpiCard
            label="Converted to order"
            value={converted}
            icon={<ShoppingCart className="h-4 w-4" />}
            accent="text-amber-500"
          />
          <KpiCard
            label="Conversion rate"
            value={`${conversionRate}%`}
            icon={<Percent className="h-4 w-4" />}
            accent="text-violet-500"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3">
              <h4 className="font-semibold">Interest trend</h4>
              <p className="text-xs text-muted-foreground">
                New interested customers per day (last 14 days)
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#interestGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3">
              <h4 className="font-semibold">Conversion</h4>
              <p className="text-xs text-muted-foreground">
                Interested → placed order
              </p>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {conversionData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="mb-3">
            <h4 className="font-semibold">Top interest reasons</h4>
            <p className="text-xs text-muted-foreground">
              What's catching customers' attention
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonsData} layout="vertical" margin={{ top: 5, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={180}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Customer list */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b">
            <h4 className="font-semibold">All interested customers</h4>
            <p className="text-xs text-muted-foreground">
              Click to open the conversation
            </p>
          </div>
          <div className="divide-y">
            {interested.map((contact) => {
              const didOrder = phoneSet.has(contact.phoneNumber);
              return (
                <div
                  key={contact.id}
                  className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent ${
                    selectedContactId === contact.id ? 'bg-accent' : ''
                  }`}
                >
                  <button
                    onClick={() => onSelectContact(contact)}
                    className="flex flex-1 items-center gap-3 text-left min-w-0"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                        {initials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate">
                          {contact.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatTime(contact.interestedAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground italic">
                        {contact.interestReason || 'Flagged as interested'}
                      </p>
                    </div>
                  </button>
                  {didOrder && (
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <ShoppingCart className="h-3 w-3" /> Ordered
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnflag(contact.id);
                    }}
                    title="Unflag"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`${accent}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
