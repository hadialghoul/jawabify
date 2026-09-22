import { Contact } from '@/types/chat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface InterestedListProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onUnflag: (contactId: string) => void;
  selectedContactId: string | null;
}

export function InterestedList({ contacts, onSelectContact, onUnflag, selectedContactId }: InterestedListProps) {
  const interested = contacts
    .filter((c) => c.isInterested)
    .sort((a, b) => {
      const at = a.interestedAt ? a.interestedAt.getTime() : 0;
      const bt = b.interestedAt ? b.interestedAt.getTime() : 0;
      return bt - at;
    });

  const initials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const formatTime = (d?: Date) => {
    if (!d) return '';
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
    return format(d, 'dd/MM/yy');
  };

  if (interested.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <Sparkles className="h-12 w-12 mb-3 opacity-40" />
        <p className="font-medium text-foreground">No interested customers yet</p>
        <p className="text-sm mt-1">Customers asking multiple product questions will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      {interested.map((contact) => (
        <div
          key={contact.id}
          className={`group flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-accent ${
            selectedContactId === contact.id ? 'bg-accent' : ''
          }`}
        >
          <button
            onClick={() => onSelectContact(contact)}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground truncate">{contact.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatTime(contact.interestedAt)}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground italic">
                {contact.interestReason || 'Flagged as interested'}
              </p>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onUnflag(contact.id);
            }}
            title="Unflag"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
