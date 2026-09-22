import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Loader2, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { actingHeaders } from '@/lib/actingTenant';

interface PhoneStatus {
  tier: string | null;
  quality: 'GREEN' | 'YELLOW' | 'RED' | null;
  dailyCap: number | null;
  verifiedName?: string | null;
  displayPhoneNumber?: string | null;
  nameStatus?: string | null;
  error?: string;
}

const TIER_LABEL: Record<string, string> = {
  TIER_50: '50 / 24h',
  TIER_250: '250 / 24h',
  TIER_1K: '1,000 / 24h',
  TIER_10K: '10,000 / 24h',
  TIER_100K: '100,000 / 24h',
  TIER_UNLIMITED: 'Unlimited',
};

export function WhatsAppHealthCard() {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let token = sessionData.session?.access_token;
      if (!token) {
        // Session not hydrated yet (or signed out) — don't call the function unauthenticated
        setLoading(false);
        return;
      }
      const call = (jwt: string) =>
        supabase.functions.invoke('whatsapp-phone-status', {
          headers: { ...actingHeaders(), Authorization: `Bearer ${jwt}` },
        });

      let { data, error: invokeErr } = await call(token);

      // Expired/stale access token → refresh once and retry before showing an error.
      if (invokeErr) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        const newToken = refreshed.session?.access_token;
        if (newToken && newToken !== token) {
          token = newToken;
          ({ data, error: invokeErr } = await call(token));
        }
      }

      if (invokeErr) {
        // Auth not ready — stay quiet instead of showing a scary error.
        setLoading(false);
        return;
      }
      if (data?.error) {
        setError(data.error);
        setStatus(data);
      } else {
        setStatus(data as PhoneStatus);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load WhatsApp status');
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) load();
    });
    return () => sub.subscription.unsubscribe();
  }, []);


  const qualityColor =
    status?.quality === 'GREEN' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300'
    : status?.quality === 'YELLOW' ? 'bg-amber-500/15 text-amber-700 border-amber-300'
    : status?.quality === 'RED' ? 'bg-destructive/15 text-destructive border-destructive/40'
    : 'bg-muted text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          WhatsApp account health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking with Meta…
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div>{error}</div>
              <Button size="sm" variant="outline" className="mt-2" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
              </Button>
            </div>
          </div>
        ) : status ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded-md p-3">
                <div className="text-[11px] text-muted-foreground">Daily send limit (unique recipients)</div>
                <div className="text-lg font-semibold mt-1">
                  {status.tier && TIER_LABEL[status.tier] ? TIER_LABEL[status.tier] : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">Meta tier: {status.tier || 'unknown'}</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="text-[11px] text-muted-foreground">Quality rating</div>
                <div className="mt-1">
                  <Badge variant="outline" className={qualityColor}>
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {status.quality || 'unknown'}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {status.displayPhoneNumber || ''}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              To unlock the next tier (1K → 10K → 100K → Unlimited), keep <strong>quality green</strong>
              and consistently send to opted-in contacts. Meta upgrades you automatically once you reach
              ~50% of your current cap with a green rating over a rolling 7-day window. Marketing to
              unconsented users will get you reported and tank the rating fast.
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={load}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
