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

export function mediaPlaceholder(type?: string | null, fileName?: string) {
  if (isImageType(type)) return '📷 Photo';
  if (isAudioType(type)) return '🎤 Voice message';
  if (isVideoType(type)) return '🎬 Video';
  return `📎 ${fileName || 'File'}`;
}
