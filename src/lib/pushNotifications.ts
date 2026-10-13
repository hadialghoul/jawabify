import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

type ChatListener = (contactId: string) => void;

const listeners = new Set<ChatListener>();
let pendingContactId: string | null = null;
let currentToken: string | null = null;
let remotePushReady = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function preview(text: string | null | undefined, mediaType: string | null | undefined): string {
  if (mediaType?.startsWith('image')) return 'Photo';
  if (mediaType?.startsWith('audio')) return 'Voice message';
  if (mediaType?.startsWith('video')) return 'Video';
  const trimmed = (text ?? '').trim();
  if (!trimmed) return 'New message';
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
}

export function subscribeNotificationChats(listener: ChatListener) {
  listeners.add(listener);
  if (pendingContactId) {
    const id = pendingContactId;
    pendingContactId = null;
    listener(id);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function openChatFromNotification(contactId: string) {
  if (!contactId) return;
  if (listeners.size === 0) {
    pendingContactId = contactId;
    return;
  }
  listeners.forEach((listener) => listener(contactId));
}

function contactIdFromResponse(response: Notifications.NotificationResponse | null) {
  const id = response?.notification.request.content.data?.contactId;
  return typeof id === 'string' ? id : null;
}

export function bindNotificationOpens() {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const id = contactIdFromResponse(response);
    if (id) openChatFromNotification(id);
  });
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    const id = contactIdFromResponse(response);
    if (id) openChatFromNotification(id);
  });
  return () => sub.remove();
}

let channelsReady: Promise<void> | null = null;

function ensureChannels() {
  if (channelsReady) return channelsReady;
  channelsReady = (async () => {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('escalations', {
      name: 'Needs a human',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  })();
  return channelsReady;
}

export async function registerPushToken(userId: string, tenantId: string) {
  if (!Device.isDevice) return false;
  await ensureChannels();
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return false;

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return false;
  }
  if (!token.startsWith('ExponentPushToken')) return false;

  const { error } = await supabase.from('push_tokens').upsert(
    {
      token,
      user_id: userId,
      tenant_id: tenantId,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) return false;

  currentToken = token;
  remotePushReady = Constants.appOwnership !== 'expo';
  return remotePushReady;
}

export async function unregisterPushToken() {
  const token = currentToken;
  currentToken = null;
  remotePushReady = false;
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
}

export async function notifyIncomingWhileOpen(opts: {
  contactId: string;
  content?: string | null;
  mediaType?: string | null;
  name?: string | null;
}) {
  if (remotePushReady) return;
  if (AppState.currentState !== 'active') return;
  try {
    await ensureChannels();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.name?.trim() || 'Jawabify',
        body: preview(opts.content, opts.mediaType),
        data: { contactId: opts.contactId, kind: 'messages' },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Expo Go can reject a notification before permission is granted.
  }
}
