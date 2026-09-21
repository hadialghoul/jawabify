export function isImageType(type?: string | null) {
  return !!type && type.startsWith('image/');
}

export function isAudioType(type?: string | null) {
  return !!type && type.startsWith('audio/');
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
