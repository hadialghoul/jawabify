import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { TemplateManager } from '@/components/settings/TemplateManager';
import { Contact } from '@/types/chat';
import { toast } from 'sonner';
import { Megaphone, Send, Loader2, Users, FileText, RefreshCw, Plus, CheckCheck, Check, Eye, MessageSquare, X, Link2, Copy, ShoppingBag, Pause, Play, Clock, Gauge, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { actingHeaders } from '@/lib/actingTenant';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
}

interface Campaign {
  id: string;
  name: string;
  template_name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  scheduled_at: string | null;
  send_rate_per_minute: number | null;
  concurrency: number | null;
  paused_reason: string | null;
  auto_paused: boolean | null;
}

export function CampaignsTab({ contacts: rawContacts }: { contacts: Contact[] }) {
  const contacts = useMemo(() => rawContacts.filter((c) => c.platform === 'whatsapp' || !c.platform), [rawContacts]);
  const [tab, setTab] = useState<'campaigns' | 'templates'>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const { tenantId } = useAuth();

  const loadCampaigns = async () => {
    if (!tenantId) {
      setCampaigns([]);
      return;
    }
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);
    setCampaigns((data as Campaign[]) || []);
  };

  const loadTemplates = async () => {
    try {
      const res = await supabase.functions.invoke('whatsapp-templates', { headers: actingHeaders(), method: 'GET' });
      setTemplates(res.data?.data || []);
    } catch {
      setTemplates([]);
    }
  };

  useEffect(() => {
    Promise.all([loadCampaigns(), loadTemplates()]).finally(() => setLoading(false));
    const ch = supabase.channel(`campaigns-feed-${tenantId ?? 'none'}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaigns', filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined } as any,
      () => loadCampaigns()
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const approvedTemplates = useMemo(() => templates.filter(t => t.status === 'APPROVED'), [templates]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-card px-3 py-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            WhatsApp Campaigns
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Send approved templates to opted-in contacts. Throttled to stay within tier limits.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button className="h-11 sm:h-9" variant={tab === 'campaigns' ? 'default' : 'outline'} size="sm" onClick={() => setTab('campaigns')}>
            <Send className="h-4 w-4 mr-1" /> Campaigns
          </Button>
          <Button className="h-11 sm:h-9" variant={tab === 'templates' ? 'default' : 'outline'} size="sm" onClick={() => setTab('templates')}>
            <FileText className="h-4 w-4 mr-1" /> Templates
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="mx-auto max-w-5xl">
          {tab === 'templates' ? (
            <TemplateManager />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {approvedTemplates.length} approved template{approvedTemplates.length === 1 ? '' : 's'} available
                </p>
                <div className="flex gap-2">
                  <Button className="h-11 w-11 sm:h-9 sm:w-auto" variant="outline" size="sm" onClick={loadCampaigns} aria-label="Refresh campaigns">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none"
                    onClick={() => {
                      if (approvedTemplates.length === 0) {
                        toast.error('Create and get a template approved first');
                        setTab('templates');
                        return;
                      }
                      setShowCreate(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> New Campaign
                  </Button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No campaigns yet.</p>
                  <p className="text-xs mt-1">
                    {approvedTemplates.length === 0
                      ? 'Start by creating a template and waiting for Meta approval.'
                      : 'Create your first campaign to send to your contacts.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {campaigns.map(c => <CampaignCard key={c.id} campaign={c} onClick={() => setDetailCampaign(c)} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CampaignDetailDialog
        campaign={detailCampaign}
        onOpenChange={(open) => { if (!open) setDetailCampaign(null); }}
      />

      <CreateCampaignDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        templates={approvedTemplates}
        contacts={contacts}
        pastCampaigns={campaigns}
        onCreated={loadCampaigns}
      />
    </div>
  );
}

function CampaignCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const total = campaign.total_recipients || 1;
  const done = campaign.sent_count + campaign.failed_count;
  const pct = Math.round((done / total) * 100);
  const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    sending: 'secondary',
    scheduled: 'outline',
    paused: 'destructive',
    completed: 'default',
    failed: 'destructive',
    draft: 'outline',
  };

  const togglePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const isPaused = campaign.status === 'paused';
    const updates: Record<string, unknown> = isPaused
      ? { status: 'sending', auto_paused: false, paused_reason: null }
      : { status: 'paused', auto_paused: false, paused_reason: 'Paused manually' };
    const { error } = await supabase.from('campaigns').update(updates).eq('id', campaign.id);
    if (error) toast.error(error.message);
    else toast.success(isPaused ? 'Campaign resumed' : 'Campaign paused');
  };

  const canPause = ['sending', 'scheduled'].includes(campaign.status);
  const canResume = campaign.status === 'paused';

  return (
    <Card className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">{campaign.name}</p>
              <Badge variant={statusVariant[campaign.status] || 'outline'} className="text-[10px]">
                {campaign.status}
              </Badge>
              {campaign.scheduled_at && campaign.status === 'scheduled' && (
                <Badge variant="outline" className="text-[10px]">
                  <Clock className="h-2.5 w-2.5 mr-1" />
                  {format(new Date(campaign.scheduled_at), 'MMM d HH:mm')}
                </Badge>
              )}
              {campaign.send_rate_per_minute && campaign.status === 'sending' && (
                <Badge variant="outline" className="text-[10px]">
                  <Gauge className="h-2.5 w-2.5 mr-1" />
                  {campaign.send_rate_per_minute}/min
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Template: <code className="text-[11px]">{campaign.template_name}</code> · {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <div className="text-sm font-medium">{campaign.sent_count}/{campaign.total_recipients}</div>
              {campaign.failed_count > 0 && (
                <div className="text-xs text-destructive">{campaign.failed_count} failed</div>
              )}
            </div>
            {(canPause || canResume) && (
              <Button size="icon" variant="ghost" className="h-11 w-11 sm:h-7 sm:w-7" onClick={togglePause} title={canResume ? 'Resume' : 'Pause'}>
                {canResume ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
        {campaign.status === 'paused' && campaign.paused_reason && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] rounded-md bg-destructive/10 text-destructive px-2 py-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="flex-1">{campaign.paused_reason}</span>
          </div>
        )}
        {campaign.status === 'sending' && (
          <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
        {(campaign.status === 'completed' || campaign.delivered_count > 0 || campaign.read_count > 0) && (
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> {campaign.sent_count} sent</span>
            <span className="flex items-center gap-1"><CheckCheck className="h-3 w-3" /> {campaign.delivered_count} delivered</span>
            <span className="flex items-center gap-1 text-primary"><Eye className="h-3 w-3" /> {campaign.read_count} read</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {campaign.replied_count} replied</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface Recipient {
  id: string;
  contact_id: string;
  phone_number: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  replied_at: string | null;
  error: string | null;
}

interface CampaignOrder {
  id: string;
  display_id: number;
  contact_id: string | null;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
}

function CampaignDetailDialog({
  campaign, onOpenChange,
}: { campaign: Campaign | null; onOpenChange: (open: boolean) => void }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [orders, setOrders] = useState<CampaignOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'recipients' | 'orders'>('recipients');
  const { tenantId } = useAuth();
  const open = !!campaign;

  useEffect(() => {
    if (!campaign) return;
    setLoading(true);
    setView('recipients');
    (async () => {
      const { data: recs } = await supabase
        .from('campaign_recipients')
        .select('id, contact_id, phone_number, status, sent_at, delivered_at, read_at, failed_at, replied_at, error')
        .eq('campaign_id', campaign.id)
        .order('sent_at', { ascending: false, nullsFirst: false });
      const recipientsData = (recs as Recipient[]) || [];
      setRecipients(recipientsData);

      const contactIds = recipientsData.map(r => r.contact_id).filter(Boolean);
      const sinceISO = campaign.started_at || campaign.created_at;
      if (contactIds.length > 0) {
        const { data: ords } = await supabase
          .from('orders')
          .select('id, display_id, contact_id, customer_name, customer_phone, product_name, quantity, status, created_at')
          .eq('tenant_id', tenantId as string)
          .in('contact_id', contactIds)
          .gte('created_at', sinceISO)
          .order('created_at', { ascending: false });
        setOrders((ords as CampaignOrder[]) || []);
      } else {
        setOrders([]);
      }
      setLoading(false);
    })();
  }, [campaign?.id]);

  if (!campaign) return null;

  const total = campaign.total_recipients || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const deliveryRate = pct(campaign.delivered_count);
  const readRate = pct(campaign.read_count);
  const replyRate = pct(campaign.replied_count);
  const failRate = pct(campaign.failed_count);
  const orderRate = pct(orders.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[94dvh] w-[calc(100%-1rem)] flex flex-col p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Template <code>{campaign.template_name}</code> · sent {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <MetricCard icon={<Users className="h-4 w-4" />} label="Recipients" value={campaign.total_recipients} />
          <MetricCard icon={<Check className="h-4 w-4" />} label="Sent" value={campaign.sent_count} pct={pct(campaign.sent_count)} />
          <MetricCard icon={<CheckCheck className="h-4 w-4" />} label="Delivered" value={campaign.delivered_count} pct={deliveryRate} />
          <MetricCard icon={<Eye className="h-4 w-4" />} label="Read" value={campaign.read_count} pct={readRate} tone="primary" />
          <MetricCard icon={<MessageSquare className="h-4 w-4" />} label="Replied" value={campaign.replied_count} pct={replyRate} tone="primary" />
          <MetricCard icon={<ShoppingBag className="h-4 w-4" />} label="Orders" value={orders.length} pct={orderRate} tone="primary" />
        </div>

        {campaign.failed_count > 0 && (
          <div className="text-xs text-destructive flex items-center gap-1">
            <X className="h-3 w-3" /> {campaign.failed_count} failed ({failRate}%)
          </div>
        )}

        <div className="flex gap-2">
          <Button variant={view === 'recipients' ? 'default' : 'outline'} size="sm" onClick={() => setView('recipients')}>
            <Users className="h-4 w-4 mr-1" /> Recipients
          </Button>
          <Button variant={view === 'orders' ? 'default' : 'outline'} size="sm" onClick={() => setView('orders')}>
            <ShoppingBag className="h-4 w-4 mr-1" /> Orders ({orders.length})
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          {view === 'recipients' ? (
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Sent</th>
                  <th className="px-3 py-2 font-medium">Delivered</th>
                  <th className="px-3 py-2 font-medium">Read</th>
                  <th className="px-3 py-2 font-medium">Replied</th>
                  <th className="px-3 py-2 font-medium">Ordered</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                ) : recipients.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No recipients</td></tr>
                ) : recipients.map(r => {
                  const ordered = orders.some(o => o.contact_id === r.contact_id);
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2 font-mono">{r.phone_number}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === 'failed' ? 'destructive' : r.status === 'read' ? 'default' : 'secondary'} className="text-[10px]">
                          {r.status}
                        </Badge>
                        {r.error && <div className="text-[10px] text-destructive mt-0.5 truncate max-w-[160px]">{r.error}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.sent_at ? format(new Date(r.sent_at), 'MMM d, HH:mm') : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.delivered_at ? format(new Date(r.delivered_at), 'HH:mm') : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.read_at ? format(new Date(r.read_at), 'HH:mm') : '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.replied_at ? format(new Date(r.replied_at), 'MMM d, HH:mm') : '—'}</td>
                      <td className="px-3 py-2">
                        {ordered ? <Badge className="text-[10px]"><ShoppingBag className="h-3 w-3 mr-1" />Yes</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Order #</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Placed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">No orders from this campaign yet</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2 font-mono">#{o.display_id}</td>
                    <td className="px-3 py-2">{o.customer_name}</td>
                    <td className="px-3 py-2 font-mono">{o.customer_phone}</td>
                    <td className="px-3 py-2">{o.product_name}</td>
                    <td className="px-3 py-2">{o.quantity}</td>
                    <td className="px-3 py-2">
                      <Badge variant={o.status === 'cancelled' ? 'destructive' : o.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{format(new Date(o.created_at), 'MMM d, HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon, label, value, pct, tone }: { icon: React.ReactNode; label: string; value: number; pct?: number; tone?: 'primary' }) {
  return (
    <Card className={tone === 'primary' ? 'border-primary/40' : ''}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
        {pct !== undefined && <div className="text-[10px] text-muted-foreground">{pct}%</div>}
      </CardContent>
    </Card>
  );
}

function CreateCampaignDialog({
  open, onOpenChange, templates, contacts, pastCampaigns, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: Template[];
  contacts: Contact[];
  pastCampaigns: Campaign[];
  onCreated: () => void;
}) {
  const { tenantId } = useAuth();
  const [name, setName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [vars, setVars] = useState<string[]>([]);
  const [varFallbacks, setVarFallbacks] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [remoteMatches, setRemoteMatches] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [excludeCampaignIds, setExcludeCampaignIds] = useState<Set<string>>(new Set());
  const [excludeOnlyOrderers, setExcludeOnlyOrderers] = useState(false);
  const [excludedContactIds, setExcludedContactIds] = useState<Set<string>>(new Set());
  const [loadingExcludes, setLoadingExcludes] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [sendRate, setSendRate] = useState<number>(60);
  const [concurrency, setConcurrency] = useState<number>(5);
  const [spreadHours, setSpreadHours] = useState<number | ''>('');
  const [excludeOptedOut, setExcludeOptedOut] = useState<boolean>(true);
  const [appendOptOut, setAppendOptOut] = useState<boolean>(true);
  const [optOutVariableIndex, setOptOutVariableIndex] = useState<string>('');

  // Auto-compute send rate when spread is set.
  useEffect(() => {
    if (spreadHours && Number(spreadHours) > 0 && selectedIds.size > 0) {
      const minutes = Number(spreadHours) * 60;
      const rate = Math.max(10, Math.min(600, Math.ceil(selectedIds.size / minutes)));
      setSendRate(rate);
    }
  }, [spreadHours, selectedIds]);

  const template = useMemo(() => templates.find(t => t.name === templateName), [templates, templateName]);
  const variableCount = useMemo(() => {
    if (!template) return 0;
    const body = template.components?.find((c: any) => c.type === 'BODY');
    if (!body?.text) return 0;
    const matches = body.text.match(/\{\{(\d+)\}\}/g);
    return matches ? new Set(matches).size : 0;
  }, [template]);

  useEffect(() => {
    setVars(Array(variableCount).fill(''));
    setVarFallbacks(Array(variableCount).fill(''));
  }, [variableCount]);

  useEffect(() => {
    const validIds = new Set(contacts.map((c) => c.id));
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [contacts]);

  useEffect(() => {
    if (excludeCampaignIds.size === 0) {
      setExcludedContactIds(new Set());
      return;
    }
    setLoadingExcludes(true);
    (async () => {
      const campaignIds = Array.from(excludeCampaignIds);
      const { data: recipRows } = await supabase
        .from('campaign_recipients')
        .select('contact_id, campaign_id')
        .in('campaign_id', campaignIds);

      const byCampaign = new Map<string, Set<string>>();
      const allRecipients = new Set<string>();
      (recipRows || []).forEach((r: any) => {
        if (!r.contact_id) return;
        allRecipients.add(r.contact_id);
        if (!byCampaign.has(r.campaign_id)) byCampaign.set(r.campaign_id, new Set());
        byCampaign.get(r.campaign_id)!.add(r.contact_id);
      });

      let ids = allRecipients;

      if (excludeOnlyOrderers && allRecipients.size > 0) {
        const { data: camps } = await supabase
          .from('campaigns')
          .select('id, started_at, created_at')
          .eq('tenant_id', tenantId as string)
          .in('id', campaignIds);
        const campaignStart = new Map<string, string>();
        (camps || []).forEach((c: any) => {
          campaignStart.set(c.id, c.started_at || c.created_at);
        });
        const earliest = Array.from(campaignStart.values()).sort()[0];
        const { data: orderRows } = await supabase
          .from('orders')
          .select('contact_id, created_at')
          .eq('tenant_id', tenantId as string)
          .in('contact_id', Array.from(allRecipients))
          .gte('created_at', earliest);

        const filtered = new Set<string>();
        (orderRows || []).forEach((o: any) => {
          if (!o.contact_id) return;
          for (const [cid, contactSet] of byCampaign.entries()) {
            if (!contactSet.has(o.contact_id)) continue;
            const start = campaignStart.get(cid);
            if (start && o.created_at >= start) {
              filtered.add(o.contact_id);
              break;
            }
          }
        });
        ids = filtered;
      }

      setExcludedContactIds(ids);
      setSelectedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
      setLoadingExcludes(false);
    })();
  }, [excludeCampaignIds, excludeOnlyOrderers]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    contacts.forEach(c => (c.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [contacts]);

  // Search the whole address book on the server, not just the contacts that
  // happen to be loaded in the paginated list.
  useEffect(() => {
    const raw = search.trim();
    if (!raw || !tenantId) {
      setRemoteMatches([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const digits = raw.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '');
      const filters = [`name.ilike.%${raw.replace(/[%,]/g, '')}%`];
      if (digits.length >= 3) filters.push(`phone_number.ilike.%${digits}%`);
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number, tags, opted_out, platform, handle, updated_at')
        .eq('tenant_id', tenantId)
        .or(filters.join(','))
        .order('updated_at', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error('Campaign contact search failed:', error);
        setRemoteMatches([]);
      } else {
        setRemoteMatches(
          (data || []).map((c: any) => ({
            id: c.id,
            name: c.name || c.phone_number,
            phoneNumber: c.phone_number,
            tags: c.tags || [],
            optedOut: !!c.opted_out,
            platform: c.platform || 'whatsapp',
            handle: c.handle || undefined,
            lastMessage: '',
            timestamp: c.updated_at ? new Date(c.updated_at) : new Date(),
            unreadCount: 0,
          })) as unknown as Contact[],
        );
      }
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, tenantId]);

  const matches = (c: Contact, s: string, digits: string) => {
    if (!s) return true;
    if ((c.name || '').toLowerCase().includes(s)) return true;
    const phoneDigits = (c.phoneNumber || '').replace(/\D/g, '');
    return digits.length >= 3 && phoneDigits.includes(digits);
  };

  const searchPool = useMemo(() => {
    if (!search.trim()) return contacts;
    const byId = new Map<string, Contact>();
    contacts.forEach(c => byId.set(c.id, c));
    remoteMatches.forEach(c => {
      if (!byId.has(c.id)) byId.set(c.id, c);
    });
    return Array.from(byId.values());
  }, [contacts, remoteMatches, search]);

  const filteredContacts = useMemo(() => {
    const s = search.toLowerCase().trim();
    const digits = s.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '');
    return searchPool.filter(c => {
      if (excludedContactIds.has(c.id)) return false;
      if (excludeOptedOut && c.optedOut) return false;
      if (selectedTags.size > 0) {
        const tags = c.tags || [];
        if (!tags.some(t => selectedTags.has(t))) return false;
      }
      return matches(c, s, digits);
    });
  }, [searchPool, search, selectedTags, excludedContactIds, excludeOptedOut]);

  // Contacts that match the search but are hidden only because they unsubscribed
  const hiddenOptedOutMatches = useMemo(() => {
    if (!excludeOptedOut) return 0;
    const s = search.toLowerCase().trim();
    if (!s) return 0;
    const digits = s.replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '');
    return searchPool.filter(c => {
      if (!c.optedOut) return false;
      if (excludedContactIds.has(c.id)) return false;
      return matches(c, s, digits);
    }).length;
  }, [searchPool, search, excludeOptedOut, excludedContactIds]);

  const toggleAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const selectFirstN = (n: number) => {
    const slice = filteredContacts.slice(0, n).map(c => c.id);
    setSelectedIds(new Set(slice));
  };

  const toggleTag = (t: string) => {
    const next = new Set(selectedTags);
    if (next.has(t)) next.delete(t); else next.add(t);
    setSelectedTags(next);
  };

  const reset = () => {
    setName(''); setTemplateName(''); setVars([]); setSelectedIds(new Set()); setSearch(''); setRemoteMatches([]); setSelectedTags(new Set());
    setExcludeCampaignIds(new Set()); setExcludedContactIds(new Set());
    setExcludeOnlyOrderers(false);
    setExcludeOptedOut(true);
    setAppendOptOut(true);
    setOptOutVariableIndex('');
    setScheduledAt(''); setSendRate(60); setConcurrency(5); setSpreadHours('');
  };


  const handleSend = async () => {
    const selectedContacts = contacts.filter((c) => selectedIds.has(c.id));
    if (!name.trim() || !templateName || selectedContacts.length === 0) {
      toast.error('Name, template, and at least one contact required');
      return;
    }
    if (vars.some((v, i) => !v.trim() && !(varFallbacks[i] || '').trim())) {
      toast.error('Fill each template variable (or give it a fallback value)');
      return;
    }
    setSending(true);
    try {
      const templateBody = template?.components?.find((c: any) => c.type === 'BODY')?.text || '';
      const res = await supabase.functions.invoke('send-campaign', { headers: actingHeaders(),
        body: {
          name: name.trim(),
          templateName,
          templateLanguage: template?.language || 'en_US',
          templateBody,
          variables: vars,
          variableFallbacks: varFallbacks,
          contactIds: selectedContacts.map((c) => c.id),
          contactPhones: selectedContacts.map((c) => c.phoneNumber),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          sendRatePerMinute: sendRate,
          concurrency,
          excludeOptedOut,
          appendOptOut,
          optOutVariableIndex: appendOptOut && optOutVariableIndex ? Number(optOutVariableIndex) : null,
        },
      });
      if (res.error) {
        let message = res.error.message;
        const context = (res.error as any).context;
        if (context && typeof context.json === 'function') {
          try {
            const payload = await context.json();
            message = payload?.error || message;
          } catch {
            // Keep the SDK message if the response body is not JSON.
          }
        }
        throw new Error(message);
      }
      if (res.data?.error) throw new Error(res.data.error);
      const scheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 30_000;
      toast.success(
        scheduled
          ? `Campaign scheduled for ${format(new Date(scheduledAt), 'MMM d HH:mm')} (${selectedContacts.length} contacts)`
          : `Campaign started: sending to ${selectedContacts.length} contacts at ~${sendRate}/min`
      );
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send');
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[94dvh] w-[calc(100%-1rem)] flex flex-col p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
          <DialogDescription>
            Send an approved WhatsApp template to selected contacts. Throttled at ~50/min.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Campaign name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="May promo blast" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={templateName} onValueChange={setTemplateName}>
              <SelectTrigger><SelectValue placeholder="Select an approved template" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name} <span className="text-muted-foreground ml-1">({t.language})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {template && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">
                {template.components?.find((c: any) => c.type === 'BODY')?.text}
              </p>
            )}
          </div>

          {variableCount > 0 && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Template variables</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Type a fixed value, or use <code>{'{name}'}</code>, <code>{'{first_name}'}</code> or <code>{'{phone}'}</code> to personalize per contact.
                  The fallback is used when that contact has no saved value.
                </p>
              </div>
              {vars.map((v, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={v}
                    onChange={(e) => {
                      const next = [...vars];
                      next[i] = e.target.value;
                      setVars(next);
                    }}
                    placeholder={`Value for {{${i + 1}}}`}
                  />
                  <Input
                    value={varFallbacks[i] || ''}
                    onChange={(e) => {
                      const next = [...varFallbacks];
                      next[i] = e.target.value;
                      setVarFallbacks(next);
                    }}
                    placeholder={`Fallback for {{${i + 1}}} (e.g. there)`}
                  />
                </div>
              ))}
            </div>
          )}

          <UtmBuilder
            campaignName={name}
            variableCount={variableCount}
            onInsert={(url, idx) => {
              if (idx < 0 || idx >= vars.length) return;
              const next = [...vars];
              next[idx] = url;
              setVars(next);
            }}
          />

          {pastCampaigns.length > 0 && (
            <div className="space-y-1.5 border rounded-md p-3 bg-muted/30">
              <Label className="text-xs flex items-center gap-1">
                <X className="h-3.5 w-3.5" />
                Exclude contacts from previous campaigns
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Don't send to anyone who was already targeted in the campaigns you pick below.
              </p>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {pastCampaigns.map(pc => (
                  <Badge
                    key={pc.id}
                    variant={excludeCampaignIds.has(pc.id) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => {
                      const next = new Set(excludeCampaignIds);
                      if (next.has(pc.id)) next.delete(pc.id); else next.add(pc.id);
                      setExcludeCampaignIds(next);
                    }}
                  >
                    {pc.name} ({pc.total_recipients})
                  </Badge>
                ))}
              </div>
              <label className="flex items-start gap-2 text-[11px] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={excludeOnlyOrderers}
                  onChange={(e) => setExcludeOnlyOrderers(e.target.checked)}
                />
                <span>Only exclude contacts who placed an order after the campaign (keep non-orderers in the list)</span>
              </label>
              {excludeCampaignIds.size > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {loadingExcludes
                    ? 'Loading…'
                    : excludeOnlyOrderers
                      ? `Excluding ${excludedContactIds.size} contact${excludedContactIds.size === 1 ? '' : 's'} who ordered after these campaigns`
                      : `Excluding ${excludedContactIds.size} contact${excludedContactIds.size === 1 ? '' : 's'}`}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 border rounded-md p-3 bg-muted/30">

            <Label className="text-xs flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Schedule & throttle
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-[10px] text-muted-foreground">Send at (leave empty to send now)</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    min={toLocalInput(new Date(Date.now() + 60_000))}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full text-xs sm:w-auto sm:min-w-[190px]"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]"
                    onClick={() => setScheduledAt(toLocalInput(new Date(Date.now() + 3600_000)))}>
                    In 1 hour
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]"
                    onClick={() => setScheduledAt(toLocalInput(atHour(0, 20)))}>
                    Tonight 8 PM
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]"
                    onClick={() => setScheduledAt(toLocalInput(atHour(1, 10)))}>
                    Tomorrow 10 AM
                  </Button>
                  {scheduledAt && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]"
                      onClick={() => setScheduledAt('')}>
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {scheduledAt
                    ? `Will start ${format(new Date(scheduledAt), 'EEE MMM d, HH:mm')} (your local time).`
                    : 'Sends immediately once you confirm.'}
                </p>
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground">Spread over (hours, optional)</Label>
                <Input
                  type="number" min={0} step="0.5"
                  value={spreadHours}
                  onChange={(e) => setSpreadHours(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 4"
                  className="text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  Send rate: {sendRate} msg/min
                </Label>
                <Input
                  type="range" min={10} max={600} step={10}
                  value={sendRate}
                  onChange={(e) => { setSpreadHours(''); setSendRate(Number(e.target.value)); }}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">
                  Parallel sends: {concurrency}
                </Label>
                <Input
                  type="range" min={1} max={20} step={1}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Higher rates need a higher Meta tier. Worker processes the queue every minute and resumes
              automatically across restarts. {selectedIds.size > 0 && sendRate > 0 && (
                <span>At {sendRate}/min, sending {selectedIds.size} messages takes ~{Math.ceil(selectedIds.size / sendRate)} min.</span>
              )}
            </p>
          </div>

          <div className="space-y-2 border rounded-md p-3 bg-muted/30">
            <Label className="text-xs flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Opt-out / unsubscribe
            </Label>
            <label className="flex items-start gap-2 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={excludeOptedOut}
                onChange={(e) => setExcludeOptedOut(e.target.checked)}
              />
              <span>
                Exclude contacts who replied <code>STOP</code>
                {' '}({contacts.filter(c => c.optedOut).length} unsubscribed)
              </span>
            </label>
            <label className="flex items-start gap-2 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={appendOptOut}
                onChange={(e) => setAppendOptOut(e.target.checked)}
              />
              <span>Append "Reply STOP to unsubscribe." to the message</span>
            </label>
            {appendOptOut && (
              <div className="pl-5 space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Which template variable holds the disclaimer? (must be a free-text slot)
                </Label>
                <Select
                  value={optOutVariableIndex}
                  onValueChange={setOptOutVariableIndex}
                  disabled={variableCount === 0}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={variableCount === 0 ? 'Template has no variables — add {{N}} placeholder first' : 'Select variable slot'} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: variableCount }).map((_, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{`{{${i + 1}}}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  WhatsApp won't let us add free text outside approved templates. Put <code>{'{{N}}'}</code> where the disclaimer should appear, then pick that slot here — we'll fill it automatically.
                </p>
              </div>
            )}
          </div>





          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Recipients ({selectedIds.size}/{contacts.length})
              </Label>
              <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 text-xs">
                {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? 'Clear' : 'Select all'}
              </Button>
            </div>
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm"
            />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[11px] text-muted-foreground self-center mr-1">Filter by tag:</span>
                {allTags.map(t => (
                  <Badge
                    key={t}
                    variant={selectedTags.has(t) ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px]"
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </Badge>
                ))}
                {selectedTags.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer text-[10px] text-muted-foreground"
                    onClick={() => setSelectedTags(new Set())}
                  >
                    Clear
                  </Badge>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground mr-1">Quick pick:</span>
              {[250, 350, 500, 700, 1000].map(n => (
                <Button
                  key={n}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2"
                  disabled={filteredContacts.length === 0}
                  onClick={() => selectFirstN(n)}
                >
                  {n > filteredContacts.length ? `All (${filteredContacts.length})` : n}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={filteredContacts.length === 0}
                onClick={() => selectFirstN(filteredContacts.length)}
              >
                All ({filteredContacts.length})
              </Button>
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {searching
                    ? 'Searching…'
                    : hiddenOptedOutMatches > 0
                    ? `No contacts — ${hiddenOptedOutMatches} match${hiddenOptedOutMatches > 1 ? 'es' : ''} hidden because they unsubscribed (uncheck "Exclude unsubscribed" to see them)`
                    : 'No contacts'}
                </p>
              ) : (
                filteredContacts.map(c => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-0"
                  >
                    <Checkbox
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(selectedIds);
                        if (checked) next.add(c.id); else next.delete(c.id);
                        setSelectedIds(next);
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{c.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.phoneNumber}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Only send to contacts who opted in. Marketing messages to non-opted-in numbers will get reported and tank your quality rating.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 pt-3 border-t sm:flex sm:justify-end">
          <Button className="h-11 sm:h-10" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button className="h-11 min-w-0 whitespace-normal sm:h-10" onClick={handleSend} disabled={sending || !name.trim() || !templateName || selectedIds.size === 0}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            {scheduledAt ? 'Schedule for ' + format(new Date(scheduledAt), 'MMM d, HH:mm') : `Send to ${selectedIds.size} contact${selectedIds.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Date at `hour` today (dayOffset 0) or +dayOffset days; if already past today, rolls to tomorrow.
function atHour(dayOffset: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function UtmBuilder({
  campaignName, variableCount, onInsert,
}: { campaignName: string; variableCount: number; onInsert: (url: string, varIndex: number) => void }) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [source, setSource] = useState('whatsapp');
  const [medium, setMedium] = useState('campaign');
  const [campaign, setCampaign] = useState('');
  const [content, setContent] = useState('');
  const [insertInto, setInsertInto] = useState<string>('1');

  useEffect(() => {
    if (!campaign && campaignName) setCampaign(slugify(campaignName));
  }, [campaignName]);

  const builtUrl = useMemo(() => {
    if (!baseUrl.trim()) return '';
    try {
      const u = new URL(baseUrl.trim());
      if (source) u.searchParams.set('utm_source', source);
      if (medium) u.searchParams.set('utm_medium', medium);
      if (campaign) u.searchParams.set('utm_campaign', campaign);
      if (content) u.searchParams.set('utm_content', content);
      return u.toString();
    } catch {
      return '';
    }
  }, [baseUrl, source, medium, campaign, content]);

  const copy = async () => {
    if (!builtUrl) return;
    await navigator.clipboard.writeText(builtUrl);
    toast.success('UTM link copied');
  };

  const insert = () => {
    if (!builtUrl) return;
    const idx = parseInt(insertInto, 10) - 1;
    onInsert(builtUrl, idx);
    toast.success(`Inserted into {{${idx + 1}}}`);
  };

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50"
      >
        <span className="flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> UTM link builder
          <span className="text-muted-foreground font-normal">(track clicks in your analytics)</span>
        </span>
        <span className="text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="p-3 border-t space-y-2">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Destination URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://yourshop.com/products/new-lamp"
              className="text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Source</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} className="text-sm h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Medium</Label>
              <Input value={medium} onChange={(e) => setMedium(e.target.value)} className="text-sm h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Campaign</Label>
              <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} className="text-sm h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Content (optional)</Label>
              <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="variant-a" className="text-sm h-8" />
            </div>
          </div>
          {builtUrl && (
            <div className="bg-muted/40 rounded px-2 py-1.5 text-[11px] font-mono break-all">{builtUrl}</div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copy} disabled={!builtUrl} className="h-8">
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            {variableCount > 0 && (
              <>
                <span className="text-[11px] text-muted-foreground">Insert into</span>
                <Select value={insertInto} onValueChange={setInsertInto}>
                  <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: variableCount }, (_, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{`{{${i + 1}}}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={insert} disabled={!builtUrl} className="h-8">
                  Insert
                </Button>
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            View results in Google Analytics / Shopify under Source = {source || 'whatsapp'}, Campaign = {campaign || '—'}.
          </p>
        </div>
      )}
    </div>
  );
}

