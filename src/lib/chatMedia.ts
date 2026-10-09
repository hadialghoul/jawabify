import { supabase } from './supabase';

export function isImageType(type?: string | null) {
  return !!type && type.startsWith('image/');
}

export function isAudioType(type?: string | null) {
  return !!type && type.startsWith('audio/');
}

export function looksLikeImage(type?: string | null, url?: string | null) {
  if (isImageType(type)) return true;
  return !!url && /\.(jpe?g|png|gif|webp|heic|heif)(\?|$)/i.test(url);
}

export function looksLikeAudio(type?: string | null, url?: string | null) {
  if (isAudioType(type)) return true;
  return !!url && /\.(ogg|opus|m4a|mp3|aac|amr|wav|mpeg|mp4)(\?|$)/i.test(url);
}

export function isVideoType(type?: string | null) {
  return !!type && type.startsWith('video/');
}

/** Object path inside the private chat-media bucket, from a stored public or signed URL. */
export function chatMediaObjectPath(url: string): string | null {
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/chat-media\/([^?#]+)/);
  if (!match) return null;
  const path = decodeURIComponent(match[1]);
  return path.includes('..') ? null : path;
}

/**
 * chat-media is private. Stored links keep the public URL shape as an id.
 * Display and playback need a signed URL (1 hour). Local files are returned as-is.
 */
export async function signedChatMediaUrl(url: string): Promise<string> {
  if (!url || /^(file|content|data|blob):/i.test(url)) return url;
  const path = chatMediaObjectPath(url);
  if (!path) return url;
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}

export function mediaPlaceholder(type?: string | null, fileName?: string) {
  if (isImageType(type)) return '📷 Photo';
  if (isAudioType(type)) return '🎤 Voice message';
  if (isVideoType(type)) return '🎬 Video';
  return `📎 ${fileName || 'File'}`;
}
