import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2, RefreshCw, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';

interface Charge {
  id: string;
  environment: 'live' | 'sandbox';
  amount: number;
  amount_refunded: number;
  currency: string;
  status: string;
  refunded: boolean;
  description: string | null;
  created: string | null;
  receipt_url: string | null;
  failure_message: string | null;
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  user_id: string | null;
  card: { brand: string; last4: string } | null;
}

interface StripeSub {
  id: string;
  environment: 'live' | 'sandbox';
  status: string;
  plan: string | null;
  amount: number;
  currency: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  customer_id: string | null;
  customer_email: string | null;
}

const money = (amount: number, currency: string) =>
  `${amount.toFixed(2)} ${currency.toUpperCase()}`;

export function SuperAdminPaymentsTab() {
  const [loading, setLoading] = useState(true);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [subs, setSubs] = useState<StripeSub[]>([]);
  const [errors, setErrors] = useState<{ environment: string; message: string }[]>([]);
  const [envFilter, setEnvFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-payments', {
        body: { limit: 100 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCharges(data?.charges ?? []);
      setSubs(data?.subscriptions ?? []);
      setErrors(data?.errors ?? []);
    } catch (e) {
      toast.error((e as Error).message || 'Could not load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const [busy, setBusy] = useState<string | null>(null);

  const runAction = async (id: string, body: Record<string, unknown>, successMsg: string) => {
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke('super-admin-payments', { body });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Action failed');
      toast.success(successMsg);
      await load();
    } catch (e) {
      toast.error((e as Error).message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const refund = (c: Charge) => {
    if (!confirm(`Refund ${money(c.amount, c.currency)} to ${c.customer_email ?? c.customer_id}?`)) return;
    runAction(c.id, { action: 'refund', environment: c.environment, charge_id: c.id }, 'Refund issued');
  };

  const cancelSub = (s: StripeSub) => {
    if (!confirm(`Cancel subscription for ${s.customer_email ?? s.customer_id}?`)) return;
    runAction(s.id, { action: 'cancel_subscription', environment: s.environment, subscription_id: s.id }, 'Subscription canceled');
  };

  const extendTrial = (s: StripeSub) => {
    const input = prompt(`Give free days to ${s.customer_email ?? s.customer_id}? (e.g. 60 for 2 months)`, '60');
    if (!input) return;
    const days = Number(input);
    if (!Number.isFinite(days) || days < 1) return;
    runAction(s.id, { action: 'extend_trial', environment: s.environment, subscription_id: s.id, days }, `Free period extended by ${days} days`);
  };


  const term = q.trim().toLowerCase();
  const match = (values: (string | null | undefined)[]) =>
    !term || values.some((v) => (v ?? '').toLowerCase().includes(term));

  const visibleCharges = charges
    .filter((c) => envFilter === 'all' || c.environment === envFilter)
    .filter((c) => match([c.customer_email, c.customer_name, c.customer_id, c.id, c.user_id]));

  const visibleSubs = subs
    .filter((s) => envFilter === 'all' || s.environment === envFilter)
    .filter((s) => match([s.customer_email, s.customer_id, s.id, s.plan]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'live', 'sandbox'] as const).map((e) => (
          <Button key={e} size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none" variant={envFilter === e ? 'default' : 'outline'} onClick={() => setEnvFilter(e)}>
            {e === 'all' ? 'All' : e === 'live' ? 'Live' : 'Test'}
          </Button>
        ))}
        <div className="relative order-last w-full sm:order-none sm:min-w-[200px] sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, customer or charge id..." className="pl-9" />
        </div>
        <Button size="sm" className="h-11 w-11 sm:h-9 sm:w-auto" variant="outline" onClick={load} disabled={loading} aria-label="Refresh payments">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {errors.map((e) => (
        <Card key={e.environment} className="p-3 text-sm text-muted-foreground">
          {e.environment} mode unavailable: {e.message}
        </Card>
      ))}

      <div>
        <h3 className="font-semibold mb-2">Charges ({visibleCharges.length})</h3>
        {loading && charges.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Loading charges…</Card>
        ) : visibleCharges.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No charges found.</Card>
        ) : (
          <div className="space-y-2">
            {visibleCharges.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{money(c.amount, c.currency)}</span>
                      <Badge variant={c.status === 'succeeded' ? 'default' : 'destructive'}>{c.status}</Badge>
                      <Badge variant="outline">{c.environment}</Badge>
                      {c.refunded && <Badge variant="secondary">refunded</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.customer_email ?? c.customer_name ?? c.customer_id ?? 'Unknown customer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.card ? `${c.card.brand} ····${c.card.last4} · ` : ''}
                      {c.created ? format(new Date(c.created), 'MMM d, yyyy HH:mm') : '—'}
                    </p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    {c.failure_message && <p className="text-xs text-destructive">{c.failure_message}</p>}
                    <p className="text-xs text-muted-foreground mt-1 break-all">
                      {c.id}{c.customer_id ? ` · ${c.customer_id}` : ''}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex [&>a]:h-11 [&>button]:h-11 sm:[&>a]:h-9 sm:[&>button]:h-9">
                    {c.receipt_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={c.receipt_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Receipt
                        </a>
                      </Button>
                    )}
                    {c.status === 'succeeded' && !c.refunded && (
                      <Button size="sm" variant="destructive" onClick={() => refund(c)} disabled={busy === c.id}>
                        {busy === c.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Refund
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-2">Stripe subscriptions ({visibleSubs.length})</h3>
        {visibleSubs.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">No subscriptions in Stripe.</Card>
        ) : (
          <div className="space-y-2">
            {visibleSubs.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{s.customer_email ?? s.customer_id}</span>
                  <Badge variant={['active', 'trialing'].includes(s.status) ? 'default' : 'secondary'}>{s.status}</Badge>
                  <Badge variant="outline">{s.environment}</Badge>
                  {s.cancel_at_period_end && <Badge variant="destructive">cancels</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.plan ?? '—'} · {money(s.amount, s.currency)}
                  {s.current_period_end ? ` · renews ${format(new Date(s.current_period_end), 'MMM d, yyyy')}` : ''}
                </p>
                <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground break-all">{s.id}</p>
                  {!['canceled', 'incomplete_expired'].includes(s.status) && (
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button size="sm" className="h-11 sm:h-9" variant="outline" onClick={() => extendTrial(s)} disabled={busy === s.id}>
                        {busy === s.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Free days
                      </Button>
                      <Button size="sm" className="h-11 sm:h-9" variant="outline" onClick={() => cancelSub(s)} disabled={busy === s.id}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
