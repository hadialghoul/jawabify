import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { AlertCircle, Check, CheckCheck, Clock, Mic, Pause, Play } from 'lucide-react-native';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';
import { looksLikeAudio, looksLikeImage, mediaPlaceholder, signedChatMediaUrl } from '../lib/chatMedia';
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
  const hasImage = looksLikeImage(message.mediaType, message.mediaUrl);
  const hasAudio = looksLikeAudio(message.mediaType, message.mediaUrl);
  const [playing, setPlaying] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const source = message.mediaUrl;
    if (!source) {
      setDisplayUrl(undefined);
      return;
    }
    if (/^(file|content|data|blob):/i.test(source) || !source.includes('/chat-media/')) {
      setDisplayUrl(source);
      return;
    }
    setDisplayUrl(undefined);
    signedChatMediaUrl(source).then((url) => {
      if (!cancelled) setDisplayUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [message.mediaUrl]);
  const playerRef = useRef<AudioPlayer | null>(null);
  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, [displayUrl]);
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
        {hasImage ? (
          <Pressable onPress={() => setPhotoOpen(true)}>
            <Image source={{ uri: displayUrl }} style={styles.image} />
          </Pressable>
        ) : null}
        {hasAudio ? (
          <Pressable
            style={styles.audio}
            onPress={async () => {
              if (!displayUrl) return;
              try {
                if (playerRef.current && playing) {
                  playerRef.current.pause();
                  setPlaying(false);
                  return;
                }
                await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
                const player = playerRef.current ?? createAudioPlayer(displayUrl);
                playerRef.current = player;
                setPlaying(true);
                player.play();
                player.addListener('playbackStatusUpdate', (status) => {
                  if (status.didJustFinish) setPlaying(false);
                });
              } catch {
                setPlaying(false);
              }
            }}
          >
            {playing ? <Pause size={16} color={isOutgoing ? '#fff' : colors.primary} /> : <Play size={16} color={isOutgoing ? '#fff' : colors.primary} />}
            <Mic size={16} color={isOutgoing ? '#fff' : colors.primary} />
            <Text style={[styles.body, isOutgoing && styles.sentText]}>Voice message</Text>
          </Pressable>
        ) : null}
        {hasMedia && !hasImage && !hasAudio ? (
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
      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <Pressable style={styles.lightbox} onPress={() => setPhotoOpen(false)}>
          {displayUrl ? <Image source={{ uri: displayUrl }} style={styles.lightboxImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
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
  audio: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '80%' },
});
