import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

const GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','🙂','🙃','😉','😊','😇','🥰','😍','😘','😗','😙','😚','😋','😛','😜','🤪','🤨','🧐','🤓','😎','🥳','😏','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤯','😳','🥵','🥶','😱','😨','😰','😥','🤗','🤔','🤭','🤫','😴','🤤','😷','🤒','🤕','🤢','🤮','🥴'],
  },
  {
    label: 'Gestures',
    emojis: ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','👏','🙌','🙏','🤝','💪','👋','🖐️','✋','👊','✊','☝️','👆','👇','👉','👈','🫶','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','🔥','✨','⭐','🎉','🎊','🎁'],
  },
  {
    label: 'Objects',
    emojis: ['📞','📱','💬','📧','📦','🚚','🛒','💳','💵','🧾','📍','🕒','✅','❌','⚠️','📅','📷','🎤','📎','🔗','🏠','🏢','☕','🍔','🍕','🍟','🥗','🍰','🍫','🥤','⚽','👕','👟','💄','🧴','💊','🐶','🐱','🌸','🌟'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Insert emoji"
          title="Insert emoji"
          className={className ?? 'text-muted-foreground hover:text-foreground shrink-0 h-8 w-8 sm:h-9 sm:w-9'}
        >
          <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-2 bg-popover">
        <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {g.emojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => onSelect(e)}
                    className="rounded-md p-1 text-xl leading-none hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
