import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, RefreshCw } from 'lucide-react';
import { useMemberActivity } from '@/hooks/useTeam';

const RANGES = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function duration(startIso: string, endIso: string | null, lastSeenIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso ?? lastSeenIso).getTime();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function TeamActivity() {
  const [days, setDays] = useState('7');
  const [who, setWho] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const { rows, loading, reload } = useMemberActivity(Number(days));

  const people = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.member_id) map.set(r.member_id, r.display_name || r.email || 'Team member');
    });
    return Array.from(map, ([id, label]) => ({ id, label }));
  }, [rows]);

  const filtered = who === 'all' ? rows : rows.filter((r) => r.member_id === who);
  const visible = showAll ? filtered : filtered.slice(0, 5);
  const hasMore = filtered.length > 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Team activity
        </CardTitle>
        <CardDescription>Sign-in and sign-out times per employee, with what they handled.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="gap-1.5 w-full sm:w-auto" onClick={() => reload()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground">Loading activity…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border p-3 text-xs text-muted-foreground">No sign-ins in this period.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-3 text-left font-medium">Member</th>
                    <th className="py-2 pr-3 text-left font-medium">Signed in</th>
                    <th className="py-2 pr-3 text-left font-medium">Signed out</th>
                    <th className="py-2 pr-3 text-left font-medium">Duration</th>
                    <th className="py-2 pr-3 text-left font-medium">Messages</th>
                    <th className="py-2 text-left font-medium">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.session_id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.display_name || r.email || 'Team member'}</div>
                        <div className="text-muted-foreground">{r.role === 'employee' ? 'Employee' : r.role === 'admin' ? 'Admin' : 'Owner'}</div>
                      </td>
                      <td className="py-2 pr-3">{fmtTime(r.started_at)}</td>
                      <td className="py-2 pr-3">
                        {r.ended_at ? fmtTime(r.ended_at) : <Badge variant="secondary">Still active</Badge>}
                      </td>
                      <td className="py-2 pr-3">{duration(r.started_at, r.ended_at, r.last_seen_at)}</td>
                      <td className="py-2 pr-3">{r.messages_sent}</td>
                      <td className="py-2">{r.orders_handled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 sm:hidden">
              {visible.map((r) => (
                <div key={r.session_id} className="rounded-md border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <div className="font-medium truncate">{r.display_name || r.email || 'Team member'}</div>
                    <div className="shrink-0 text-muted-foreground">{r.role === 'employee' ? 'Employee' : r.role === 'admin' ? 'Admin' : 'Owner'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 py-1">
                    <div>
                      <div className="text-muted-foreground">Signed in</div>
                      <div>{fmtTime(r.started_at)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Signed out</div>
                      <div>{r.ended_at ? fmtTime(r.ended_at) : <Badge variant="secondary">Still active</Badge>}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Duration</div>
                      <div>{duration(r.started_at, r.ended_at, r.last_seen_at)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Work</div>
                      <div>{r.messages_sent} msgs · {r.orders_handled} orders</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show {filtered.length - 5} more <ChevronDown className="h-4 w-4" /></>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
