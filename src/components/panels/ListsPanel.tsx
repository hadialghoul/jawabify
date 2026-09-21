import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Check, CheckCheck, Mail, Phone, RefreshCw, Sparkles, UserRound } from 'lucide-react-native';
import type { Contact, Order } from '../../types';
import { colors, radius } from '../../theme';
import { Badge, Button, Input } from '../ui';
import { digitsOnly, normalizePhoneQuery, sanitizeQuery } from '../../lib/utils';
import type { FlaggedContact } from '../../hooks/useAppData';

export function CrmPanel({
  contacts,
  orders,
  onSelectContact,
}: {
  contacts: Contact[];
  orders: Order[];
  onSelectContact: (c: Contact) => void;
}) {
  const [query, setQuery] = useState('');
  const ordersByContact = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) if (o.contactId) m.set(o.contactId, (m.get(o.contactId) || 0) + 1);
    return m;
  }, [orders]);
  const rows = useMemo(() => {
    const q = sanitizeQuery(query).toLowerCase();
    const phoneQuery = normalizePhoneQuery(query);
    return contacts.filter((c) => {
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        (!!phoneQuery && digitsOnly(c.phoneNumber || '').includes(phoneQuery)) ||
        c.email?.toLowerCase().includes(q)
      );
    });
  }, [contacts, query]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <Text style={styles.h1}>CRM</Text>
        <Input placeholder="Search customers" value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item: c }) => (
          <Pressable onPress={() => onSelectContact(c)} style={styles.card}>
            <View style={styles.avatar}>
              <UserRound size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.phoneNumber}</Text>
              {c.email ? (
                <View style={styles.row}>
                  <Mail size={12} color={colors.mutedForeground} />
                  <Text style={styles.meta}>{c.email}</Text>
                </View>
              ) : null}
            </View>
            <Badge label={`${ordersByContact.get(c.id) || 0} orders`} tone="muted" />
          </Pressable>
        )}
      />
    </View>
  );
}

export function InterestedPanel({
  contacts,
  onSelectContact,
  onUnflag,
}: {
  contacts: Contact[];
  onSelectContact: (c: Contact) => void;
  onUnflag: (id: string) => void;
}) {
  const interested = contacts.filter((c) => c.isInterested);
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.head}>
        <Text style={styles.h1}>Interested customers</Text>
        <Text style={styles.sub}>Warm leads the AI flagged as buying-intent.</Text>
      </View>
      <FlatList
        data={interested}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        ListEmptyComponent={<Text style={styles.empty}>No interested customers yet.</Text>}
        renderItem={({ item: c }) => (
          <Pressable onPress={() => onSelectContact(c)} style={styles.card}>
            <Sparkles size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{c.interestReason || c.phoneNumber}</Text>
            </View>
            <Button title="Unflag" variant="outline" onPress={() => onUnflag(c.id)} />
          </Pressable>
        )}
      />
    </View>
  );
}

export function FlaggedPanel({
  flagged,
  onOpen,
  onResolve,
  onUnresolve,
}: {
  flagged: FlaggedContact[];
  onOpen: (phone: string) => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
}) {
  const unresolved = flagged.filter((c) => c.needsHuman);
  const resolved = flagged.filter((c) => !c.needsHuman);
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={styles.h1}>Flagged for human</Text>
      <Text style={styles.sub}>Customers the AI escalated.</Text>
      <Text style={styles.section}>Unresolved ({unresolved.length})</Text>
      {unresolved.length === 0 ? <Text style={styles.empty}>No unresolved flagged conversations.</Text> : null}
      {unresolved.map((c) => (
        <View key={c.id} style={styles.card}>
          <AlertCircle size={18} color={colors.destructive} />
          <Pressable onPress={() => onOpen(c.phoneNumber)} style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.meta}>{c.phoneNumber}</Text>
          </Pressable>
          <Button title="Resolve" variant="outline" onPress={() => onResolve(c.id)} />
        </View>
      ))}
      <Text style={styles.section}>Resolved ({resolved.length})</Text>
      {resolved.map((c) => (
        <View key={c.id} style={[styles.card, { opacity: 0.8 }]}>
          <CheckCheck size={18} color={colors.primary} />
          <Pressable onPress={() => onOpen(c.phoneNumber)} style={{ flex: 1 }}>
            <Text style={[styles.name, { textDecorationLine: 'line-through' }]}>{c.name}</Text>
            <Text style={styles.meta}>{c.phoneNumber}</Text>
          </Pressable>
          <Button title="Unresolve" variant="outline" onPress={() => onUnresolve(c.id)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card, gap: 10 },
  h1: { fontSize: 18, fontWeight: '800', color: colors.foreground },
  sub: { color: colors.mutedForeground, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 8,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '700', color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { textAlign: 'center', color: colors.mutedForeground, padding: 24 },
  section: { marginTop: 16, marginBottom: 8, fontWeight: '700', color: colors.destructive },
});
