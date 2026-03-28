export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT';
export type ConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';
export type SenderType = 'USER' | 'AGENT' | 'SYSTEM';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  provider?: string;
  providerSessionId?: string;
  connectionStatus?: string;
}

export interface Tag {
  id: string;
  name: string;
  emoji?: string;
  color: string;
}

export interface ConversationTag {
  tagId: string;
  conversationId: string;
  tag: Tag;
}

export interface Conversation {
  id: string;
  contactId: string;
  channelId: string;
  assignedTo?: string;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt?: string;
  unreadCount?: number;
  contact: Contact;
  channel: Channel;
  tags?: ConversationTag[];
  messages?: Message[];
}

export interface Message {
  id: string;
  conversationId: string;
  channelId: string;
  senderType: SenderType;
  content: string;
  type: MessageType;
  createdAt: string;
  externalMessageId?: string;
  replyToMessageId?: string;
  replyToMessage?: {
    id: string;
    content: string;
    senderType: SenderType;
    type: MessageType;
    externalMessageId?: string;
  };
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string;
  channelId?: string;
  createdAt: string;
}

export interface KeywordSuggestion {
  id: string;
  keyword: string;
  triggers: string[];
  response: string;
  category: string;
}
