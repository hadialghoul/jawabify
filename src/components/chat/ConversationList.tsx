import { Contact, ChannelFilter as ChannelFilterValue } from '@/types/chat';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Search, MessageSquarePlus, Settings, Bell, Loader2, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChannelBadge } from '@/components/chat/ChannelBadge';
import { cn } from '@/lib/utils';
import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRoster, memberLabel } from '@/hooks/useTeamRoster';

type AssignmentFilter = 'all' | 'mine' | 'unassigned';

interface ConversationListProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onSelectContact: (contact: Contact) => void;
  onNewChat: () => void;
  hideHeader?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onSearchContacts?: (query: string) => Promise<Contact[]>;
  channel?: ChannelFilterValue;
  onChannelChange?: (channel: ChannelFilterValue) => void;
  instagramConnected?: boolean;
}


// Pasted numbers often carry invisible bidi/zero-width marks (WhatsApp, Notes,
// Excel) or Arabic-Indic digits. Clean those before matching.
const sanitizeQuery = (v: string) =>
  v
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\s+/g, ' ')
    .trim();

const digitsOnly = (v: string) => sanitizeQuery(v).replace(/\D/g, '');

// Normalize a typed phone query so local formats match stored E.164 numbers.
// "03 306 156" / "03-306-156" / "00961 3 306156" -> "3306156" / "9613306156"
const normalizePhoneQuery = (v: string) => {
  let d = digitsOnly(v);
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  return d;
};


export function ConversationList({
  contacts,
  selectedContactId,
  onSelectContact,
  onNewChat,
  hideHeader = false,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onSearchContacts,
  channel = 'all',
  onChannelChange,
  instagramConnected = false,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [remoteResults, setRemoteResults] = useState<Contact[]>([]);
  const [remoteSearching, setRemoteSearching] = useState(false);
  const [assignment, setAssignment] = useState<AssignmentFilter>('all');
  const navigate = useNavigate();
  const { memberId } = useAuth();
  const { roster } = useTeamRoster();
  const isTeamAccount = roster.length > 1;
  const rosterById = useMemo(
    () => Object.fromEntries(roster.map((m) => [m.id, m])),
    [roster],
  );

  const filteredContacts = useMemo(() => {
    const raw = sanitizeQuery(deferredQuery);
    const q = raw.toLowerCase();

    const phoneQuery = normalizePhoneQuery(raw);
    return contacts
      .filter((contact) => {
        if (channel !== 'all' && (contact.platform || 'whatsapp') !== channel) return false;
        if (isTeamAccount && assignment === 'mine' && contact.assignedMemberId !== memberId) return false;
        if (isTeamAccount && assignment === 'unassigned' && contact.assignedMemberId) return false;
        if (!q) return true;
        if (contact.name?.toLowerCase().includes(q)) return true;
        if (contact.handle?.toLowerCase().includes(q.replace('@', ''))) return true;
        if (phoneQuery) {
          const contactDigits = digitsOnly(contact.phoneNumber || '');
          if (contactDigits.includes(phoneQuery)) return true;
        }
        return false;
      })
      .sort((a, b) => {
        const aUnread = (a.unreadCount ?? 0) > 0 ? 1 : 0;
        const bUnread = (b.unreadCount ?? 0) > 0 ? 1 : 0;
        if (bUnread !== aUnread) return bUnread - aUnread;
        const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return bTime - aTime;
      });
  }, [contacts, deferredQuery, channel, assignment, isTeamAccount, memberId]);


  // When nothing in the loaded list matches, ask the database directly.
  useEffect(() => {
    const raw = sanitizeQuery(deferredQuery);
    if (!onSearchContacts || raw.length < 3 || filteredContacts.length > 0) {
      setRemoteResults([]);
      setRemoteSearching(false);
      return;
    }
    let cancelled = false;
    setRemoteSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await onSearchContacts(raw);
        if (!cancelled) setRemoteResults(found);
      } finally {
        if (!cancelled) setRemoteSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
      setRemoteSearching(false);
    };
  }, [deferredQuery, filteredContacts.length, onSearchContacts]);

  const visibleContacts =
    filteredContacts.length > 0
      ? filteredContacts
      : remoteResults.filter(
          (c) => channel === 'all' || (c.platform || 'whatsapp') === channel,
        );




  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarPalette = [
    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  ];
  const avatarColor = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return avatarPalette[h % avatarPalette.length];
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between border-b bg-header px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20">
              <div className="h-3 w-3 rounded-full bg-primary-foreground" />
              <div className="absolute h-5 w-5 rounded-full border-2 border-primary-foreground/50 animate-ripple" />
            </div>
            <h1 className="text-lg font-bold text-header-foreground tracking-tight">Jawabify</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              className="text-header-foreground hover:bg-primary/80"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewChat}
              className="text-header-foreground hover:bg-primary/80"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Slim search bar */}
      <div className="px-3 pt-3 pb-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 rounded-lg bg-muted/40 border-transparent focus-visible:bg-card focus-visible:border-border transition-all duration-200"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onNewChat}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary"
            title="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Channel filter */}
        {onChannelChange && (
          <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/40 p-1" role="tablist" aria-label="Channel filter">
            {([
              { key: 'all', label: 'All Chats' },
              { key: 'whatsapp', label: 'WhatsApp' },
              { key: 'instagram', label: instagramConnected ? 'Instagram' : 'Instagram +' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={channel === key}
                title={key === 'instagram' && !instagramConnected ? 'Connect Instagram' : label}
                onClick={() => {
                  if (key === 'instagram' && !instagramConnected) {
                    navigate('/integrations');
                    return;
                  }
                  onChannelChange(key);
                }}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                  channel === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Assignment filter (team accounts only) */}
        {isTeamAccount && (
          <div className="mt-2 flex items-center gap-1 rounded-lg bg-muted/40 p-1" role="tablist" aria-label="Assignment filter">
            {([
              { key: 'all', label: 'All' },
              { key: 'mine', label: 'Mine' },
              { key: 'unassigned', label: 'Unassigned' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={assignment === key}
                onClick={() => setAssignment(key)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                  assignment === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>


      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        {contacts.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading conversations…
          </div>
        )}
        {contacts.length > 0 && visibleContacts.length === 0 && remoteSearching && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching all conversations…
          </div>
        )}
        {contacts.length > 0 && visibleContacts.length === 0 && !remoteSearching && (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            No conversations match “{searchQuery.trim()}”.
            <br />
            <span className="text-xs opacity-80">Try the number without the leading 0, or part of it.</span>
          </div>
        )}
        {visibleContacts.map((contact) => {


          const unread = !!(contact.unreadCount && contact.unreadCount > 0);
          const isSelected = selectedContactId === contact.id;
          return (
            <button
              key={contact.id}
              onClick={() => onSelectContact(contact)}
              className={`group mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-primary/10 ring-1 ring-primary/30 shadow-sm'
                  : 'hover:bg-muted/60'
              }`}
            >
              <div className="relative shrink-0">
                <Avatar className="h-10 w-10 ring-2 ring-background">
                  <AvatarFallback className={`${avatarColor(contact.id || contact.name)} font-semibold text-sm`}>
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <ChannelBadge
                  platform={contact.platform}
                  compact
                  className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
                />
              </div>
              <div className="flex-1 overflow-hidden min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${unread ? 'font-semibold text-foreground' : 'font-semibold text-foreground/90'}`}>
                    {contact.name}
                  </span>
                  {contact.lastMessageTime && (
                    <span className={`text-[11px] shrink-0 ${unread ? 'text-primary font-semibold' : 'text-muted-foreground font-normal'}`}>
                      {(() => {
                        const d = new Date(contact.lastMessageTime);
                        if (isToday(d)) return format(d, 'HH:mm');
                        if (isYesterday(d)) return 'Yesterday';
                        if (differenceInDays(new Date(), d) < 7) return format(d, 'EEE');
                        return format(d, 'dd/MM/yy');
                      })()}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`truncate text-xs ${unread ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                    {contact.lastMessage || <span className="italic opacity-60">No messages yet</span>}
                  </p>
                  {unread && (
                    <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/40">
                      {contact.unreadCount}
                    </span>
                  )}
                </div>
                {isTeamAccount && (
                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                    {contact.assignedMemberId ? (
                      <span
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 font-medium',
                          contact.assignedMemberId === memberId
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <UserCheck className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {contact.assignedMemberId === memberId
                            ? 'You'
                            : memberLabel(rosterById[contact.assignedMemberId])}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                        Unassigned
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {hasMore && (
          <div className="flex justify-center p-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="rounded-full"
            >
              {isLoadingMore ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
              ) : (
                'Load older conversations'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

