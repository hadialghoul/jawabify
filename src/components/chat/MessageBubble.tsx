import { Message } from '@/types/chat';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaAttachment } from './MediaAttachment';
import { isImageType, mediaPlaceholder } from '@/lib/chatMedia';

interface MessageBubbleProps {
  message: Message;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onRequestSelect?: (id: string) => void;
}

const PLACEHOLDERS = ['📷 Photo', '🎤 Voice message', '🎬 Video'];

export function MessageBubble({
  message,
  selectable,
  selected,
  onToggleSelect,
  onRequestSelect,
}: MessageBubbleProps) {
  const longPress = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return {
      onPointerDown: () => {
        if (selectable) return;
        timer = setTimeout(() => onRequestSelect?.(message.id), 500);
      },
      onPointerUp: () => { if (timer) clearTimeout(timer); },
      onPointerLeave: () => { if (timer) clearTimeout(timer); },
    };
  })();
  const isOutgoing = message.direction === 'outgoing';
  const hasMedia = !!message.mediaUrl;
  const hasImage = hasMedia && isImageType(message.mediaType);
  const placeholder = mediaPlaceholder(message.mediaType);
  const hideContent =
    hasMedia &&
    (PLACEHOLDERS.includes(message.content) || message.content === placeholder);

  const StatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Clock className="h-3 w-3 animate-pulse-soft" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-400" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={() => selectable && onToggleSelect?.(message.id)}
      {...longPress}
      className={cn(
        'flex w-full items-center gap-2',
        selectable && 'cursor-pointer rounded-lg -mx-1 px-1 py-0.5',
        selectable && selected && 'bg-primary/10',
        isOutgoing ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'
      )}
    >
      {selectable && (
        <span
          className={cn(
            'order-first flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40'
          )}
        >
          {selected && <Check className="h-3 w-3" />}
        </span>
      )}
      <div
        className={cn(
          'relative max-w-[70%] rounded-2xl shadow-sm overflow-hidden',
          hasImage ? 'p-0' : 'px-4 py-2',
          isOutgoing
            ? 'message-bubble-sent rounded-br-md'
            : 'message-bubble-received rounded-bl-md'
        )}
      >
        {hasMedia && (
          <div className={cn(hasImage ? '' : 'mb-1')}>
            <MediaAttachment
              url={message.mediaUrl!}
              type={message.mediaType}
              className={hasImage ? 'rounded-t-2xl' : undefined}
            />
          </div>
        )}
        {message.content && !hideContent && (
          <p
            dir="auto"
            className={cn(
              'text-sm leading-relaxed whitespace-pre-wrap break-words',
              hasImage && 'px-4 pt-2'
            )}
          >
            {message.content}
          </p>
        )}
        <div
          className={cn(
            'flex items-center justify-end gap-1 text-xs',
            hasImage ? 'px-4 py-2' : 'mt-1',
            isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          <span>{format(message.timestamp, 'HH:mm')}</span>
          {isOutgoing && <StatusIcon />}
        </div>
      </div>
    </div>
  );
}
