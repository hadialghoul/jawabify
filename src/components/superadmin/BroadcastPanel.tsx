import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Megaphone, Send } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Badge, Button, Input } from '../ui';
import { colors, radius } from '../../theme';

interface ContactRow {
  id: string;
  name: string | null;
  phone_number: string;
  opted_out?: boolean | null;
}

export function SuperAdminBroadcastPanel() {
  const { user } = useAuth();
  const toast = useToast();
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
      const { data: mem } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!mem?.tenant_id) {
        setLoading(false);
        return;
      }
      setTenantId(mem.tenant_id);
      const { data } = await supabase
        .from('contacts')
        .select('id, name, phone_number, opted_out')
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
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const send = async () => {
    if (!message.trim() || selected.size === 0) return;
    const recipients = contacts.filter((c) => selected.has(c.id));
    setSending(true);
    setProgress({ sent: 0, failed: 0, total: recipients.length });
    let sent = 0;
    let failed = 0;
    for (const c of recipients) {
      try {
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
          body: { to: c.phone_number, message: message.trim() },
        });
        if (error || (data as any)?.error) failed++;
        else {
          sent++;
          await supabase.from('messages').insert({
            contact_id: c.id,
            content: message.trim(),
            direction: 'outgoing',
            status: 'sent',
            tenant_id: tenantId,
          } as any);
        }
      } catch {
        failed++;
      }
      setProgress({ sent, failed, total: recipients.length });
      await new Promise((r) => setTimeout(r, 220));
    }
    setSending(false);
    toast.success(`Broadcast complete: ${sent} sent, ${failed} failed`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!tenantId) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Could not load admin tenant for broadcast.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={styles.head}>
        <Megaphone size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Broadcast</Text>
          <Text style={styles.meta}>Send a free-text blast to hand-picked contacts on the Jawabify support number.</Text>
        </View>
      </View>

      <Input placeholder="Message…" value={message} onChangeText={setMessage} multiline style={{ minHeight: 90 }} />
      <Input placeholder="Search contacts…" value={q} onChangeText={setQ} />
      <View style={styles.row}>
        <Text style={styles.meta}>Hide opted-out</Text>
        <Switch value={hideOptedOut} onValueChange={setHideOptedOut} />
      </View>
      <View style={styles.row}>
        <Button title="Select all filtered" variant="outline" onPress={() => setSelected(new Set(filtered.map((c) => c.id)))} />
        <Button title="Clear" variant="ghost" onPress={() => setSelected(new Set())} />
        <Badge label={`${selected.size} selected`} />
      </View>

      {filtered.map((c) => {
        const on = selected.has(c.id);
        return (
          <Pressable key={c.id} style={[styles.card, on && styles.cardOn]} onPress={() => toggle(c.id)}>
            <Text style={styles.name}>{c.name || c.phone_number}</Text>
            <Text style={styles.meta}>{c.phone_number}</Text>
            {c.opted_out ? <Badge label="opted out" tone="muted" /> : null}
          </Pressable>
        );
      })}

      {progress ? (
        <Text style={styles.meta}>
          Progress: {progress.sent} sent · {progress.failed} failed · {progress.total} total
        </Text>
      ) : null}

      <Button
        title={sending ? 'Sending…' : 'Send broadcast'}
        icon={<Send size={14} color="#fff" />}
        loading={sending}
        disabled={!message.trim() || selected.size === 0}
        onPress={send}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 10, paddingBottom: 24 },
  center: { padding: 24, alignItems: 'center' },
  head: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, backgroundColor: colors.card, gap: 4 },
  cardOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
