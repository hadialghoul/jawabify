export type ChannelPlatform = 'whatsapp' | 'instagram';

export type ChannelFilter = 'all' | ChannelPlatform;

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  direction: 'incoming' | 'outgoing';
  mediaUrl?: string;
  mediaType?: string;
  platform?: ChannelPlatform;
}

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount?: number;
  isInterested?: boolean;
  interestReason?: string;
  interestedAt?: Date;
  needsHuman?: boolean;
  humanRequestedAt?: Date;
  email?: string;
  address?: string;
  notes?: string;
  tags?: string[];
  aiEnabled?: boolean;
  optedOut?: boolean;
  optedOutAt?: Date;
  platform?: ChannelPlatform;
  externalId?: string;
  handle?: string;
  assignedMemberId?: string | null;
  assignedAt?: Date;
  blocked?: boolean;
  blockedAt?: Date;
}

export interface ContactCrmUpdate {
  name?: string;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface Conversation {
  contact: Contact;
  messages: Message[];
}
