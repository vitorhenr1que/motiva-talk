export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'AGENT' | 'OWNER';
export type ConversationStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'FOLLOW_UP';
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'CONTACT' | 'REACTION' | 'SYSTEM' | 'STICKER' | 'LOCATION';
export type SenderType = 'USER' | 'AGENT' | 'SYSTEM';
export type FileKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'PDF' | 'DOCUMENT' | 'UNKNOWN';

export interface PendingFile {
  file: File;
  previewUrl: string;
  kind: FileKind;
  duration?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  organizationId?: string;
  name: string;
  phone: string;
  profilePictureUrl?: string;
  lastProfilePictureFetchAt?: string;
  createdAt: string;
}

export type WhatsAppProviderType = 'EVOLUTION' | 'META_CLOUD';

export interface Channel {
  id: string;
  organizationId?: string;
  name: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
  provider?: string;
  whatsappProvider?: WhatsAppProviderType;
  providerSessionId?: string;
  connectionStatus?: string;
  allowAgentNameEdit?: boolean;
  defaultSectorId?: string | null;
  metaPhoneNumberId?: string;
  metaWabaId?: string;
  metaAccessToken?: string;
  metaWebhookVerifyToken?: string;
}

export interface Sector {
  id: string;
  organizationId?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSector {
  userId: string;
  sectorId: string;
  createdAt: string;
  sector?: Sector;
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
  organizationId?: string;
  contactId: string;
  channelId: string;
  assignedTo?: string;
  currentSectorId?: string | null;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  finalizedAt?: string | null;
  conversationWindowStartedAt?: string | null;
  updatedAt?: string;
  contact: Contact;
  channel: Channel;
  tags?: ConversationTag[];
  messages?: Message[];
  pinnedNote?: string;
  pinnedAt?: string | null;
  sector?: Sector;
}

export interface Message {
  id: string;
  organizationId?: string;
  conversationId: string;
  channelId: string;
  sectorId?: string | null;
  senderType: SenderType;
  content: string;
  type: MessageType;
  sector?: Sector;
  createdAt: string;
  externalMessageId?: string;
  replyToMessageId?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  deletedForMe?: boolean;
  deletedForEveryone?: boolean;
  isForwarded?: boolean;
  forwardedFromMessageId?: string | null;
  sendStatus?: 'sending' | 'sent' | 'failed';
  errorMessage?: string | null;
  status?: 'sending' | 'sent' | 'failed';
  replyToMessage?: {
    id: string;
    content: string;
    senderType: SenderType;
    type: MessageType;
    externalMessageId?: string;
  };
  isInternal?: boolean;
  transferredToChannelId?: string;
  reactions?: { emoji: string; sender: string; timestamp: number }[];
}

export interface QuickReply {
  id: string;
  organizationId?: string;
  title: string;
  content: string;
  category: string;
  channelId?: string;
  createdAt: string;
}

export interface KeywordSuggestion {
  id: string;
  organizationId?: string;
  keyword: string;
  triggers: string[];
  response: string;
  category: string;
}

export interface FunnelStage {
  id: string;
  organizationId?: string;
  name: string;
  type: 'STEP' | 'SELECT';
  order: number;
  options?: string[] | any;
}

export interface ConversationFunnel {
  id: string;
  organizationId?: string;
  conversationId: string;
  stageId: string;
  value?: string;
  completedAt: string;
  stage?: FunnelStage;
}
