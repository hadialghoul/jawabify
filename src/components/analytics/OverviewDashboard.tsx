import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, subDays, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import {
  Users,
  MessageSquare,
  Package,
  Sparkles,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  CalendarIcon,
} from 'lucide-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTodayStats } from '@/hooks/useTodayStats';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  ComposedChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  completed: 'hsl(152 60% 45%)',
  processing: 'hsl(210 80% 55%)',
  pending: 'hsl(40 90% 55%)',
  cancelled: 'hsl(0 70% 60%)',
};

const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

export function OverviewDashboard({ onSelectByPhone }: { onSelectByPhone?: (phone: string) => void } = {}) {
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => ({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  }));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DayPickerRange | undefined>({ from: range.from, to: range.to });
  const { data, loading, refetch } = useAnalytics(range);
  const { data: today, loading: todayLoading } = useTodayStats();

  const presets: { label: string; get: () => { from: Date; to: Date } }[] = [
    { label: 'Today', get: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { label: 'Last 7 days', get: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
    { label: 'Last 30 days', get: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
    { label: 'Last 90 days', get: () => ({ from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }) },
    { label: 'This month', get: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
  ];

  const rangeLabel =
    format(range.from, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd')
      ? format(range.from, 'MMM d, yyyy')
      : `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`;

  const DateControls = (
    <div className="flex items-center gap-2">
      <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (o) setDraftRange({ from: range.from, to: range.to }); }}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal')}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            {rangeLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="flex sm:flex-col gap-1 p-2 border-b sm:border-b-0 sm:border-r overflow-x-auto">
              {presets.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start whitespace-nowrap"
                  onClick={() => {
                    const r = p.get();
                    setRange(r);
                    setDraftRange({ from: r.from, to: r.to });
                    setPickerOpen(false);
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="range"
              selected={draftRange as DayPickerRange}
              onDayClick={(day) => {
                if (day > new Date()) return;
                const hasComplete = draftRange?.from && draftRange?.to;
                const onlyFrom = draftRange?.from && !draftRange?.to;
                if (!draftRange?.from || hasComplete) {
                  // start a new range
                  setDraftRange({ from: day, to: undefined });
                } else if (onlyFrom) {
                  const from = draftRange!.from!;
                  const start = day < from ? day : from;
                  const end = day < from ? from : day;
                  setDraftRange({ from: start, to: end });
                  setRange({ from: startOfDay(start), to: endOfDay(end) });
                  setPickerOpen(false);
                }
              }}
              numberOfMonths={2}
              defaultMonth={range.from}
              disabled={(d) => d > new Date()}
              className={cn('p-3 pointer-events-auto')}
            />
          </div>
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" onClick={refetch}>
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );

  if (loading || !data) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-semibold text-lg">Overview</h3>
              <p className="text-sm text-muted-foreground">{rangeLabel}</p>
            </div>
            {DateControls}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  const { totals, daily, ordersByStatus, topProducts, topCustomers, hourlyHeatmap } = data;
  const conversionRate =
    totals.contacts > 0 ? Math.round((totals.orders / totals.contacts) * 100) : 0;
  const responseRate =
    totals.incoming > 0 ? Math.round((totals.outgoing / totals.incoming) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-lg">Overview</h3>
            <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          {DateControls}
        </div>

        {/* Today's activity */}
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Today
              </h4>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), 'EEEE, MMM d')} · live snapshot
              </p>
            </div>
          </div>
          {todayLoading || !today ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <TodayStat label="Contacts talked" value={today.contactsTalked} />
              <TodayStat label="New contacts" value={today.newContacts} />
              <TodayStat label="Messages in" value={today.incoming} />
              <TodayStat label="Messages out" value={today.outgoing} />
              <TodayStat label="Pending" value={today.pendingOrders} />
              <TodayStat label="Processing" value={today.processingOrders} />
              <TodayStat label="Completed" value={today.completedOrders} />
              <TodayStat label="Cancelled" value={today.cancelledOrders} />
            </div>
          )}
        </Card>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi
            label="Contacts"
            value={totals.contacts.toLocaleString()}
            icon={<Users className="h-4 w-4" />}
            accent="text-primary"
          />
          <Kpi
            label="Messages"
            value={totals.messages.toLocaleString()}
            sub={`${totals.incoming.toLocaleString()} in · ${totals.outgoing.toLocaleString()} out`}
            icon={<MessageSquare className="h-4 w-4" />}
            accent="text-emerald-500"
          />
          <Kpi
            label="Orders"
            value={totals.orders.toLocaleString()}
            sub={`${conversionRate}% of contacts`}
            icon={<Package className="h-4 w-4" />}
            accent="text-amber-500"
          />
          <Kpi
            label="Reply rate"
            value={`${responseRate}%`}
            sub="Outgoing ÷ incoming"
            icon={<TrendingUp className="h-4 w-4" />}
            accent="text-violet-500"
          />
        </div>

        {/* Order status mini-cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat
            label="Pending"
            value={totals.pendingOrders}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
          />
          <MiniStat
            label="Processing"
            value={totals.processingOrders}
            icon={<Loader2 className="h-4 w-4 text-blue-500" />}
          />
          <MiniStat
            label="Completed"
            value={totals.completedOrders}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          />
          <MiniStat
            label="Cancelled"
            value={totals.cancelledOrders}
            icon={<XCircle className="h-4 w-4 text-destructive" />}
          />
        </div>

        {/* Message volume trend */}
        <Card className="p-4">
          <div className="mb-3">
            <h4 className="font-semibold">Message volume</h4>
            <p className="text-xs text-muted-foreground">
              Incoming vs. outgoing per day, with order count overlay
            </p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152 60% 55%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(152 60% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="incoming"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#inGrad)"
                  name="Incoming"
                />
                <Area
                  type="monotone"
                  dataKey="outgoing"
                  stroke="hsl(152 60% 45%)"
                  strokeWidth={2}
                  fill="url(#outGrad)"
                  name="Outgoing"
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="hsl(40 95% 55%)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Orders"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Two-column: status pie + hourly bars */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="mb-3">
              <h4 className="font-semibold">Orders by status</h4>
              <p className="text-xs text-muted-foreground">Distribution within selected range</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {ordersByStatus.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_COLORS[entry.name] || 'hsl(var(--muted))'}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, textTransform: 'capitalize' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-3">
              <h4 className="font-semibold">Busiest hours</h4>
              <p className="text-xs text-muted-foreground">
                Incoming messages by hour of day (last 30 days)
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyHeatmap} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(h) => `${h}h`}
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(h) => `${h}:00 – ${h}:59`}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Top products */}
        <Card className="p-4">
          <div className="mb-3">
            <h4 className="font-semibold">Top products</h4>
            <p className="text-xs text-muted-foreground">By order count</p>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No orders yet</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 5, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={200}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Top customers */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b">
            <h4 className="font-semibold">Most engaged customers</h4>
            <p className="text-xs text-muted-foreground">By message count (last 30 days)</p>
          </div>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No activity yet</p>
          ) : (
            <div className="divide-y">
              {topCustomers.map((c, i) => (
                <button
                  key={c.phone + i}
                  type="button"
                  onClick={() => c.phone && onSelectByPhone?.(c.phone)}
                  disabled={!c.phone || !onSelectByPhone}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {c.messages.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">msgs</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Returning customer rate */}
        <Card className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h4 className="font-semibold">Returning customer rate</h4>
              <p className="text-xs text-muted-foreground">
                Customers who messaged again after placing an order
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold tabular-nums text-primary">
                {totals.returningRate}%
              </div>
              <div className="text-xs text-muted-foreground">
                {totals.returningCustomers} of {totals.customersWithOrders} customers
              </div>
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, totals.returningRate)}%` }}
            />
          </div>
        </Card>

        {totals.interested > 0 && (
          <Card className="p-4 flex items-center gap-3 bg-primary/5 border-primary/20">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <span className="font-medium">{totals.interested}</span>{' '}
              <span className="text-muted-foreground">
                customers flagged as interested — open the Interested tab to view conversion details.
              </span>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={accent}>{icon}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</div>}
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function TodayStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-background/60 p-3 border border-border/50">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{value.toLocaleString()}</div>
    </div>
  );
}
