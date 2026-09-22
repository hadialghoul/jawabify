// Helpers for chat attachments (images, voice notes, documents).

export function isImageType(type?: string | null) {
  return !!type && type.startsWith('image/');
}

export function isAudioType(type?: string | null) {
  return !!type && type.startsWith('audio/');
}

export function isVideoType(type?: string | null) {
  return !!type && type.startsWith('video/');
}

/** Placeholder text stored as message content when only media is sent. */
export function mediaPlaceholder(type?: string | null, fileName?: string) {
  if (isImageType(type)) return '📷 Photo';
  if (isAudioType(type)) return '🎤 Voice message';
  if (isVideoType(type)) return '🎬 Video';
  return `📎 ${fileName || 'File'}`;
}

export function fileNameFromUrl(url?: string) {
  if (!url) return 'File';
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').pop() || 'File');
  } catch {
    return url.split('/').pop() || 'File';
  }
}

/**
 * WhatsApp rejects images over 5 MB and does not accept WebP.
 * Re-encode oversized / unsupported photos to JPEG, shrinking until they fit.
 */
export async function prepareImageForSend(file: File, maxBytes = 4_500_000): Promise<File> {
  const needsConvert = file.type === 'image/webp' || file.type === 'image/heic' || file.type === 'image/heif';
  if (!isImageType(file.type)) return file;
  if (!needsConvert && file.size <= maxBytes) return file;

  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;
    let quality = 0.85;

    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
      );
      if (!blob) return file;
      if (blob.size <= maxBytes || attempt === 5) {
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
      }
      if (quality > 0.6) quality -= 0.15;
      else {
        width *= 0.8;
        height *= 0.8;
      }
    }
    return file;
  } catch {
    return file;
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
