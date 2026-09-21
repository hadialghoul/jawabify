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

export interface Order {
  id: string;
  displayId: number;
  contactId: string | null;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  productName: string;
  quantity: number;
  deliveryFee: number;
  totalPrice?: number | null;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  shopifyOrderId?: string | null;
  financialStatus?: string | null;
  fulfillmentStatus?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  trackingCompany?: string | null;
  shopifySyncedAt?: Date | null;
}

export type MediaFile = {
  uri: string;
  type: string;
  name: string;
};
