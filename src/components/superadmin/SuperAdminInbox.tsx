import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Switch,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { ArrowLeft, BookOpen, Bot, MessageSquare, Save, Send, Trash2 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Button, Input } from '../ui';
import { useSafeHeaderPad } from '../ScreenHeader';
import { avatarColor, colors, initials, radius } from '../../theme';

interface ContactRow {
  id: string;
  name: string | null;
  phone_number: string;
  updated_at: string | null;
  platform: string | null;
  handle?: string | null;
  unread_count?: number;
}

interface MessageRow {
  id: string;
  contact_id: string;
  content: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  created_at: string;
}

function contactSubtitle(c: ContactRow) {
  if (c.platform === 'instagram' || c.phone_number?.startsWith('ig:')) {
    return c.handle ? `@${c.handle}` : 'Instagram';
  }
  return c.phone_number;
}


function AdminAiControls({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('tenants').select('ai_replies_enabled').eq('id', tenantId).maybeSingle();
      if (data) setEnabled(data.ai_replies_enabled !== false);
    })();
  }, [tenantId]);

  const save = async (v: boolean) => {
    setEnabled(v);
    setSaving(true);
    const { error } = await supabase.from('tenants').update({ ai_replies_enabled: v }).eq('id', tenantId);
    if (error) toast.error(error.message);
    else toast.success(v ? 'AI replies ON' : 'AI replies OFF');
    setSaving(false);
  };

  return (
    <View style={styles.cardBlock}>
      <View style={styles.blockHead}>
        <Bot size={16} color={colors.primary} />
        <Text style={styles.h1}>AI auto-replies</Text>
      </View>
      <Text style={styles.meta}>Master switch for the Super Admin support inbox AI.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={styles.name}>{enabled ? 'Enabled' : 'Disabled'}</Text>
        <Switch value={enabled} disabled={saving} onValueChange={save} />
      </View>
    </View>
  );
}

function AdminKnowledge({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [content, setContent] = useState('');
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('ai_knowledge')
        .select('id, content')
        .eq('tenant_id', tenantId)
        .eq('type', 'manual')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setContent(data.content || '');
      }
      setLoading(false);
    })();
  }, [tenantId]);

  const save = async () => {
    setSaving(true);
    if (rowId) {
      const { error } = await supabase.from('ai_knowledge').update({ content, is_active: true }).eq('id', rowId);
      if (error) toast.error(error.message);
      else {
        supabase.functions.invoke('embed-knowledge', { body: { id: rowId } }).catch(() => {});
        toast.success('Knowledge saved');
      }
    } else {
      const { data, error } = await supabase
        .from('ai_knowledge')
        .insert({ tenant_id: tenantId, title: 'Super Admin Knowledge', content, type: 'manual', is_active: true } as any)
        .select('id')
        .single();
      if (error) toast.error(error.message);
      else if (data) {
        setRowId(data.id);
        supabase.functions.invoke('embed-knowledge', { body: { id: data.id } }).catch(() => {});
        toast.success('Knowledge saved');
      }
    }
    setSaving(false);
  };

  return (
    <View style={styles.cardBlock}>
      <View style={styles.blockHead}>
        <BookOpen size={16} color={colors.primary} />
        <Text style={styles.h1}>Knowledge base</Text>
      </View>
      <Text style={styles.meta}>Teach the AI what to say for support replies.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : (
        <>
          <Input placeholder="Pricing, features, FAQ, tone…" value={content} onChangeText={setContent} multiline style={{ minHeight: 120, marginTop: 8 }} />
          <Button title={saving ? 'Saving…' : 'Save knowledge'} icon={<Save size={14} color="#fff" />} loading={saving} onPress={save} />
        </>
      )}
    </View>
  );
}

export function SuperAdminInbox() {
  const { user } = useAuth();
  const toast = useToast();
  const headerPad = useSafeHeaderPad();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setBooting(true);
      const { data: mem } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      let tid = mem?.tenant_id as string | null;
      if (!tid) {
        const { data: created, error } = await supabase
          .from('tenants')
          .insert({
            name: 'Super Admin Inbox',
            owner_user_id: user.id,
            vertical: 'service',
            ai_replies_enabled: false,
          } as any)
          .select('id')
          .single();
        if (error || !created) {
          toast.error(error?.message || 'Failed to create admin inbox');
          setBooting(false);
          return;
        }
        await supabase.from('tenant_members').insert({
          tenant_id: created.id,
          user_id: user.id,
          role: 'owner',
        } as any);
        tid = created.id;
      }
      setTenantId(tid);
      setBooting(false);
    })();
  }, [user]);

  const loadContacts = useCallback(async () => {
    if (!tenantId) return;
    setLoadingContacts(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('id,name,phone_number,updated_at,platform,handle')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setContacts((data as ContactRow[]) || []);
    setLoadingContacts(false);
  }, [tenantId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const openContact = async (contact: ContactRow) => {
    setSelected(contact);
    setLoadingMessages(true);
    const { data } = await supabase
      .from('messages')
      .select('id,contact_id,content,direction,status,created_at')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data as MessageRow[]) || []);
    setLoadingMessages(false);
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('contact_id', contact.id)
      .eq('direction', 'incoming')
      .eq('status', 'delivered');
  };

  const send = async () => {
    if (!selected || !draft.trim() || !tenantId) return;
    setSending(true);
    const content = draft.trim();
    setDraft('');
    const { data, error } = await supabase
      .from('messages')
      .insert({
        tenant_id: tenantId,
        contact_id: selected.id,
        content,
        direction: 'outgoing',
        status: 'pending',
        platform: selected.platform || 'whatsapp',
      } as any)
      .select('id,contact_id,content,direction,status,created_at')
      .single();
    if (error) {
      toast.error(error.message);
      setDraft(content);
    } else if (data) {
      setMessages((prev) => [...prev, data as MessageRow]);
      await supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', selected.id);
      loadContacts();
    }
    setSending(false);
  };

  const deleteChat = (contact: ContactRow) => {
    Alert.alert(
      'Delete chat',
      `This will permanently delete the conversation with ${contact.name || contactSubtitle(contact)} and all its messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const contactId = contact.id;
            const { error: messagesError } = await supabase.from('messages').delete().eq('contact_id', contactId);
            if (messagesError) {
              toast.error(messagesError.message);
              setDeleting(false);
              return;
            }
            const { error: contactError } = await supabase.from('contacts').delete().eq('id', contactId);
            if (contactError) {
              toast.error(contactError.message);
              setDeleting(false);
              return;
            }
            setContacts((prev) => prev.filter((c) => c.id !== contactId));
            setMessages([]);
            setSelected((cur) => (cur?.id === contactId ? null : cur));
            setDeleting(false);
            toast.success('Chat deleted');
          },
        },
      ],
    );
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone_number || '').toLowerCase().includes(q) ||
        (c.handle || '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.meta}>Loading admin inbox…</Text>
      </View>
    );
  }

  if (!tenantId) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Could not initialize admin inbox.</Text>
      </View>
    );
  }

  if (selected) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={[styles.chatHeader, { paddingTop: headerPad }]}>
          <Pressable onPress={() => setSelected(null)} style={styles.iconBtn} hitSlop={12}>
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {selected.name || contactSubtitle(selected)}
            </Text>
            <Text style={styles.chatSub} numberOfLines={1}>
              {contactSubtitle(selected)}
            </Text>
          </View>
          <Pressable onPress={() => deleteChat(selected)} disabled={deleting} style={styles.iconBtn} hitSlop={12}>
            <Trash2 size={18} color="#fff" />
          </Pressable>
        </View>
        {loadingMessages ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <FlatList
            style={{ flex: 1, backgroundColor: colors.chatBg }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            data={messages}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No messages yet.</Text>}
            renderItem={({ item }) => {
              const out = item.direction === 'outgoing';
              return (
                <View style={[styles.bubble, out ? styles.bubbleOut : styles.bubbleIn]}>
                  <Text style={{ color: out ? '#fff' : colors.foreground }}>{item.content}</Text>
                  <Text style={[styles.bubbleMeta, out && { color: 'rgba(255,255,255,0.7)' }]}>
                    {format(new Date(item.created_at), 'HH:mm')}
                  </Text>
                </View>
              );
            }}
          />
        )}
        <View style={styles.composer}>
          <Input
            style={{ flex: 1 }}
            placeholder="Type a message…"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable onPress={send} disabled={sending || !draft.trim()} style={styles.sendBtn}>
            {sending ? <ActivityIndicator color="#fff" /> : <Send size={16} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AdminAiControls tenantId={tenantId} />
      <AdminKnowledge tenantId={tenantId} />
      <Text style={styles.h1}>Admin inbox</Text>
      <Text style={styles.meta}>WhatsApp messages to the Jawabify support number — same as the website.</Text>
      <Input placeholder="Search conversations…" value={search} onChangeText={setSearch} style={{ marginVertical: 10 }} />
      {loadingContacts ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <MessageSquare size={36} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No conversations yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const palette = avatarColor(item.id || item.name || item.phone_number);
            const time = item.updated_at
              ? (() => {
                  const d = new Date(item.updated_at);
                  if (isToday(d)) return format(d, 'HH:mm');
                  if (isYesterday(d)) return 'Yesterday';
                  if (differenceInDays(new Date(), d) < 7) return format(d, 'EEE');
                  return format(d, 'dd/MM/yy');
                })()
              : '';
            return (
              <Pressable onPress={() => openContact(item)} style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.avatarText, { color: palette.fg }]}>{initials(item.name || item.phone_number)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name || contactSubtitle(item)}
                    </Text>
                    <Text style={styles.time}>{time}</Text>
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {contactSubtitle(item)}
                  </Text>
                </View>
                <Pressable hitSlop={10} onPress={() => deleteChat(item)} style={styles.deleteIcon}>
                  <Trash2 size={16} color={colors.destructive} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
      <Button title="Refresh" variant="outline" onPress={loadContacts} style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  cardBlock: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 12, marginBottom: 10, gap: 4 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  meta: { color: colors.mutedForeground, fontSize: 13 },
  emptyText: { textAlign: 'center', color: colors.mutedForeground, padding: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 13 },
  name: { flex: 1, fontWeight: '700', color: colors.foreground, fontSize: 15 },
  time: { color: colors.mutedForeground, fontSize: 11 },
  deleteIcon: { padding: 8 },
  chatHeader: {
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 10,
    gap: 8,
  },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  chatTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chatSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  bubble: { maxWidth: '80%', borderRadius: radius.md, padding: 10, gap: 4 },
  bubbleIn: { alignSelf: 'flex-start', backgroundColor: colors.card },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleMeta: { fontSize: 10, color: colors.mutedForeground },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});