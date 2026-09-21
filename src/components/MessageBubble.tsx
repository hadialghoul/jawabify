import { format } from 'date-fns';
import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';
import { isImageType, mediaPlaceholder } from '../lib/chatMedia';
import { colors, radius } from '../theme';

const PLACEHOLDERS = ['📷 Photo', '🎤 Voice message', '🎬 Video'];

export function MessageBubble({
  message,
  onLongPress,
}: {
  message: Message;
  onLongPress?: () => void;
}) {
  const isOutgoing = message.direction === 'outgoing';
  const hasMedia = !!message.mediaUrl;
  const hasImage = hasMedia && isImageType(message.mediaType);
  const placeholder = mediaPlaceholder(message.mediaType);
  const hideContent = hasMedia && (PLACEHOLDERS.includes(message.content) || message.content === placeholder);

  const Status = () => {
    if (!isOutgoing) return null;
    if (message.status === 'sending') return <Clock size={12} color="rgba(255,255,255,0.7)" />;
    if (message.status === 'sent') return <Check size={12} color="rgba(255,255,255,0.7)" />;
    if (message.status === 'delivered') return <CheckCheck size={12} color="rgba(255,255,255,0.7)" />;
    if (message.status === 'read') return <CheckCheck size={12} color="#93C5FD" />;
    if (message.status === 'failed') return <AlertCircle size={12} color="#FECACA" />;
    return null;
  };

  return (
    <Pressable onLongPress={onLongPress} style={[styles.row, isOutgoing ? styles.end : styles.start]}>
      <View style={[styles.bubble, isOutgoing ? styles.sent : styles.received, hasImage && { padding: 0 }]}>
        {hasImage ? <Image source={{ uri: message.mediaUrl }} style={styles.image} /> : null}
        {hasMedia && !hasImage ? (
          <Text style={[styles.body, isOutgoing && styles.sentText]}>{placeholder}</Text>
        ) : null}
        {message.content && !hideContent ? (
          <Text style={[styles.body, isOutgoing && styles.sentText, hasImage && { paddingHorizontal: 14, paddingTop: 8 }]}>
            {message.content}
          </Text>
        ) : null}
        <View style={[styles.meta, hasImage && { paddingHorizontal: 14, paddingBottom: 8 }]}>
          <Text style={[styles.time, isOutgoing && styles.sentMeta]}>{format(message.timestamp, 'HH:mm')}</Text>
          <Status />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', marginVertical: 3, paddingHorizontal: 12 },
  start: { alignItems: 'flex-start' },
  end: { alignItems: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  sent: { backgroundColor: colors.messageSent, borderBottomRightRadius: 6 },
  received: { backgroundColor: colors.messageReceived, borderBottomLeftRadius: 6 },
  body: { fontSize: 14, lineHeight: 20, color: colors.foreground },
  sentText: { color: '#fff' },
  meta: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 },
  time: { fontSize: 11, color: colors.mutedForeground },
  sentMeta: { color: 'rgba(255,255,255,0.7)' },
  image: { width: 220, height: 180, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
});
