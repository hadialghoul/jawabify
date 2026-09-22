import { Instagram, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChannelPlatform } from '@/types/chat';

interface ChannelBadgeProps {
  platform?: ChannelPlatform;
  /** Compact renders only the icon chip (used in list rows). */
  compact?: boolean;
  className?: string;
}

/**
 * Visual marker showing which channel a conversation came from.
 * Instagram uses the brand gradient, WhatsApp uses the app's primary tone.
 */
export function ChannelBadge({ platform = 'whatsapp', compact = false, className }: ChannelBadgeProps) {
  const isInstagram = platform === 'instagram';
  const Icon = isInstagram ? Instagram : MessageCircle;

  return (
    <span
      title={isInstagram ? 'Instagram DM' : 'WhatsApp chat'}
      aria-label={isInstagram ? 'Instagram DM' : 'WhatsApp chat'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold',
        compact ? 'h-4 w-4 justify-center p-0' : 'px-1.5 py-0.5 text-[10px]',
        isInstagram
          ? 'bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white'
          : 'bg-primary/15 text-primary',
        className,
      )}
    >
      <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {!compact && <span>{isInstagram ? 'Instagram' : 'WhatsApp'}</span>}
    </span>
  );
}
