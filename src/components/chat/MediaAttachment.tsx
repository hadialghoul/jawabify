import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import { isAudioType, isImageType, isVideoType, fileNameFromUrl } from '@/lib/chatMedia';
import { cn } from '@/lib/utils';


interface MediaAttachmentProps {
  url: string;
  type?: string;
  className?: string;
}

/** Renders a chat attachment: image, voice note, video or downloadable file. */
export function MediaAttachment({ url, type, className }: MediaAttachmentProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (isImageType(type)) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className={cn('cursor-zoom-in block', className)}
        >
          <img
            src={url}
            alt="Shared image"
            className="max-w-full rounded-lg object-cover"
            style={{ maxHeight: 300 }}
            loading="lazy"
          />
        </button>
        <ImageLightbox src={url} open={lightboxOpen} onOpenChange={setLightboxOpen} />
      </>
    );
  }

  if (isAudioType(type)) {
    return <VoiceNotePlayer url={url} type={type} className={className} />;
  }


  if (isVideoType(type)) {
    return (
      <video
        controls
        src={url}
        className={cn('max-w-full rounded-lg', className)}
        style={{ maxHeight: 300 }}
        preload="metadata"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 rounded-lg bg-background/20 px-3 py-2 text-sm underline-offset-2 hover:underline',
        className
      )}
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate max-w-[180px]">{fileNameFromUrl(url)}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </a>
  );
}
