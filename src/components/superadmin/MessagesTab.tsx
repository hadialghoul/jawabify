import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Loader2, Send, MessageSquare, Sparkles, BookOpen, Save, Languages, Upload, Search, Plus, Trash2, Paperclip, Image as ImageIcon, FileText } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChannelBadge } from '@/components/chat/ChannelBadge';
import { ImportContactsDialog } from '@/components/crm/ImportContactsDialog';
import type { ChannelPlatform } from '@/types/chat';
import { handleSanitizedPaste } from '@/lib/textPaste';
import { VoiceRecorderButton } from '@/components/chat/VoiceRecorderButton';
import { MediaAttachment } from '@/components/chat/MediaAttachment';
import { formatBytes, mediaPlaceholder } from '@/lib/chatMedia';
import { enqueueSend, mediaStoragePath, withRetry } from '@/lib/sendQueue';




interface Tenant { id: string; name: string; ai_replies_enabled: boolean }
interface ContactRow { id: string; name: string | null; phone_number: string; updated_at: string | null; platform: ChannelPlatform | null; handle?: string | null; unread_count?: number }

const contactSubtitle = (c: { phone_number: string; handle?: string | null; platform: ChannelPlatform | null }) =>
  (c.platform === 'instagram' || c.phone_number?.startsWith('ig:'))
    ? (c.handle ? `@${c.handle}` : 'Instagram')
    : c.phone_number;
interface MessageRow { id: string; contact_id: string; content: string; direction: 'incoming' | 'outgoing'; status: string; created_at: string; platform: ChannelPlatform | null; media_url?: string | null; media_type?: string | null; error_message?: string | null }

// Pasted numbers/names often carry invisible bidi marks or Arabic-Indic digits.
const sanitizeText = (v: string) =>
  v
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();

const digitsOnly = (v: string) => sanitizeText(v).replace(/\D/g, '');

// "03 306 156" / "00961 3 306156" -> matches stored E.164 numbers
const normalizePhoneQuery = (v: string) => {
  let d = digitsOnly(v);
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
};

export function SuperAdminMessagesTab() {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: mem } = await supabase.from('tenant_members').select('tenant_id').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
      let tenantRow: Tenant | null = null;
      if (mem?.tenant_id) {
        const { data } = await supabase.from('tenants').select('id,name,ai_replies_enabled').eq('id', mem.tenant_id).maybeSingle();
        tenantRow = data as Tenant | null;
      }
      if (!tenantRow) {
        const { data: created, error } = await supabase.from('tenants').insert({
          name: 'Super Admin Inbox', owner_user_id: user.id, vertical: 'service', ai_replies_enabled: false,
        }).select('id,name,ai_replies_enabled').single();
        if (error) { toast({ title: 'Failed to create admin tenant', description: error.message, variant: 'destructive' }); setLoading(false); return; }
        await supabase.from('tenant_members').insert({ tenant_id: created.id, user_id: user.id, role: 'owner' });
        tenantRow = created as Tenant;
      }
      setTenant(tenantRow);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  if (!tenant) return <Card className="p-6">Could not initialize admin tenant.</Card>;

  return (
    <div className="space-y-4">
      <AiControls tenant={tenant} onChange={setTenant} />
      <KnowledgeCard tenantId={tenant.id} />
      <MessagesInbox tenantId={tenant.id} />
    </div>
  );
}

type AiLanguage = 'all' | 'english' | 'arabizi' | 'arabic' | 'french';

const AI_LANGUAGE_OPTIONS: { value: AiLanguage; label: string; hint: string }[] = [
  { value: 'all', label: 'All languages (mirror customer)', hint: 'AI replies in whatever language the customer writes in.' },
  { value: 'english', label: 'English only', hint: 'AI always replies in English.' },
  { value: 'arabizi', label: 'Arabizi only', hint: 'AI always replies in Lebanese Arabizi (Latin letters).' },
  { value: 'arabic', label: 'Arabic only', hint: 'AI always replies in Arabic script.' },
  { value: 'french', label: 'French only', hint: 'AI always replies in French.' },
];

function AiControls({ tenant, onChange }: { tenant: Tenant; onChange: (t: Tenant) => void }) {
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState<AiLanguage>('all');
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings')
        .select('value').eq('tenant_id', tenant.id).eq('key', 'ai_reply_language').maybeSingle();
      if (data?.value) {
        const v = typeof data.value === 'string' ? data.value.replace(/^"|"$/g, '') : String(data.value);
        setLanguage(v as AiLanguage);
      }
    })();
  }, [tenant.id]);

  const saveLanguage = async (lang: AiLanguage) => {
    const prev = language;
    setLanguage(lang);
    setSavingLang(true);
    const { data: existing } = await supabase.from('app_settings')
      .select('id').eq('tenant_id', tenant.id).eq('key', 'ai_reply_language').maybeSingle();
    const { error } = existing
      ? await supabase.from('app_settings').update({ value: lang }).eq('id', existing.id)
      : await supabase.from('app_settings').insert({ tenant_id: tenant.id, key: 'ai_reply_language', value: lang });
    setSavingLang(false);
    if (error) {
      setLanguage(prev);
      toast({ title: 'Failed to save reply language', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'AI reply language updated' });
  };

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    const { error } = await supabase.from('tenants').update({ ai_replies_enabled: enabled }).eq('id', tenant.id);
    if (error) { toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    const { data: existing } = await supabase.from('app_settings')
      .select('id').eq('tenant_id', tenant.id).eq('key', 'ai_replies_enabled').maybeSingle();
    if (existing) await supabase.from('app_settings').update({ value: enabled }).eq('id', existing.id);
    else await supabase.from('app_settings').insert({ tenant_id: tenant.id, key: 'ai_replies_enabled', value: enabled });
    onChange({ ...tenant, ai_replies_enabled: enabled });
    toast({ title: enabled ? 'AI auto-reply enabled' : 'AI auto-reply disabled' });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> AI Auto-Reply</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            When on, the AI replies to incoming WhatsApp messages using the knowledge base below.
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch checked={tenant.ai_replies_enabled} onCheckedChange={toggle} disabled={saving} />
            <Label className="text-sm">{tenant.ai_replies_enabled ? 'On' : 'Off'}</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Languages className="h-4 w-4" /> AI Reply Language</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 max-w-sm">
            <Select value={language} onValueChange={(v) => saveLanguage(v as AiLanguage)} disabled={savingLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AI_LANGUAGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingLang && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {AI_LANGUAGE_OPTIONS.find((o) => o.value === language)?.hint}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


function KnowledgeCard({ tenantId }: { tenantId: string }) {
  const [rowId, setRowId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('ai_knowledge')
        .select('id, content')
        .eq('tenant_id', tenantId)
        .eq('type', 'manual')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) { setRowId(data.id); setContent(data.content || ''); }
      setLoading(false);
    })();
  }, [tenantId]);

  const save = async () => {
    setSaving(true);
    const payload = { tenant_id: tenantId, title: 'Super Admin Knowledge', content, type: 'manual', is_active: true };
    let id = rowId;
    if (rowId) {
      const { error } = await supabase.from('ai_knowledge').update({ content, is_active: true }).eq('id', rowId);
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('ai_knowledge').insert(payload).select('id').single();
      if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      id = data.id; setRowId(id);
    }
    // Trigger embedding so the webhook retrieves it
    if (id) supabase.functions.invoke('embed-knowledge', { body: { id } }).catch(() => {});
    toast({ title: 'Knowledge saved' });
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Knowledge Base</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Teach the AI what to say. Include pricing, features, FAQ, tone. Saved once, used for every auto-reply.
        </p>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin h-4 w-4" /></div>
        ) : (
          <>
            <Textarea
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Jawabify is a WhatsApp automation platform. Pricing starts at $45/month. We support 20+ languages..."
            />
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving || !content.trim()} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save knowledge
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MessagesInbox({ tenantId }: { tenantId: string }) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [messages, setMessages] = useState<Record<string, MessageRow[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [newTo, setNewTo] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [channel, setChannel] = useState<'all' | ChannelPlatform>('all');
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [remoteResults, setRemoteResults] = useState<ContactRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [openedRow, setOpenedRow] = useState<ContactRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);


  const loadContacts = async () => {
    const { data } = await supabase.from('contacts').select('id,name,phone_number,updated_at,platform,handle')
      .eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(200);
    const rows = (data as ContactRow[]) || [];

    // Every conversation with unread incoming messages, even outside the loaded page
    // (e.g. broadcast replies from contacts far down the list).
    const unreadMap: Record<string, number> = {};
    const { data: unreadRows } = await (supabase.rpc as any)('get_unread_contact_ids', {
      p_tenant_id: tenantId,
      p_limit: 2000,
    });
    for (const row of (unreadRows || []) as any[]) {
      if (row.unread_count > 0) unreadMap[row.contact_id] = row.unread_count;
    }

    const known = new Set(rows.map((c) => c.id));
    const missing = Object.keys(unreadMap).filter((id) => !known.has(id));
    const extra: ContactRow[] = [];
    for (let i = 0; i < missing.length; i += 200) {
      const { data: more } = await supabase.from('contacts')
        .select('id,name,phone_number,updated_at,platform,handle')
        .in('id', missing.slice(i, i + 200));
      extra.push(...((more as ContactRow[]) || []));
    }

    const merged = [...rows, ...extra].map((c) => ({ ...c, unread_count: unreadMap[c.id] || 0 }));
    merged.sort((a, b) => {
      const au = (a.unread_count ?? 0) > 0 ? 1 : 0;
      const bu = (b.unread_count ?? 0) > 0 ? 1 : 0;
      if (au !== bu) return bu - au;
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    });
    setContacts(merged);
  };


  // Mark incoming delivered messages as read when the conversation is opened.
  const markAsRead = async (contactId: string) => {
    await supabase.from('messages').update({ status: 'read' })
      .eq('contact_id', contactId).eq('direction', 'incoming').eq('status', 'delivered');
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, unread_count: 0 } : c)));
  };

  const openContact = (contact: ContactRow) => {
    setOpenedRow(contact);
    setSelected(contact.id);
    markAsRead(contact.id);
  };

  const loadMessages = async (contactId: string) => {
    const { data } = await supabase.from('messages')
      .select('id,contact_id,content,direction,status,created_at,platform,media_url,media_type,error_message')
      .eq('contact_id', contactId).order('created_at', { ascending: true }).limit(200);
    setMessages((m) => ({ ...m, [contactId]: (data as MessageRow[]) || [] }));


    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  };

  useEffect(() => { loadContacts(); }, [tenantId]);
  useEffect(() => { if (selected) loadMessages(selected); }, [selected]);

  useEffect(() => {
    const channel = supabase.channel(`admin-inbox-${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
        const row = payload.new || payload.old;
        if (!row?.contact_id) return;
        // A newly delivered incoming message while the chat is open should stay marked as read.
        if (row.contact_id === selected && row.direction === 'incoming' && row.status === 'delivered') {
          markAsRead(row.contact_id);
        }
        loadContacts();
        if (row.contact_id === selected) loadMessages(selected);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts', filter: `tenant_id=eq.${tenantId}` }, () => loadContacts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, selected]);

  const selectedContact = useMemo(
    () =>
      contacts.find((c) => c.id === selected) ||
      remoteResults.find((c) => c.id === selected) ||
      (openedRow && openedRow.id === selected ? openedRow : null),
    [contacts, remoteResults, openedRow, selected],
  );

  // Local numbers typed without a country code (e.g. "81720561" or "081720561")
  // must become +961… — otherwise the contact never matches real inbound traffic.
  const toE164 = (input: string) => {
    const raw = input.trim().replace(/[^\d+]/g, '');
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    const digits = raw.replace(/^0+/, '');
    if (digits.length <= 8) return `+961${digits}`;
    return `+${digits}`;
  };

  const startNewChat = async () => {
    const phone = toE164(newTo || search);
    if (!phone) return;
    const { data: existing } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).eq('phone_number', phone).maybeSingle();

    let id = existing?.id;
    if (!id) {
      const { data, error } = await supabase.from('contacts').insert({ tenant_id: tenantId, phone_number: phone, name: phone, ai_enabled: false }).select('id').single();
      if (error) { toast({ title: 'Could not add contact', description: error.message, variant: 'destructive' }); return; }
      id = data.id;
    }
    setNewTo(""); setSearch("");
    await loadContacts();
    setSelected(id!);
  };

  const addContact = async () => {
    const digits = sanitizeText(addPhone).replace(/\D/g, '');
    if (digits.length < 6) {
      toast({ title: 'Invalid phone number', description: 'Enter a valid phone number with at least 6 digits.', variant: 'destructive' });
      return;
    }
    const phone = toE164(sanitizeText(addPhone));

    setAdding(true);
    const { data, error } = await supabase.from('contacts').insert({
      tenant_id: tenantId,
      phone_number: phone,
      name: sanitizeText(addName) || phone,
      ai_enabled: false,
      platform: 'whatsapp',
    }).select('id,name,phone_number,updated_at,platform,handle').single();
    setAdding(false);
    if (error) {
      toast({ title: 'Could not add contact', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Contact added' });
    setAddOpen(false);
    setAddName('');
    setAddPhone('');
    await loadContacts();
    setSelected(data.id);
  };

  const deleteChat = async () => {
    if (!selectedContact) return;
    setDeleting(true);
    const contactId = selectedContact.id;
    const { error: messagesError } = await supabase.from('messages').delete().eq('contact_id', contactId);
    if (messagesError) {
      toast({ title: 'Failed to delete messages', description: messagesError.message, variant: 'destructive' });
      setDeleting(false);
      return;
    }
    const { error: contactError } = await supabase.from('contacts').delete().eq('id', contactId);
    if (contactError) {
      toast({ title: 'Failed to delete contact', description: contactError.message, variant: 'destructive' });
      setDeleting(false);
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setMessages((prev) => { const next = { ...prev }; delete next[contactId]; return next; });
    setSelected(null);
    setDeleteOpen(false);
    setDeleting(false);
    toast({ title: 'Chat deleted' });
  };

  const localMatches = useMemo(() => {
    const raw = sanitizeText(search);
    const q = raw.toLowerCase();
    const phoneQuery = normalizePhoneQuery(raw);
    return contacts.filter((c) => {
      if (channel !== 'all' && (c.platform || 'whatsapp') !== channel) return false;
      if (!q) return true;
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.handle?.toLowerCase().includes(q.replace('@', ''))) return true;
      if (phoneQuery && digitsOnly(c.phone_number || '').includes(phoneQuery)) return true;
      return false;
    });
  }, [contacts, channel, search]);

  // Contacts are loaded in a capped page, so fall back to a database search.
  useEffect(() => {
    const raw = sanitizeText(search);
    if (raw.length < 3 || localMatches.length > 0) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const digits = normalizePhoneQuery(raw);
      const filters = [`name.ilike.%${raw}%`, `handle.ilike.%${raw}%`];
      if (digits) filters.push(`phone_number.ilike.%${digits}%`);
      const { data } = await supabase.from('contacts')
        .select('id,name,phone_number,updated_at,platform,handle')
        .eq('tenant_id', tenantId).or(filters.join(','))
        .order('updated_at', { ascending: false }).limit(50);
      if (!cancelled) {
        setRemoteResults((data as ContactRow[]) || []);
        setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, localMatches.length, tenantId]);

  const visibleContacts = useMemo(
    () => (localMatches.length > 0
      ? localMatches
      : remoteResults.filter((c) => channel === 'all' || (c.platform || 'whatsapp') === channel)),
    [localMatches, remoteResults, channel],
  );

  const send = async () => {
    if (!selectedContact || (!draft.trim() && !attachment)) return;
    const contact = selectedContact;
    const platform: ChannelPlatform = (contact.platform as ChannelPlatform) || 'whatsapp';
    const text = draft.trim();
    const file = attachment;

    // Clear the composer right away so the next item can be queued immediately.
    setDraft('');
    setAttachment(null);
    setSending(true);

    // Queued per contact: image → text → file bursts all send, in order.
    await enqueueSend(`admin-chat:${contact.id}`, async () => {
      try {
        let mediaUrl: string | undefined;
        let mediaType: string | undefined;

        if (file) {
          const path = mediaStoragePath(contact.id, file.name);
          const up = await withRetry(async () => {
            const res = await supabase.storage
              .from('chat-media')
              .upload(path, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: true,
              });
            if (res.error) throw res.error;
            return res.data;
          });
          mediaUrl = supabase.storage.from('chat-media').getPublicUrl(up.path).data.publicUrl;
          mediaType = file.type || 'application/octet-stream';
        }

        const data = await withRetry(async () => {
          const res = platform === 'instagram'
            ? await supabase.functions.invoke('send-instagram', {
                body: { contactId: contact.id, message: text, mediaUrl, mediaType },
              })
            : await supabase.functions.invoke('send-whatsapp', {
                body: {
                  to: contact.phone_number,
                  message: text,
                  mediaUrl,
                  mediaType,
                  fileName: file?.name,
                },
              });
          if (res.error) throw res.error;
          if ((res.data as any)?.error) throw new Error((res.data as any).error);
          return res.data;
        });

        if (platform !== 'instagram') {
          await supabase.from('messages').insert({
            contact_id: contact.id,
            content: text || (file ? mediaPlaceholder(mediaType, file.name) : ''),
            direction: 'outgoing', status: 'sent', platform,
            twilio_sid: (data as any)?.messageSid || null,
            media_url: mediaUrl ?? null, media_type: mediaType ?? null,
          } as any);
        }

        loadMessages(contact.id);
      } catch (err) {
        toast({
          title: file ? `Failed to send ${file.name}` : 'Send failed',
          description: err instanceof Error ? err.message : undefined,
          variant: 'destructive',
        });
      } finally {
        setSending(false);
      }
    });
  };


  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAttachment(file);
    e.target.value = '';
  };


  const channelTabs: Array<{ key: 'all' | ChannelPlatform; label: string }> = [
    { key: 'all', label: 'All chats' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'instagram', label: 'Instagram' },
  ];

  return (
      <Card className="overflow-hidden">
       <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <MessageSquare className="h-4 w-4" />
        <h3 className="font-semibold">Inbox</h3>
        <span className="text-xs text-muted-foreground">({visibleContacts.length})</span>
        <div className="flex w-full gap-1 overflow-x-auto pb-1 sm:ml-auto sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
          {channelTabs.map((t) => (
             <Button key={t.key} size="sm" variant={channel === t.key ? 'default' : 'outline'}
              className="h-11 shrink-0 px-3 text-xs sm:h-7 sm:px-2" onClick={() => setChannel(t.key)}>
              {t.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-11 shrink-0 px-3 text-xs sm:h-7 sm:px-2" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> Import contacts
          </Button>
        </div>
      </div>
      <ImportContactsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tenantId={tenantId}
        onImported={loadContacts}
      />
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add new contact</DialogTitle>
            <DialogDescription>Enter the phone number and optional name. The contact will be added to this inbox.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="add-phone" className="text-sm">Phone number</Label>
              <Input
                id="add-phone"
                placeholder="+961 3 123 456"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-name" className="text-sm">Name (optional)</Label>
              <Input
                id="add-name"
                placeholder="John Doe"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={addContact} disabled={adding || !addPhone.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add contact'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              This will permanently delete the conversation with <span className="font-medium text-foreground">{selectedContact?.name || contactSubtitle(selectedContact || { phone_number: '', platform: 'whatsapp' })}</span> and all its messages. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 py-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={deleteChat} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid min-h-[calc(100dvh-13rem)] md:min-h-[500px] md:grid-cols-[280px_1fr]">
        <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} min-h-0 flex-col md:border-r`}>
          <div className="p-2 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-7 h-9" placeholder="Search name or number…" value={search}
                onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button size="icon" variant="outline" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" onClick={() => setAddOpen(true)} title="Add contact">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto md:max-h-[500px]">
            {visibleContacts.length === 0 && searching && (
              <p className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Searching all conversations…</p>
            )}
            {visibleContacts.length === 0 && !searching && (
              <div className="p-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {search.trim() ? `No results for “${search.trim()}”.` : 'No conversations in this channel yet.'}
                </p>
                {normalizePhoneQuery(sanitizeText(search)).length >= 6 && (
                  <Button size="sm" variant="outline" onClick={startNewChat}>
                    Start chat with {search.trim()}
                  </Button>
                )}
              </div>
            )}
            {visibleContacts.map((c) => {
              const unread = (c.unread_count ?? 0) > 0;
              return (
                <button key={c.id} onClick={() => openContact(c)}
                  className={`min-h-14 w-full border-b px-3 py-2 text-left hover:bg-muted/50 ${selected === c.id ? 'bg-muted' : ''}`}>
                  <div className="flex items-center gap-1.5">
                    <ChannelBadge platform={(c.platform as ChannelPlatform) || 'whatsapp'} compact />
                    <div className={`text-sm truncate ${unread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>
                      {c.name || contactSubtitle(c)}
                    </div>
                    {unread && (
                      <span className="ml-auto flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/40">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{contactSubtitle(c)}</div>
                </button>
              );
            })}
          </div>
        </div>


        <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} min-h-0 flex-col md:min-h-[500px]`}>
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
              Select a conversation to view messages.
            </div>
          ) : (
            <>
              <div className="border-b p-2 sm:p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 md:hidden" onClick={() => setSelected(null)} aria-label="Back to conversations">
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="font-medium text-sm truncate">{selectedContact.name || contactSubtitle(selectedContact)}</div>
                    <ChannelBadge platform={(selectedContact.platform as ChannelPlatform) || 'whatsapp'} />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-11 w-11 text-destructive hover:text-destructive shrink-0 sm:h-8 sm:w-8"
                    title="Delete chat"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">{contactSubtitle(selectedContact)}</div>
              </div>
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 md:max-h-[420px] md:p-4">
                {(messages[selectedContact.id] || []).map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg px-3 py-2 max-w-[88%] sm:max-w-[75%] text-sm whitespace-pre-wrap break-words ${
                      m.direction === 'outgoing' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {m.media_url && (
                        <div className="mb-1">
                          <MediaAttachment url={m.media_url} type={m.media_type || undefined} />
                        </div>
                      )}
                      {m.content && m.content !== mediaPlaceholder(m.media_type || undefined) && (
                        <span dir="auto" className="block">{m.content}</span>
                      )}
                      <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                        <ChannelBadge platform={(m.platform as ChannelPlatform) || (selectedContact.platform as ChannelPlatform) || 'whatsapp'} compact />
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                        {m.status === 'failed' && <span className="font-semibold">· not delivered</span>}
                      </div>
                      {m.status === 'failed' && m.error_message && (
                        <div className="mt-1 text-[10px] font-medium opacity-90">{m.error_message}</div>
                      )}

                    </div>

                  </div>
                ))}
                {(messages[selectedContact.id] || []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                )}
              </div>
              <div className="safe-bottom border-t p-2 space-y-2">
                {attachment && (
                  <div className="flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[220px]">{attachment.name}</span>
                    <span className="text-muted-foreground">{formatBytes(attachment.size)}</span>
                    <button
                      className="ml-auto text-destructive"
                      onClick={() => setAttachment(null)}
                      title="Remove attachment"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
                  <input ref={fileInputRef} type="file" className="hidden" onChange={onPickFile} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                       <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" title="Attach">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="bg-popover">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => imageInputRef.current?.click()}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Photo
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="mr-2 h-4 w-4" />
                        Document
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Textarea rows={1} dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)}
                    onPaste={(e) => handleSanitizedPaste(e, setDraft)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    className="h-11 min-h-11 w-0 min-w-0 flex-1 resize-none py-2.5 text-base sm:h-9 sm:min-h-9 sm:py-2"
                    placeholder="Type a message..." />
                  {draft.trim() || attachment ? (
                    <Button onClick={send} disabled={sending} size="icon" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  ) : (
                    <VoiceRecorderButton onRecorded={setAttachment} className="h-11 w-11 shrink-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 sm:h-9 sm:w-9" />
                  )}
                </div>

              </div>

            </>
          )}
        </div>
      </div>
    </Card>
  );
}
