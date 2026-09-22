import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Megaphone, Search, Send } from 'lucide-react';

interface ContactRow {
  id: string;
  name: string | null;
  phone_number: string;
  updated_at: string | null;
  opted_out?: boolean | null;
}

/**
 * Broadcast = ad-hoc, immediate one-off text send to hand-picked recipients.
 * Unlike Campaigns, there are no templates, throttling worker, scheduling
 * or opt-out DB filtering — the admin sees every contact and picks who
 * to blast right now. Free-text only works inside the 24h window; outside
 * that Meta rejects and we surface the error.
 */
export function SuperAdminBroadcastTab() {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideOptedOut, setHideOptedOut] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: mem } = await supabase.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (!mem?.tenant_id) { setLoading(false); return; }
      setTenantId(mem.tenant_id);
      const { data } = await supabase.from('contacts')
        .select('id, name, phone_number, updated_at, opted_out')
        .eq('tenant_id', mem.tenant_id)
        .order('updated_at', { ascending: false })
        .limit(1000);
      setContacts((data as ContactRow[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (hideOptedOut && c.opted_out) return false;
      if (!term) return true;
      return (c.name || '').toLowerCase().includes(term) || c.phone_number.toLowerCase().includes(term);
    });
  }, [contacts, q, hideOptedOut]);

  const toggle = (id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAllFiltered = () => setSelected(new Set(filtered.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  const send = async () => {
    if (!message.trim() || selected.size === 0) return;
    const recipients = contacts.filter((c) => selected.has(c.id));
    setSending(true);
    setProgress({ sent: 0, failed: 0, total: recipients.length });
    let sent = 0, failed = 0;
    for (const c of recipients) {
      try {
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
          body: { to: c.phone_number, message: message.trim() },
        });
        if (error || (data as any)?.error) {
          failed++;
        } else {
          sent++;
          // Log the outgoing message so it shows in the inbox thread
          await supabase.from('messages').insert({
            contact_id: c.id, content: message.trim(),
            direction: 'outgoing', status: 'sent',
          });
        }
      } catch { failed++; }
      setProgress({ sent, failed, total: recipients.length });
      // Gentle pacing to avoid Meta rate limits (~5 msgs/sec)
      await new Promise((r) => setTimeout(r, 220));
    }
    setSending(false);
    toast({
      title: 'Broadcast complete',
      description: `${sent} sent · ${failed} failed`,
      variant: failed > 0 ? 'destructive' : 'default',
    });
    if (failed === 0) { setMessage(''); clearSelection(); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  if (!tenantId) return <Card className="p-6">Admin tenant not initialised. Open the Admin inbox first.</Card>;

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> Broadcast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Immediate one-off send to hand-picked contacts. Free text only works inside
            the WhatsApp 24-hour window — for cold outreach use Campaigns with a template.
          </p>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type the message to broadcast…"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {selected.size} selected · {filtered.length} shown
              {progress && sending && (
                <span className="ml-2">· sending {progress.sent + progress.failed}/{progress.total}</span>
              )}
            </div>
            <Button onClick={send} disabled={sending || selected.size === 0 || !message.trim()} className="h-11 w-full gap-1 sm:w-auto">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to {selected.size || 0}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className="pl-9" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={hideOptedOut} onCheckedChange={(v) => setHideOptedOut(!!v)} />
              Hide opted-out
            </label>
             <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={allFilteredSelected ? clearSelection : selectAllFiltered}>
              {allFilteredSelected ? 'Clear' : 'Select all'}
            </Button>
          </div>

          <div className="border rounded-md divide-y max-h-[420px] overflow-y-auto">
            {filtered.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center">No contacts match.</p>
            )}
            {filtered.map((c) => {
              const on = selected.has(c.id);
              return (
                <label key={c.id} className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={on} onCheckedChange={() => toggle(c.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name || c.phone_number}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.phone_number}</div>
                  </div>
                  {c.opted_out && <Badge variant="outline" className="text-[10px]">Opted out</Badge>}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
