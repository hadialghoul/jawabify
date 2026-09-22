import { useState, useRef, useEffect, useCallback } from 'react';
import { Contact, Message } from '@/types/chat';
import { MessageBubble } from './MessageBubble';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';

function DateSeparator({ date }: { date: Date }) {
  const d = new Date(date);
  let label: string;
  if (isToday(d)) label = 'Today';
  else if (isYesterday(d)) label = 'Yesterday';
  else if (differenceInDays(new Date(), d) < 7) label = format(d, 'EEEE');
  else label = format(d, 'MMMM d, yyyy');
  return (
    <div className="flex justify-center my-3">
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
        {label}
      </span>
    </div>
  );
}
import { ContactProfileSheet } from './ContactProfileSheet';
import { ChannelBadge } from './ChannelBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { handleSanitizedPaste } from '@/lib/textPaste';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Send, Paperclip, MoreVertical, ArrowLeft, Trash2, User, ShoppingCart, Loader2, Image, Sparkles, Bot, BotOff, FileText, Plus, UserCheck, UserPlus, UserMinus, Check, Flag, FlagOff, X, Ban, Eraser } from 'lucide-react';
import { VoiceRecorderButton } from './VoiceRecorderButton';
import { EmojiPicker } from './EmojiPicker';
import { formatBytes, prepareImageForSend } from '@/lib/chatMedia';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRoster, memberLabel } from '@/hooks/useTeamRoster';
import { DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';



interface ChatWindowProps {
  contact: Contact;
  messages: Message[];
  onSendMessage: (content: string, mediaFile?: File) => void;
  onBack?: () => void;
  onDeleteChat?: (contactId: string) => void;
  onUpdateContact?: (contactId: string, name: string) => Promise<boolean>;
  onCreateOrder?: () => void;
  onLoadMoreMessages?: () => void;
  hasMoreMessages?: boolean;
  isLoadingMore?: boolean;
  isMobile?: boolean;
  hasOrders?: boolean;
  onToggleInterested?: (contactId: string, isInterested: boolean, reason?: string) => Promise<boolean>;
  onToggleAiEnabled?: (contactId: string, aiEnabled: boolean) => Promise<boolean>;
  onAssign?: (contactId: string, memberId: string | null) => Promise<boolean>;
  onToggleNeedsHuman?: (contactId: string, needsHuman: boolean) => Promise<boolean> | void;
  onDeleteMessages?: (contactId: string, messageIds: string[]) => Promise<boolean>;
  onClearChat?: (contactId: string) => Promise<boolean>;
  onToggleBlocked?: (contactId: string, blocked: boolean) => Promise<boolean>;
}


export function ChatWindow({
  contact,
  messages,
  onSendMessage,
  onBack,
  onDeleteChat,
  onUpdateContact,
  onCreateOrder,
  onLoadMoreMessages,
  hasMoreMessages,
  isLoadingMore,
  isMobile,
  hasOrders,
  onToggleInterested,
  onToggleAiEnabled,
  onAssign,
  onToggleNeedsHuman,
  onDeleteMessages,
  onClearChat,
  onToggleBlocked,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File; preview: string | null }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDeleteMessagesDialog, setShowDeleteMessagesDialog] = useState(false);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const startSelection = (id: string) => {
    setSelectionMode(true);
    setSelectedIds([id]);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const { memberId, isTenantAdmin } = useAuth();
  const { roster } = useTeamRoster();
  const assignee = roster.find((m) => m.id === contact.assignedMemberId) || null;
  const assignedToMe = !!contact.assignedMemberId && contact.assignedMemberId === memberId;
  const showAssignment = !!onAssign && roster.length > 1;

  // WhatsApp only allows a free-form reply within 24h of the customer's last message.
  const replyWindowClosed = (() => {
    if (contact.platform === 'instagram') return false;
    let lastIncoming = 0;
    for (const m of messages) {
      if (m.direction === 'incoming') {
        const t = new Date(m.timestamp).getTime();
        if (t > lastIncoming) lastIncoming = t;
      }
    }
    if (!lastIncoming) return false;
    return Date.now() - lastIncoming > 24 * 60 * 60 * 1000;
  })();




  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, [contact.id]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  // Scroll to bottom when new messages arrive (not when loading older ones)
  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;
    prevMessagesLengthRef.current = currentLength;
    
    // Only scroll if new messages were added at the end (not loaded at start)
    if (currentLength > prevLength && prevLength > 0) {
      scrollToBottom();
    } else if (prevLength === 0 && currentLength > 0) {
      // Initial load - scroll instantly
      scrollToBottom('instant');
    }
  }, [messages]);

  const handleSend = () => {
    const caption = inputValue.trim();
    if (!caption && attachments.length === 0) return;
    if (attachments.length > 0) {
      attachments.forEach((a, i) => {
        onSendMessage(i === 0 ? caption : '', a.file);
      });
    } else {
      onSendMessage(caption);
    }
    setInputValue('');
    setAttachments([]);
  };

  const attachFile = (file: File) => attachFiles([file]);

  const attachFiles = (files: File[]) => {
    files.forEach(async (original) => {
      if (original.type.startsWith('image/')) {
        // Shrink / convert so WhatsApp accepts it (5 MB limit, no WebP).
        const file = await prepareImageForSend(original);
        const reader = new FileReader();
        reader.onload = (ev) =>
          setAttachments((prev) => [...prev, { file, preview: ev.target?.result as string }]);
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, { file: original, preview: null }]);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) attachFiles(files);
    // Reset input so re-selecting same file works
    e.target.value = '';
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));


  const insertEmoji = (emoji: string) => {
    const el = messageInputRef.current;
    if (el) {
      const start = el.selectionStart ?? inputValue.length;
      const end = el.selectionEnd ?? start;
      const next = inputValue.slice(0, start) + emoji + inputValue.slice(end);
      setInputValue(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    setInputValue((v) => v + emoji);
  };




  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
      {/* Header */}
      {selectionMode ? (
        <div className="flex items-center gap-2 border-b bg-header px-3 py-2 sm:px-4 sm:py-3 z-20 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={exitSelection}
            className="text-header-foreground hover:bg-primary/80 h-9 w-9 shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
          <span className="flex-1 font-semibold text-header-foreground">
            {selectedIds.length} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(messages.map((m) => m.id))}
            className="text-header-foreground hover:bg-primary/80"
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={selectedIds.length === 0}
            onClick={() => setShowDeleteMessagesDialog(true)}
            className="text-header-foreground hover:bg-primary/80 h-9 w-9"
            title="Delete selected messages"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      ) : (
      <div className="flex items-center gap-2 border-b bg-header px-3 py-2 sm:px-4 sm:py-3 z-20 shrink-0">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-header-foreground hover:bg-primary/80 h-9 w-9 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <button
          onClick={() => setShowProfileSheet(true)}
          className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary-foreground/20 text-header-foreground font-medium">
              {getInitials(contact.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-header-foreground">{contact.name}</h2>
              <ChannelBadge platform={contact.platform} />
              {hasOrders && (
                <ShoppingCart className="h-3.5 w-3.5 text-header-foreground/70" />
              )}
            </div>
            <p className="text-xs text-header-foreground/70">
              {contact.platform === 'instagram'
                ? contact.handle
                  ? `@${contact.handle}`
                  : 'Instagram direct message'
                : contact.phoneNumber}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          {showAssignment && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-2 text-header-foreground hover:bg-primary/80 max-w-[9rem] sm:max-w-[12rem]"
                  title={
                    assignee
                      ? `Assigned to ${memberLabel(assignee)}`
                      : 'Unassigned — nobody is handling this chat yet'
                  }
                >
                  {assignee ? <UserCheck className="h-4 w-4 shrink-0" /> : <UserPlus className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-xs font-medium hidden sm:inline">
                    {assignee ? (assignedToMe ? 'You' : memberLabel(assignee)) : 'Unassigned'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {assignee ? `Handled by ${memberLabel(assignee)}` : 'Nobody is handling this chat'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isTenantAdmin ? (
                  <>
                    {roster
                      .filter((m) => m.is_active)
                      .map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          className="cursor-pointer"
                          onClick={() => {
                            if (m.id !== contact.assignedMemberId) onAssign?.(contact.id, m.id);
                          }}
                        >
                          <span className="truncate">
                            {memberLabel(m)}
                            {m.id === memberId ? ' (you)' : ''}
                          </span>
                          {m.id === contact.assignedMemberId && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    {contact.assignedMemberId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => onAssign?.(contact.id, null)}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          Unassign
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                ) : !contact.assignedMemberId ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => memberId && onAssign?.(contact.id, memberId)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign to me
                  </DropdownMenuItem>
                ) : assignedToMe ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => onAssign?.(contact.id, null)}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Release this chat
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => memberId && onAssign?.(contact.id, memberId)}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Take over this chat
                  </DropdownMenuItem>
                )}

              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onToggleAiEnabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleAiEnabled(contact.id, !(contact.aiEnabled !== false))}
              className={`hover:bg-primary/80 transition-colors ${
                contact.aiEnabled === false
                  ? 'text-header-foreground/50'
                  : 'text-header-foreground'
              }`}
              title={
                contact.aiEnabled === false
                  ? 'AI replies stopped for this chat — click to resume'
                  : 'AI replies active — click to stop'
              }
              data-tour="ai-toggle"
            >
              {contact.aiEnabled === false ? (
                <BotOff className="h-5 w-5" />
              ) : (
                <Bot className="h-5 w-5" />
              )}
            </Button>
          )}
          {onToggleInterested && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleInterested(contact.id, !contact.isInterested)}
              className={`hover:bg-primary/80 ${contact.isInterested ? 'text-yellow-300' : 'text-header-foreground'}`}
              title={contact.isInterested ? 'Unflag interested' : 'Mark as interested'}
            >
              <Sparkles className={`h-5 w-5 ${contact.isInterested ? 'fill-yellow-300' : ''}`} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-header-foreground hover:bg-primary/80"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setShowProfileSheet(true)}
              >
                <User className="mr-2 h-4 w-4" />
                View profile
              </DropdownMenuItem>
              {onCreateOrder && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={onCreateOrder}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Create order
                </DropdownMenuItem>
              )}
              {onToggleNeedsHuman && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => onToggleNeedsHuman(contact.id, !contact.needsHuman)}
                >
                  {contact.needsHuman ? (
                    <FlagOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Flag className="mr-2 h-4 w-4" />
                  )}
                  {contact.needsHuman ? 'Remove from Flagged' : 'Flag for human'}
                </DropdownMenuItem>
              )}
              {onDeleteMessages && messages.length > 0 && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setSelectionMode(true)}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Select messages
                </DropdownMenuItem>
              )}
              {onClearChat && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setShowClearDialog(true)}
                >
                  <Eraser className="mr-2 h-4 w-4" />
                  Delete all messages
                </DropdownMenuItem>
              )}
              {onToggleBlocked && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => (contact.blocked ? onToggleBlocked(contact.id, false) : setShowBlockDialog(true))}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  {contact.blocked ? 'Unblock contact' : 'Block contact'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete chat with {contact.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all messages in this conversation. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  onDeleteChat?.(contact.id);
                  setShowDeleteDialog(false);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      )}

      <AlertDialog open={showDeleteMessagesDialog} onOpenChange={setShowDeleteMessagesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.length} {selectedIds.length === 1 ? 'message' : 'messages'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from this conversation for you. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await onDeleteMessages?.(contact.id, selectedIds);
                setShowDeleteMessagesDialog(false);
                exitSelection();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all messages with {contact.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every message in this conversation will be deleted. The contact stays in your inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await onClearChat?.(contact.id);
                setShowClearDialog(false);
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {contact.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their messages will be ignored and the assistant will stop replying to them. You can
              unblock them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await onToggleBlocked?.(contact.id, true);
                setShowBlockDialog(false);
              }}
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Messages */}
      <div ref={messagesContainerRef} className="min-h-0 overflow-y-auto chat-background p-4 scrollbar-thin overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="mx-auto max-w-3xl space-y-3">
          {/* Load More Button */}
          {hasMoreMessages && (
            <div className="flex justify-center pb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMoreMessages}
                disabled={isLoadingMore}
                className="text-muted-foreground hover:text-foreground"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load earlier messages'
                )}
              </Button>
            </div>
          )}
          {messages.map((message, idx) => {
            const prev = messages[idx - 1];
            const showDate =
              !prev ||
              new Date(prev.timestamp).toDateString() !==
                new Date(message.timestamp).toDateString();
            return (
              <div key={message.id}>
                {showDate && <DateSeparator date={message.timestamp} />}
                <MessageBubble
                  message={message}
                  selectable={selectionMode}
                  selected={selectedIds.includes(message.id)}
                  onToggleSelect={toggleSelect}
                  onRequestSelect={onDeleteMessages ? startSelection : undefined}
                />
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="z-20 shrink-0 border-t bg-card px-2 py-2 sm:p-3" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {contact.blocked && (
          <div className="mx-auto mb-2 max-w-3xl rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] leading-snug text-destructive">
            {contact.name} is blocked — their messages are ignored and the assistant won’t reply.
          </div>
        )}
        {replyWindowClosed && (
          <div className="mx-auto mb-2 max-w-3xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {contact.name} hasn’t written in over 24 hours, so WhatsApp will block a normal
            message. Wait for their reply, or reach them with an approved template message.
          </div>
        )}
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="mx-auto max-w-3xl mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={`${a.file.name}-${i}`} className="relative">
                {a.preview ? (
                  <img
                    src={a.preview}
                    alt={`Attachment ${i + 1} preview before sending`}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-xs">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate max-w-[180px]">{a.file.name}</span>
                    <span className="text-muted-foreground">{formatBytes(a.file.size)}</span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  aria-label="Remove attachment"
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mx-auto flex w-full max-w-3xl min-w-0 items-end gap-1 sm:gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}

          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground shrink-0 h-9 w-9"
                title="Attach"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="bg-popover">
              <DropdownMenuItem className="cursor-pointer" onClick={() => imageInputRef.current?.click()}>
                <Image className="mr-2 h-4 w-4" />
                Photo
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-2 h-4 w-4" />
                Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative flex w-0 min-w-0 flex-1 items-center">
            <Input
              ref={messageInputRef}
              placeholder="Type a message..."
              dir="auto"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={(e) => handleSanitizedPaste(e, setInputValue)}
              onKeyDown={handleKeyPress}
              className="h-9 min-w-0 flex-1 pr-9 text-base"
            />
            <div className="absolute right-1">
              <EmojiPicker onSelect={insertEmoji} className="text-muted-foreground hover:text-foreground h-7 w-7" />
            </div>
          </div>
          {inputValue.trim() || attachments.length > 0 ? (
            <Button
              onClick={handleSend}
              size="icon"
              className="shrink-0 bg-primary hover:bg-primary/90 h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          ) : (
            <VoiceRecorderButton onRecorded={attachFile} className="shrink-0 h-9 w-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90" />
          )}
        </div>


      </div>

      {/* Profile Sheet */}
      {onUpdateContact && (
        <ContactProfileSheet
          contact={contact}
          open={showProfileSheet}
          onOpenChange={setShowProfileSheet}
          onUpdateContact={onUpdateContact}
        />
      )}
    </div>
  );
}
