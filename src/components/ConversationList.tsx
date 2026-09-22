import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { MessageCircle, MessageSquarePlus, Search, UserCheck } from 'lucide-react-native';
import { InstagramIcon } from './ChannelIcons';
import type { ChannelFilter, Contact } from '../types';
import { avatarColor, colors, initials, radius } from '../theme';
import { Input } from './ui';
import { digitsOnly, normalizePhoneQuery, sanitizeQuery } from '../lib/utils';
import { memberLabel, useTeamRoster } from '../hooks/useAppData';
import { useAuth } from '../hooks/useAuth';

type AssignmentFilter = 'all' | 'mine' | 'unassigned';

interface Props {
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (contact: Contact) => void;
  onNewChat: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onSearchContacts?: (query: string) => Promise<Contact[]>;
  channel?: ChannelFilter;
  onChannelChange?: (channel: ChannelFilter) => void;
  instagramConnected?: boolean;
  onConnectInstagram?: () => void;
  emptyLoading?: boolean;
}

export function ConversationList({
  contacts,
  selectedContactId,
  onSelectContact,
  onNewChat,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onSearchContacts,
  channel = 'all',
  onChannelChange,
  instagramConnected = false,
  onConnectInstagram,
  emptyLoading,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<Contact[]>([]);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [assignment, setAssignment] = useState<AssignmentFilter>('all');
  const { memberId } = useAuth();
  const { roster } = useTeamRoster();
  const isTeamAccount = roster.length > 1;
  const rosterById = useMemo(() => Object.fromEntries(roster.map((m) => [m.id, m])), [roster]);

  const filteredContacts = useMemo(() => {
    const raw = sanitizeQuery(searchQuery);
    const q = raw.toLowerCase();
    const phoneQuery = normalizePhoneQuery(raw);
    return contacts
      .filter((contact) => {
        if (channel !== 'all' && (contact.platform || 'whatsapp') !== channel) return false;
        if (isTeamAccount && assignment === 'mine' && contact.assignedMemberId !== memberId) return false;
        if (isTeamAccount && assignment === 'unassigned' && contact.assignedMemberId) return false;
        if (!q) return true;
        if (contact.name?.toLowerCase().includes(q)) return true;
        if (contact.handle?.toLowerCase().includes(q.replace('@', ''))) return true;
        if (phoneQuery && digitsOnly(contact.phoneNumber || '').includes(phoneQuery)) return true;
        return false;
      })
      .sort((a, b) => {
        const aUnread = (a.unreadCount ?? 0) > 0 ? 1 : 0;
        const bUnread = (b.unreadCount ?? 0) > 0 ? 1 : 0;
        if (bUnread !== aUnread) return bUnread - aUnread;
        return (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0);
      });
  }, [contacts, searchQuery, channel, assignment, isTeamAccount, memberId]);

  useEffect(() => {
    const raw = sanitizeQuery(searchQuery);
    if (!onSearchContacts || raw.length < 3 || filteredContacts.length > 0) {
      setRemoteResults([]);
      setRemoteSearching(false);
      return;
    }
    let cancelled = false;
    setRemoteSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await onSearchContacts(raw);
        if (!cancelled) setRemoteResults(found);
      } finally {
        if (!cancelled) setRemoteSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [searchQuery, filteredContacts.length, onSearchContacts]);

  const visibleContacts =
    filteredContacts.length > 0
      ? filteredContacts
      : remoteResults.filter((c) => channel === 'all' || (c.platform || 'whatsapp') === channel);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchWrap}>
        <Search size={16} color={colors.mutedForeground} style={styles.searchIcon} />
        <Input
          placeholder="Search conversations…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.search}
        />
        <Pressable onPress={onNewChat} style={styles.newBtn}>
          <MessageSquarePlus size={16} color={colors.primary} />
        </Pressable>
      </View>

      {onChannelChange ? (
        <View style={styles.pills}>
          {(['all', 'whatsapp', 'instagram'] as const).map((key) => {
            const label = key === 'all' ? 'All Chats' : key === 'whatsapp' ? 'WhatsApp' : instagramConnected ? 'Instagram' : 'Instagram +';
            const active = channel === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  if (key === 'instagram' && !instagramConnected) {
                    onConnectInstagram?.();
                    return;
                  }
                  onChannelChange(key);
                }}
                style={[styles.pill, active && styles.pillActive]}
              >
                {key === 'instagram' ? (
                  <InstagramIcon size={12} color={active ? colors.primary : colors.mutedForeground} />
                ) : key === 'whatsapp' ? (
                  <MessageCircle size={12} color={active ? colors.primary : colors.mutedForeground} />
                ) : null}
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {isTeamAccount ? (
        <View style={styles.pills}>
          {(['all', 'mine', 'unassigned'] as const).map((key) => (
            <Pressable key={key} onPress={() => setAssignment(key)} style={[styles.pill, assignment === key && styles.pillActive]}>
              <Text style={[styles.pillText, assignment === key && styles.pillTextActive]}>
                {key === 'all' ? 'All' : key === 'mine' ? 'Mine' : 'Unassigned'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {contacts.length === 0 && emptyLoading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.emptyText}>Loading conversations…</Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.empty}>
          <MessageCircle size={36} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No conversations yet for this account.</Text>
        </View>
      ) : contacts.length > 0 && visibleContacts.length === 0 && remoteSearching ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.emptyText}>Searching all conversations…</Text>
        </View>
      ) : contacts.length > 0 && visibleContacts.length === 0 ? (
        <Text style={styles.emptyText}>No conversations match "{searchQuery.trim()}".</Text>
      ) : (
        <FlatList
          data={visibleContacts}
          keyExtractor={(item) => item.id}
          onEndReached={() => hasMore && onLoadMore?.()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color={colors.primary} /> : null
          }
          renderItem={({ item: contact }) => {
            const unread = !!(contact.unreadCount && contact.unreadCount > 0);
            const selected = selectedContactId === contact.id;
            const palette = avatarColor(contact.id || contact.name);
            const time = contact.lastMessageTime
              ? (() => {
                  const d = new Date(contact.lastMessageTime);
                  if (isToday(d)) return format(d, 'HH:mm');
                  if (isYesterday(d)) return 'Yesterday';
                  if (differenceInDays(new Date(), d) < 7) return format(d, 'EEE');
                  return format(d, 'dd/MM/yy');
                })()
              : '';
            return (
              <Pressable onPress={() => onSelectContact(contact)} style={[styles.row, selected && styles.rowSelected]}>
                <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.avatarText, { color: palette.fg }]}>{initials(contact.name)}</Text>
                  <View style={[styles.channelDot, contact.platform === 'instagram' ? styles.ig : styles.wa]} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTop}>
                    <Text numberOfLines={1} style={styles.name}>
                      {contact.name}
                    </Text>
                    {time ? <Text style={[styles.time, unread && { color: colors.primary, fontWeight: '700' }]}>{time}</Text> : null}
                  </View>
                  <View style={styles.rowTop}>
                    <Text numberOfLines={1} style={[styles.preview, unread && { color: colors.foreground }]}>
                      {contact.lastMessage || 'No messages yet'}
                    </Text>
                    {unread ? (
                      <View style={styles.unread}>
                        <Text style={styles.unreadText}>{contact.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  {isTeamAccount ? (
                    <View style={styles.assign}>
                      <UserCheck size={12} color={contact.assignedMemberId === memberId ? colors.primary : colors.mutedForeground} />
                      <Text style={styles.assignText}>
                        {contact.assignedMemberId
                          ? contact.assignedMemberId === memberId
                            ? 'You'
                            : memberLabel(rosterById[contact.assignedMemberId])
                          : 'Unassigned'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.card },
  searchWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  searchIcon: { position: 'absolute', left: 24, top: 24, zIndex: 2 },
  search: { paddingLeft: 36, paddingRight: 40, backgroundColor: colors.muted, borderColor: 'transparent', minHeight: 36 },
  newBtn: { position: 'absolute', right: 20, top: 18, height: 28, width: 28, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.muted, borderRadius: radius.md, padding: 4, gap: 4 },
  pill: { flex: 1, borderRadius: 8, paddingVertical: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  pillActive: { backgroundColor: colors.card },
  pillText: { fontSize: 11, fontWeight: '700', color: colors.mutedForeground },
  pillTextActive: { color: colors.foreground },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { textAlign: 'center', color: colors.mutedForeground, padding: 24, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 8, borderRadius: radius.xl },
  rowSelected: { backgroundColor: colors.primarySoft },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 13 },
  channelDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.card },
  wa: { backgroundColor: colors.primary },
  ig: { backgroundColor: '#EE2A7B' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.foreground },
  time: { fontSize: 11, color: colors.mutedForeground },
  preview: { flex: 1, fontSize: 12, color: colors.mutedForeground },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  assign: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  assignText: { fontSize: 10, color: colors.mutedForeground, fontWeight: '600' },
});
