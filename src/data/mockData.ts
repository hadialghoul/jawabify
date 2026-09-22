import { Contact, Message } from '@/types/chat';

export const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    phoneNumber: '+1 555-0101',
    lastMessage: 'That sounds great! Let me know when you\'re free.',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5),
    unreadCount: 2,
  },
  {
    id: '2',
    name: 'Mike Chen',
    phoneNumber: '+1 555-0102',
    lastMessage: 'The meeting is confirmed for tomorrow at 3 PM.',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: '3',
    name: 'Emily Davis',
    phoneNumber: '+1 555-0103',
    lastMessage: 'Thanks for the update!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: '4',
    name: 'Alex Thompson',
    phoneNumber: '+1 555-0104',
    lastMessage: 'Can you send me the document?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 5),
    unreadCount: 1,
  },
  {
    id: '5',
    name: 'Jessica Lee',
    phoneNumber: '+1 555-0105',
    lastMessage: 'See you next week!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

export const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1',
      content: 'Hi Sarah! How are you doing today?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      status: 'read',
      direction: 'outgoing',
    },
    {
      id: 'm2',
      content: 'Hey! I\'m doing great, thanks for asking. How about you?',
      timestamp: new Date(Date.now() - 1000 * 60 * 55),
      status: 'read',
      direction: 'incoming',
    },
    {
      id: 'm3',
      content: 'I\'m good! Just wanted to check in about our project.',
      timestamp: new Date(Date.now() - 1000 * 60 * 50),
      status: 'read',
      direction: 'outgoing',
    },
    {
      id: 'm4',
      content: 'Oh yes! I\'ve been working on the designs. Should have something to show you by tomorrow.',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      status: 'read',
      direction: 'incoming',
    },
    {
      id: 'm5',
      content: 'That sounds great! Let me know when you\'re free.',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      status: 'delivered',
      direction: 'incoming',
    },
  ],
  '2': [
    {
      id: 'm1',
      content: 'Mike, are we still on for the meeting tomorrow?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'read',
      direction: 'outgoing',
    },
    {
      id: 'm2',
      content: 'Yes, absolutely! I\'ve sent out the calendar invite.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60),
      status: 'read',
      direction: 'incoming',
    },
    {
      id: 'm3',
      content: 'The meeting is confirmed for tomorrow at 3 PM.',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      status: 'read',
      direction: 'incoming',
    },
  ],
  '3': [
    {
      id: 'm1',
      content: 'Emily, I\'ve finished reviewing the report.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      status: 'read',
      direction: 'outgoing',
    },
    {
      id: 'm2',
      content: 'Thanks for the update!',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'read',
      direction: 'incoming',
    },
  ],
  '4': [
    {
      id: 'm1',
      content: 'Can you send me the document?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
      status: 'delivered',
      direction: 'incoming',
    },
  ],
  '5': [
    {
      id: 'm1',
      content: 'It was great catching up with you!',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25),
      status: 'read',
      direction: 'outgoing',
    },
    {
      id: 'm2',
      content: 'Same here! See you next week!',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      status: 'read',
      direction: 'incoming',
    },
  ],
};
