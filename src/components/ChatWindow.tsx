import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Ban,
  Bot,
  BotOff,
  Eraser,
  Flag,
  Image as ImageIcon,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react-native';
import type { Contact, Message, MediaFile } from '../types';
import { avatarColor, colors, initials, radius } from '../theme';
import { MessageBubble } from './MessageBubble';
import { Button } from './ui';
import { useSafeHeaderPad } from './ScreenHeader';
import { InstagramIcon } from './ChannelIcons';

function dateLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (differenceInDays(new Date(), date) < 7) return format(date, 'EEEE');
  return format(date, 'MMMM d, yyyy');
}

interface Props {
  contact: Contact;
  messages: Message[];
  onSendMessage: (content: string, mediaFile?: MediaFile) => void;
  onBack: () => void;
  onDeleteChat?: (contactId: string) => void;
  onLoadMoreMessages?: () => void;
  hasMoreMessages?: boolean;
  isLoadingMore?: boolean;
  onToggleInterested?: (contactId: string, isInterested: boolean) => Promise<boolean>;
  onToggleAiEnabled?: (contactId: string, aiEnabled: boolean) => Promise<boolean>;
  onToggleNeedsHuman?: (contactId: string, needsHuman: boolean) => Promise<boolean> | void;
  onClearChat?: (contactId: string) => Promise<boolean>;
  onToggleBlocked?: (contactId: string, blocked: boolean) => Promise<boolean>;
  onCreateOrder?: () => void;
}

export function ChatWindow({
  contact,
  messages,
  onSendMessage,
  onBack,
  onDeleteChat,
  onLoadMoreMessages,
  hasMoreMessages,
  onToggleInterested,
  onToggleAiEnabled,
  onToggleNeedsHuman,
  onClearChat,
  onToggleBlocked,
  onCreateOrder,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const palette = avatarColor(contact.id || contact.name);
  const headerPad = useSafeHeaderPad();
  const insets = useSafeAreaInsets();

  const replyWindowClosed = useMemo(() => {
    if (contact.platform === 'instagram') return false;
    let lastIncoming = 0;
    for (const m of messages) {
      if (m.direction === 'incoming') lastIncoming = Math.max(lastIncoming, new Date(m.timestamp).getTime());
    }
    if (!lastIncoming) return false;
    return Date.now() - lastIncoming > 24 * 60 * 60 * 1000;
  }, [contact.platform, messages]);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = () => {
    const caption = inputValue.trim();
    if (!caption) return;
    onSendMessage(caption);
    setInputValue('');
  };

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    onSendMessage(inputValue.trim(), {
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || 'photo.jpg',
    });
    setInputValue('');
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    onSendMessage(inputValue.trim(), {
      uri: asset.uri,
      type: asset.mimeType || 'application/octet-stream',
      name: asset.name || 'file',
    });
    setInputValue('');
  };

  const confirm = (title: string, message: string, onYes: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: onYes },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <Pressable onPress={onBack} hitSlop={16} style={styles.iconBtn}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <View style={[styles.avatar, { backgroundColor: palette.bg }]}>
          <Text style={[styles.avatarText, { color: palette.fg }]}>{initials(contact.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>
              {contact.name}
            </Text>
            {contact.platform === 'instagram' ? <InstagramIcon size={14} color="#fff" /> : <MessageCircle size={14} color="rgba(255,255,255,0.85)" />}
          </View>
          <Text numberOfLines={1} style={styles.sub}>
            {contact.platform === 'instagram'
              ? contact.handle
                ? `@${contact.handle}`
                : 'Instagram direct message'
              : contact.phoneNumber}
          </Text>
        </View>
        {onToggleInterested ? (
          <Pressable
            onPress={() => onToggleInterested(contact.id, !contact.isInterested)}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Sparkles size={20} color={contact.isInterested ? '#FDE047' : '#fff'} />
          </Pressable>
        ) : null}
        {onToggleAiEnabled ? (
          <Pressable
            onPress={() => onToggleAiEnabled(contact.id, !(contact.aiEnabled !== false))}
            style={styles.iconBtn}
          >
            {contact.aiEnabled !== false ? <Bot size={20} color="#fff" /> : <BotOff size={20} color="rgba(255,255,255,0.7)" />}
          </Pressable>
        ) : null}
        <Pressable onPress={() => setMenuOpen(true)} style={styles.iconBtn}>
          <MoreVertical size={20} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={{ paddingVertical: 12 }}
        data={messages}
        keyExtractor={(item) => item.id}
        onStartReached={() => hasMoreMessages && onLoadMoreMessages?.()}
        renderItem={({ item, index }) => {
          const prev = messages[index - 1];
          const showDate = !prev || dateLabel(prev.timestamp) !== dateLabel(item.timestamp);
          return (
            <View>
              {showDate ? (
                <View style={styles.dateWrap}>
                  <Text style={styles.date}>{dateLabel(item.timestamp)}</Text>
                </View>
              ) : null}
              <MessageBubble message={item} />
            </View>
          );
        }}
      />

      {replyWindowClosed ? (
        <View style={styles.windowClosed}>
          <Text style={styles.windowClosedText}>The 24-hour reply window is closed. Use a template from Campaigns or wait for the customer to message again.</Text>
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Pressable onPress={pickImage} style={styles.iconBtnLight}>
          <ImageIcon size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={pickFile} style={styles.iconBtnLight}>
          <Paperclip size={20} color={colors.mutedForeground} />
        </Pressable>
        <TextInput
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Type a message"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} style={styles.send}>
          <Send size={18} color="#fff" />
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)} />
        <View style={[styles.menu, { top: headerPad + 52 }]}>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              Alert.alert(contact.name, [contact.phoneNumber, contact.email, contact.address].filter(Boolean).join('\n') || 'No extra profile details');
            }}
          >
            <User size={16} color={colors.foreground} />
            <Text style={styles.menuText}>View profile</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              onToggleInterested?.(contact.id, !contact.isInterested);
            }}
          >
            <Sparkles size={16} color={colors.primary} />
            <Text style={styles.menuText}>{contact.isInterested ? 'Unmark interested' : 'Mark interested'}</Text>
          </Pressable>
          {onCreateOrder ? (
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                onCreateOrder();
              }}
            >
              <ShoppingCart size={16} color={colors.foreground} />
              <Text style={styles.menuText}>Create order</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              onToggleNeedsHuman?.(contact.id, !contact.needsHuman);
            }}
          >
            <Flag size={16} color={contact.needsHuman ? colors.destructive : colors.mutedForeground} />
            <Text style={styles.menuText}>{contact.needsHuman ? 'Remove flag' : 'Flag for human'}</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              pickFile();
            }}
          >
            <Paperclip size={16} color={colors.foreground} />
            <Text style={styles.menuText}>Attach file</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              confirm('Clear chat', 'Delete every message in this conversation?', () => onClearChat?.(contact.id));
            }}
          >
            <Eraser size={16} color={colors.foreground} />
            <Text style={styles.menuText}>Clear chat</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              confirm(contact.blocked ? 'Unblock' : 'Block', contact.blocked ? 'Unblock this contact?' : 'Block this contact?', () =>
                onToggleBlocked?.(contact.id, !contact.blocked),
              );
            }}
          >
            <Ban size={16} color={colors.destructive} />
            <Text style={styles.menuText}>{contact.blocked ? 'Unblock' : 'Block contact'}</Text>
          </Pressable>
          <Pressable
            style={styles.menuItem}
            onPress={() => {
              setMenuOpen(false);
              confirm('Delete chat', 'This will permanently delete the conversation.', () => onDeleteChat?.(contact.id));
            }}
          >
            <Trash2 size={16} color={colors.destructive} />
            <Text style={[styles.menuText, { color: colors.destructive }]}>Delete chat</Text>
          </Pressable>
          <Button title="Close" variant="ghost" onPress={() => setMenuOpen(false)} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.chatBg },
  header: {
    backgroundColor: colors.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 10,
    gap: 8,
  },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  iconBtnLight: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  list: { flex: 1 },
  dateWrap: { alignItems: 'center', marginVertical: 10 },
  date: { backgroundColor: colors.muted, color: colors.mutedForeground, fontSize: 11, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
  },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  menu: {
    position: 'absolute',
    right: 16,
    top: 88,
    width: 240,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 8,
    gap: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  menuText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  windowClosed: { backgroundColor: colors.amberSoft, padding: 10, marginHorizontal: 12, borderRadius: radius.md, marginBottom: 8 },
  windowClosedText: { color: colors.amber, fontSize: 12, textAlign: 'center' },
});
